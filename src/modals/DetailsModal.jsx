import { createSignal, createEffect, createMemo, onMount, onCleanup, Show, For } from 'solid-js';
import { doc, updateDoc, deleteDoc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Icon, cleanPlatform, getSafeGenres, getSafePlatforms } from '../utils';

import { PersonModal } from './PersonModal';
import { DirectPlayPlayer } from '../components/DirectPlayPlayer';

// Modular UI Components
import { MediaHeader } from '../components/details/MediaHeader';
import { RatingsPanel } from '../components/details/RatingsPanel';
import { StreamingPanel } from '../components/details/StreamingPanel';
import { TvTracker } from '../components/details/TvTracker';
import { CastCrewList } from '../components/details/CastCrewList';
import { InfoGrid } from '../components/details/InfoGrid';
import { EditForm } from '../components/details/EditForm';

// Hooks
import { useWatchProgress } from '../hooks/useWatchProgress';
import { useTmdbDetails } from '../hooks/useTmdbDetails';
import { useOmdbRatings } from '../hooks/useOmdbRatings';
import { useEpisodeTracking } from '../hooks/useEpisodeTracking';

const calculateDays = (start, end) => {
  if (!start || !end) return null;
  const d1 = new Date(start);
  const d2 = new Date(end);
  if (isNaN(d1) || isNaN(d2)) return null;
  if (d2 < d1) return 0;
  return Math.ceil(Math.abs(d2 - d1) / (1000 * 60 * 60 * 24)) + 1;
};

export function DetailsModal(props) {
  const isPreview  = createMemo(() => typeof props.id === 'string' && props.id.startsWith('PREVIEW_'));
  const isResume   = createMemo(() => typeof props.id === 'string' && props.id.startsWith('RESUME_'));
  const previewData = createMemo(() => {
    if (!isPreview()) return null;
    try { return JSON.parse(props.id.replace('PREVIEW_', '')); } catch { return null; }
  });
  const baseId = createMemo(() => {
    if (isPreview()) return previewData()?.id;
    if (isResume())  return props.id.replace('RESUME_', '');
    return props.id;
  });

  const [overrideItem, setOverrideItem] = createSignal(null);
  const movie = createMemo(() =>
    overrideItem() || (isPreview() ? previewData() : props.watchlist?.find(m => String(m.id) === String(baseId())))
  );

  const [isEdit,              setIsEdit]              = createSignal(false);
  const [playTrailer,         setPlayTrailer]         = createSignal(false);
  const [showPlayer,          setShowPlayer]          = createSignal(false);
  const [activeServer,        setActiveServer]        = createSignal(null);
  const [personId,            setPersonId]            = createSignal(null);
  const [omdbData,            setOmdbData]            = createSignal({ imdb: '-', rt: '-' });
  const [customServers,       setCustomServers]       = createSignal({});
  const [directPlayUrl,       setDirectPlayUrl]       = createSignal('');
  const [isEditingDirectUrl,  setIsEditingDirectUrl]  = createSignal(false);

  const [form, setForm] = createSignal({
    status: '', rating: '', watchDate: '', notes: '',
    region: '', season: 1, episode: 1, tag: '',
    platforms: '', genres: '', seasonDates: {},
  });

  const [watchProgress,       setWatchProgress]       = createSignal(null);
  const [contentDuration,     setContentDuration]     = createSignal(0);
  const [playerSessionStart,  setPlayerSessionStart]  = createSignal(null);
  const [playerStartProgress, setPlayerStartProgress] = createSignal(0);
  const [receivedRealProgress,setReceivedRealProgress]= createSignal(false);

  let autoPlayTriggered = false;
  let inferDurationSeconds = () => 0;

  const { details, trailerKey, richPlatforms, similarItems } = useTmdbDetails(movie, {
    uid:             props.uid,
    isGuest:         props.isGuest,
    isPreview,
    setForm,
    setContentDuration,
  });

  inferDurationSeconds = () => {
    const d    = details();
    const mins = d?.runtime || d?.episode_run_time?.[0] || movie()?.runtime || 0;
    const sec  = Number(mins) * 60;
    if (Number.isFinite(sec) && sec > 0) return sec;
    return movie()?.media_type === 'tv' ? 45 * 60 : 120 * 60;
  };

  useOmdbRatings(movie, setOmdbData, props.uid, isPreview, props.isGuest);

  const currentSeasonNumber  = createMemo(() => parseInt(form().season  || movie()?.season  || 1) || 1);
  const currentEpisodeNumber = createMemo(() => parseInt(form().episode || movie()?.episode || 1) || 1);

  const isCompleted = createMemo(() => !isPreview() && (form().status || movie()?.status) === 'Completed');

  const {
    primePlaybackProgress, handlePlayerMessages, hydrateSessionProgressFromElapsed, saveProgressToDb,
  } = useWatchProgress({
    movie, isPreview, isGuest: props.isGuest, uid: props.uid, activeServer, watchProgress, setWatchProgress,
    contentDuration, setContentDuration, playerSessionStart, setPlayerSessionStart, playerStartProgress,
    setPlayerStartProgress, receivedRealProgress, setReceivedRealProgress,
    currentSeasonNumber, currentEpisodeNumber, inferDurationSeconds, showToast: props.showToast,
  });

  const {
    selectedSeason, setSelectedSeason, seasonEpisodes, seasonsLoading, expandedEpisodes, setExpandedEpisodes,
    watchedEpisodes, tvSeasons, selectedSeasonEpisodes, episodeDocId, getEpisodesForSeason,
    loadWatchedEpisodes, fetchSeasonEpisodes, toggleEpisodeWatched, checkIfWatched
  } = useEpisodeTracking({
    movie, details, isPreview, isGuest: props.isGuest, uid: props.uid, activeServer, inferDurationSeconds,
    setForm, setWatchProgress, setPlayerStartProgress, showToast: props.showToast, onLogin: props.onLogin,
    currentSeasonNumber, currentEpisodeNumber, isCompleted
  });

  const getCurrentEpisode = () => {
    const season  = currentSeasonNumber();
    const episode = currentEpisodeNumber();
    return (
      getEpisodesForSeason(season).find(ep => Number(ep.episode_number) === episode) ||
      { season_number: season, episode_number: episode, name: `Episode ${episode}` }
    );
  };

  const availableServers = createMemo(() => {
    const custom = customServers();
    return Object.keys(custom).filter(key => custom[key].enabled !== false).map(key => ({
      id: key,
      name: custom[key].name || 'Custom Server',
      type: custom[key].type || 'multi',
      movieUrl: custom[key].movieUrl || '',
      tvUrl: custom[key].tvUrl || '',
      icon: 'dns'
    }));
  });

  createEffect(() => {
    const list = availableServers();
    if (list.length > 0 && !list.find(s => s.id === activeServer()) && activeServer() !== 'DIRECT_PLAY') {
      setActiveServer(list[0].id);
    }
  });

  createEffect(() => {
    if (isResume() && movie() && !autoPlayTriggered) {
      autoPlayTriggered = true;
      const savedServer = movie().watchProgress?.server;
      if (savedServer && (availableServers().find(s => s.id === savedServer) || savedServer === 'DIRECT_PLAY')) {
        setActiveServer(savedServer);
      } else {
        setActiveServer('DIRECT_PLAY');
      }
      setTimeout(() => {
        primePlaybackProgress();
        setShowPlayer(true);
      }, 200);
    }
  });

  onMount(async () => {
    if (!props.isGuest) {
      try {
        const userDoc = await getDoc(doc(db, 'users', props.uid || 'unknown'));
        setCustomServers(userDoc.data()?.customServers || {});
      } catch (e) {}
    }
  });

  createEffect(() => {
    if (movie()?.media_type !== 'tv') return;
    const seasons = tvSeasons();
    if (!seasons.length) return;
    const preferred = Number(movie().season || seasons[0].season_number || 1);
    const exists    = seasons.some(s => Number(s.season_number) === preferred);
    if (!selectedSeason()) setSelectedSeason(exists ? preferred : Number(seasons[0].season_number));
  });

  createEffect(() => {
    const seasonNumber = selectedSeason();
    if (movie()?.media_type === 'tv' && seasonNumber) fetchSeasonEpisodes(seasonNumber);
  });

  createEffect(() => {
    const m = movie();
    if (m?.media_type === 'tv' && !isPreview()) loadWatchedEpisodes();
  });

  createEffect(() => {
    const m = movie();
    if (!m?.id) return;
    setDirectPlayUrl(m.directPlayUrl || localStorage.getItem(`cinelog_direct_url_${m.id}`) || '');
  });

  onMount(() => {
    document.body.style.overflow = 'hidden';
    window.addEventListener('message', handlePlayerMessages);
  });
  onCleanup(() => {
    hydrateSessionProgressFromElapsed();
    saveProgressToDb();
    document.body.style.overflow = '';
    window.removeEventListener('message', handlePlayerMessages);
  });

  createEffect(() => {
    if (movie() && !isPreview() && !props.isGuest) {
      setForm({
        status:      movie().status      || 'Planned',
        rating:      movie().rating      || '',
        watchDate:   typeof movie().watchDate === 'string' ? movie().watchDate : '',
        notes:       typeof movie().notes     === 'string' ? movie().notes     : '',
        region:      movie().region      || 'International',
        season:      movie().season      || 1,
        episode:     movie().episode     || 1,
        tag:         movie().tag         || '',
        platforms:   getSafePlatforms(movie()).join(', '),
        genres:      getSafeGenres(movie()).join(', '),
        seasonDates: movie().seasonDates || {},
      });
    }
  });

  const allAvailablePlatforms = createMemo(() =>
    [...new Set((props.watchlist || []).flatMap(m => getSafePlatforms(m)))].filter(Boolean).sort()
  );

  const progressPct = createMemo(() => {
    if (isCompleted()) return 100;
    const loadedSeasonTotal = getEpisodesForSeason(currentSeasonNumber()).length;
    const total = Number(movie()?.totalEps) || loadedSeasonTotal || 1;
    return Math.min((currentEpisodeNumber() / total) * 100, 100);
  });

  const movieFranchises = createMemo(() =>
    props.franchises?.filter(f => movie()?.franchises?.[f.id] !== undefined).map(f => f.name).join(', ')
  );

  const togglePlatform = (p) => {
    let curr = form().platforms.split(',').map(s => s.trim()).filter(Boolean);
    curr = curr.includes(p) ? curr.filter(x => x !== p) : [...curr, p];
    setForm({ ...form(), platforms: curr.join(', ') });
  };

  const saveChanges = async () => {
    if (props.isGuest) { props.showToast("Sign in to save changes! 🔒"); if (props.onLogin) props.onLogin(); return; }
    const nextSeason   = parseInt(form().season)   || 1;
    const nextEpisode  = parseInt(form().episode)  || 1;
    const prevSeason   = parseInt(movie().season)  || 1;
    const prevEpisode  = parseInt(movie().episode) || 1;
    const episodeChanged = movie().media_type === 'tv' && (nextSeason !== prevSeason || nextEpisode !== prevEpisode);
    const updates = {
      status:       form().status,
      rating:       parseFloat(form().rating) || 0,
      watchDate:    form().watchDate,
      seasonDates:  form().seasonDates,
      notes:        form().notes,
      region:       form().region,
      season:       nextSeason,
      episode:      nextEpisode,
      tag:          form().tag,
      genresList:   form().genres.split(',').map(s => s.trim()).filter(Boolean),
      platformsList:form().platforms.split(',').map(s => cleanPlatform(s.trim())).filter(Boolean),
    };
    if (episodeChanged) {
      const inferred = inferDurationSeconds();
      updates.watchProgress = { currentTime: 0, duration: inferred || 0, server: activeServer() || null, updatedAt: new Date().toISOString(), season: nextSeason, episode: nextEpisode };
      setWatchProgress({ currentTime: 0, duration: inferred || 0 });
      setPlayerStartProgress(0);
    }
    await updateDoc(doc(db, 'users', props.uid, 'watchlist', String(movie().id)), updates);
    if (props.showToast) props.showToast("Saved");
    setIsEdit(false);
  };

  const addToVaultFromPreview = async () => {
    if (props.isGuest) { if (props.showToast) props.showToast("Sign in to add to Vault! 🔒"); if (props.onLogin) props.onLogin(); return; }
    const item = movie();
    if ((props.watchlist || []).some(w => String(w.id) === String(item.id))) { if (props.showToast) props.showToast("Already in Vault! 🍿"); return; }
    if (props.showToast) props.showToast("Adding to Vault...");
    try {
      const castNames = details().credits?.cast?.slice(0, 5).map(c => c.name) || [];
      const director  = details().credits?.crew?.find(c => c.job === 'Director')?.name || '';
      const castList  = [...castNames, director].filter(Boolean);
      await setDoc(doc(db, 'users', props.uid, 'watchlist', String(item.id)), {
        id: String(item.id), title: item.title || item.name, media_type: item.media_type || 'movie',
        poster_path: item.poster_path, backdrop_path: item.backdrop_path,
        release_date: item.release_date || item.first_air_date || '',
        status: 'Planned', addedAt: new Date(), castList,
      });
      if (props.showToast) props.showToast("Added to Vault! 🍿");
      props.onClose();
    } catch { if (props.showToast) props.showToast("Error adding to vault."); }
  };

  // ✅ FIX: Smart Similar Click — Vault check karo pehle
  const handleSimilarClick = (item) => {
    const normalizedItem = {
      ...item,
      media_type: item.media_type || (movie().media_type === 'tv' ? 'tv' : 'movie')
    };

    // Kya ye item already Vault mein hai?
    const inVault = (props.watchlist || []).some(w => String(w.id) === String(item.id));

    if (inVault) {
      // Vault mein hai — normal open, saved data ke saath
      setOverrideItem(null);
      // baseId change karne ke liye parent se id update nahi ho sakta directly,
      // isliye overrideItem ko Vault ka actual item set karo
      const vaultItem = props.watchlist.find(w => String(w.id) === String(item.id));
      setOverrideItem(vaultItem);
    } else {
      // Vault mein nahi — Preview mode mein kholo (Search jaisa)
      setOverrideItem({ ...normalizedItem, _isPreviewOverride: true });
    }

    document.querySelector('.overflow-y-auto.hide-scrollbar.w-full')?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ✅ FIX: overrideItem ke liye bhi isPreview correctly work kare
  const isPreviewOverride = createMemo(() => !!overrideItem()?._isPreviewOverride);
  const effectiveIsPreview = createMemo(() => isPreview() || isPreviewOverride());

  const getStreamUrl = (serverId) => {
    if (serverId === 'DIRECT_PLAY') return directPlayUrl();
    if (!serverId) return '';
    const id   = movie().id;
    const s    = movie().media_type === 'tv' ? currentSeasonNumber() : (movie().season  || 1);
    const e    = movie().media_type === 'tv' ? currentEpisodeNumber(): (movie().episode || 1);
    const type = movie().media_type === 'tv' ? 'tv' : 'movie';
    const serverConfig = availableServers().find(srv => srv.id === serverId);
    if (!serverConfig) return '';
    const urlTemplate = type === 'tv' ? serverConfig.tvUrl : serverConfig.movieUrl;
    if (!urlTemplate) return '';
    let timeParam = '';
    const canResume =
      movie().watchProgress &&
      movie().watchProgress.server === serverId &&
      movie().watchProgress.currentTime > 0 &&
      (movie().media_type !== 'tv' || (
        parseInt(movie().watchProgress.season  || 1) === parseInt(movie().season  || 1) &&
        parseInt(movie().watchProgress.episode || 1) === parseInt(movie().episode || 1)
      ));
    if (canResume) {
      const t = Math.floor(movie().watchProgress.currentTime);
      timeParam = urlTemplate.includes('?') ? `&t=${t}&start=${t}&time=${t}` : `?t=${t}&start=${t}&time=${t}`;
    }
    return urlTemplate
      .replace(/\{id\}|\[TMDB_ID\]/gi, id)
      .replace(/\{season\}|\[SEASON\]/gi, s)
      .replace(/\{episode\}|\[EPISODE\]/gi, e)
      + timeParam;
  };

  return (
    <div class="fixed inset-0 z-[999999] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in" onClick={props.onClose}>
      <div class="absolute inset-0 bg-[#08090b] overflow-hidden pointer-events-none">
        <Show when={movie()?.backdrop_path}>
          <img src={`https://image.tmdb.org/t/p/w500${movie().backdrop_path}`} class="w-full h-full object-cover opacity-40 blur-3xl scale-125" />
        </Show>
        <div class="absolute inset-0 bg-black/60"></div>
      </div>

      <Show when={movie()}>
        <div
          class="w-full max-w-xl lg:max-w-[800px] bg-[#08090b]/80 backdrop-blur-3xl rounded-t-[2.5rem] sm:rounded-[2.5rem] overflow-hidden border border-white/10 relative max-h-[95vh] shadow-[0_-10px_40px_rgba(0,0,0,0.5)] animate-pop-in flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={props.onClose}
            class="absolute top-4 right-4 z-[100] bg-black/50 backdrop-blur-md border border-white/10 p-2.5 rounded-full hover:bg-black/80 active:scale-95 transition-all"
          >
            <Icon name="close" class="text-sm text-white" />
          </button>

          <div class="overflow-y-auto hide-scrollbar w-full">
            <MediaHeader
              movie={movie()} details={details()} playTrailer={playTrailer()} setPlayTrailer={setPlayTrailer}
              trailerKey={trailerKey()} isPreview={effectiveIsPreview()} isGuest={props.isGuest}
              isEdit={isEdit()} setIsEdit={setIsEdit} showToast={props.showToast} onLogin={props.onLogin}
            />

            <div class="px-6 md:px-8 pb-28 relative z-10">
              <RatingsPanel omdbData={omdbData()} movie={movie()} />

              <Show when={isEdit()} fallback={
                <div class="animate-fade-in">
                  {/* Streaming panel — sirf real Vault items ke liye */}
                  <Show when={!effectiveIsPreview()}>
                    <StreamingPanel
                      availableServers={availableServers()} activeServer={activeServer()} setActiveServer={setActiveServer}
                      isEditingDirectUrl={isEditingDirectUrl()} setIsEditingDirectUrl={setIsEditingDirectUrl}
                      directPlayUrl={directPlayUrl()} setDirectPlayUrl={setDirectPlayUrl} showToast={props.showToast}
                      movie={movie()} inferDurationSeconds={inferDurationSeconds} setContentDuration={setContentDuration}
                      setWatchProgress={setWatchProgress} setPlayerStartProgress={setPlayerStartProgress}
                      setReceivedRealProgress={setReceivedRealProgress} setPlayerSessionStart={setPlayerSessionStart}
                      setShowPlayer={setShowPlayer}
                      uid={props.uid}
                    />
                  </Show>

                  <p class="text-gray-400 text-sm mb-6 leading-relaxed italic border-l-2 border-[var(--primary)]/30 pl-3">
                    "{details().overview || (typeof movie().overview === 'string' ? movie().overview : 'No overview available.')}"
                  </p>

                  {/* ✅ FIX: TV tracker — preview mein bhi dikhao (read-only mode), sirf non-preview mein full tracking */}
                  <Show when={movie().media_type === 'tv'}>
                    <TvTracker
                      movie={movie()} tvSeasons={tvSeasons()} selectedSeason={selectedSeason()} setSelectedSeason={setSelectedSeason}
                      seasonsLoading={seasonsLoading()} selectedSeasonEpisodes={selectedSeasonEpisodes()}
                      episodeDocId={episodeDocId} watchedEpisodes={watchedEpisodes()} expandedEpisodes={expandedEpisodes()}
                      setExpandedEpisodes={setExpandedEpisodes} toggleEpisodeWatched={toggleEpisodeWatched}
                      isCompleted={isCompleted()} currentSeasonNumber={currentSeasonNumber()} currentEpisodeNumber={currentEpisodeNumber()}
                      progressPct={progressPct()} getCurrentEpisode={getCurrentEpisode}
                      checkIfWatched={checkIfWatched}
                      isPreviewMode={effectiveIsPreview()}
                    />
                  </Show>

                  <CastCrewList credits={details().credits} setPersonId={setPersonId} />

                  <InfoGrid
                    movie={movie()} isPreview={effectiveIsPreview()}
                    genresText={details().genres ? details().genres.map(g => g.name).join(', ') : (getSafeGenres(movie()).join(', ') || 'N/A')}
                    richPlatforms={richPlatforms()} movieFranchises={movieFranchises()} similarItems={similarItems()}
                    onSimilarClick={handleSimilarClick}
                    calculateDays={calculateDays}
                  />

                  {/* Add to Vault button — preview mode mein dikhao */}
                  <Show when={effectiveIsPreview()}>
                    <button
                      onClick={addToVaultFromPreview}
                      class="w-full mt-6 font-black py-4 px-5 rounded-xl text-xs uppercase tracking-widest active:scale-95 transition-transform flex items-center justify-center gap-2 border"
                      style="background: var(--p); color: #05060a; border-color: var(--p); box-shadow: 0 0 24px var(--p-glow); min-height: 52px;"
                    >
                      <Icon name="add_circle" class="text-lg" /> Add to My Universe
                    </button>
                  </Show>

                  <Show when={!effectiveIsPreview()}>
                    <div class="mt-8 flex justify-end">
                      <button
                        onClick={async () => {
                          if (props.isGuest) { if (props.showToast) props.showToast("Sign in to edit vault! 🔒"); if (props.onLogin) props.onLogin(); return; }
                          if (confirm("Permanently delete?")) {
                            await deleteDoc(doc(db, 'users', props.uid, 'watchlist', String(movie().id)));
                            if (props.showToast) props.showToast("Deleted");
                            props.onClose();
                          }
                        }}
                        class="text-red-500/50 hover:text-red-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-1 transition-colors mx-auto active:scale-95"
                      >
                        <Icon name="delete" class="text-sm" /> Remove from Universe
                      </button>
                    </div>
                  </Show>
                </div>
              }>
                <EditForm
                  form={form()} setForm={setForm} movie={movie()}
                  allAvailablePlatforms={allAvailablePlatforms} togglePlatform={togglePlatform} saveChanges={saveChanges}
                />
              </Show>
            </div>
          </div>
        </div>
      </Show>

      {/* Fullscreen Player Modal */}
      <Show when={showPlayer()}>
        <div class="fixed inset-0 bg-black z-[10000000] flex flex-col animate-fade-in" onClick={e => e.stopPropagation()}>
          <div class="p-4 flex justify-between items-center bg-[#0c0e14] border-b border-white/5 shadow-xl">
            <div class="flex items-center gap-3 overflow-hidden pr-2 flex-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  hydrateSessionProgressFromElapsed();
                  saveProgressToDb();
                  setPlayerSessionStart(null);
                  setPlayerStartProgress(0);
                  setShowPlayer(false);
                }}
                class="p-2 bg-white/5 hover:bg-white/10 rounded-full active:scale-95 transition-all shrink-0"
              >
                <Icon name="arrow_back" class="text-sm" />
              </button>
              <h3 class="font-bold text-sm text-white truncate max-w-[150px]">{movie().title || movie().name}</h3>
            </div>
            <div class="flex gap-2 shrink-0">
              <div class="relative bg-white/5 border border-white/10 rounded-xl px-2 py-1.5 flex items-center gap-1 hover:bg-white/10 transition-colors">
                <Icon name="router" class="text-gray-400 text-[14px]" />
                <select
                  value={activeServer()}
                  onChange={(e) => { e.stopPropagation(); setActiveServer(e.target.value); }}
                  class="bg-transparent text-[10px] font-black uppercase tracking-widest text-[var(--primary)] outline-none appearance-none cursor-pointer pr-4 pl-1"
                >
                  <For each={availableServers()}>
                    {(srv) => <option value={srv.id} class="bg-[#0c0e14] text-white">{srv.name}</option>}
                  </For>
                  <option value="DIRECT_PLAY" class="bg-[#0c0e14] text-[#3b82f6]">DIRECT PLAY</option>
                </select>
                <Icon name="expand_more" class="text-gray-400 text-[14px] absolute right-1 pointer-events-none" />
              </div>
            </div>
          </div>

          <div class="flex-1 bg-black w-full h-full relative">
            <Show
              when={activeServer() === 'DIRECT_PLAY'}
              fallback={<iframe src={getStreamUrl(activeServer())} class="w-full h-full border-none relative z-10" allowfullscreen></iframe>}
            >
              <DirectPlayPlayer
                src={getStreamUrl(activeServer())}
                title={movie().title || movie().name}
                poster={`https://image.tmdb.org/t/p/original${movie().backdrop_path}`}
                startTime={movie().watchProgress?.currentTime || 0}
                onProgress={(prog) => { setReceivedRealProgress(true); setWatchProgress(prog); }}
              />
            </Show>
          </div>
        </div>
      </Show>

      <Show when={personId()}>
        <PersonModal
          id={personId()}
          uid={props.uid}
          watchlist={props.watchlist}
          showToast={props.showToast}
          onClose={() => setPersonId(null)}
          openPreview={(item) => {
            setPersonId(null);
            if (props.openPreview) {
              props.openPreview(item, 'fromPerson');
            } else {
              props.onClose();
              if (props.showToast) props.showToast(`Search for ${item.title || item.name} to view details!`);
            }
          }}
        />
      </Show>
    </div>
  );
}
