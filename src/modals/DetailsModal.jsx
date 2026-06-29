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
  const [activeServer,        setActiveServer]        = createSignal('DIRECT_PLAY');
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

  const handleSimilarClick = (item) => {
    const normalizedItem = {
      ...item,
      media_type: item.media_type || (movie().media_type === 'tv' ? 'tv' : 'movie')
    };
    const inVault = (props.watchlist || []).some(w => String(w.id) === String(item.id));
    if (inVault) {
      setOverrideItem(null);
      const vaultItem = props.watchlist.find(w => String(w.id) === String(item.id));
      setOverrideItem(vaultItem);
    } else {
      setOverrideItem({ ...normalizedItem, _isPreviewOverride: true });
    }
    document.querySelector('.overflow-y-auto.hide-scrollbar.w-full')?.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
      {/* Vengeance Matte Void Background */}
      <div class="absolute inset-0 bg-[#030303] overflow-hidden pointer-events-none">
        <Show when={movie()?.backdrop_path}>
          <img src={`https://image.tmdb.org/t/p/original${movie().backdrop_path}`} class="w-full h-full object-cover opacity-[0.18] scale-110 blur-2xl filter contrast-125" />
        </Show>
        <div class="absolute inset-0 bg-gradient-to-t from-[#030303] via-transparent to-[#030303]/80"></div>
      </div>

      <Show when={movie()}>
        <div
          class="w-full max-w-xl lg:max-w-[800px] bg-[#09090b]/90 backdrop-blur-2xl rounded-t-[2rem] sm:rounded-[2rem] overflow-hidden border border-white/5 relative max-h-[92vh] shadow-[0_0_50px_rgba(0,0,0,0.85)] animate-pop-in flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          {/* Minimal Floating Close Handle */}
          <button
            onClick={props.onClose}
            class="absolute top-5 right-5 z-[100] bg-neutral-900/60 backdrop-blur-md border border-white/5 p-2 rounded-full hover:bg-neutral-800 hover:border-white/20 active:scale-95 transition-all duration-300 group"
          >
            <Icon name="close" class="text-xs text-neutral-400 group-hover:text-white transition-colors" />
          </button>

          <div class="overflow-y-auto hide-scrollbar w-full">
            <MediaHeader
              movie={movie()} details={details()} playTrailer={playTrailer()} setPlayTrailer={setPlayTrailer}
              trailerKey={trailerKey()} isPreview={effectiveIsPreview()} isGuest={props.isGuest}
              isEdit={isEdit()} setIsEdit={setIsEdit} showToast={props.showToast} onLogin={props.onLogin}
            />

            <div class="px-6 md:px-10 pb-24 relative z-10 space-y-6">
              <RatingsPanel omdbData={omdbData()} movie={movie()} />

              <Show when={isEdit()} fallback={
                <div class="animate-fade-in space-y-6">
                  
                  <Show when={!effectiveIsPreview()}>
                    <div class="p-1 rounded-2xl bg-gradient-to-b from-white/[0.03] to-transparent border border-white/5 shadow-inner">
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
                    </div>
                  </Show>

                  <p class="text-neutral-400 text-sm font-medium leading-relaxed italic border-l-2 border-neutral-700 pl-4 py-1 bg-white/[0.01] rounded-r-lg">
                    "{details().overview || (typeof movie().overview === 'string' ? movie().overview : 'No overview available.')}"
                  </p>

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

                  <Show when={effectiveIsPreview()}>
                    <button
                      onClick={addToVaultFromPreview}
                      class="w-full mt-4 font-black py-4 px-6 rounded-xl text-xs uppercase tracking-[0.18em] active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2 border border-neutral-800 bg-white text-black hover:bg-neutral-200 shadow-[0_4px_24px_rgba(255,255,255,0.06)]"
                    >
                      <Icon name="add_circle" class="text-base" /> Add to My Universe
                    </button>
                  </Show>

                  <Show when={!effectiveIsPreview()}>
                    <div class="mt-6 pt-4 border-t border-white/5 flex justify-center">
                      <button
                        onClick={async () => {
                          if (props.isGuest) { if (props.showToast) props.showToast("Sign in to edit vault! 🔒"); if (props.onLogin) props.onLogin(); return; }
                          if (confirm("Permanently delete?")) {
                            await deleteDoc(doc(db, 'users', props.uid, 'watchlist', String(movie().id)));
                            if (props.showToast) props.showToast("Deleted");
                            props.onClose();
                          }
                        }}
                        class="text-red-500/40 hover:text-red-400 text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-1.5 transition-colors active:scale-95 py-2 px-4 rounded-lg hover:bg-red-500/5"
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
        <div class="fixed inset-0 bg-[#030303] z-[10000000] flex flex-col animate-fade-in" onClick={e => e.stopPropagation()}>
          <div class="p-4 flex justify-between items-center bg-[#09090b] border-b border-white/5 shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
            <div class="flex items-center gap-4 overflow-hidden pr-2 flex-1">
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
                class="p-2.5 bg-neutral-900 border border-white/5 hover:bg-neutral-800 text-neutral-400 hover:text-white rounded-full active:scale-95 transition-all"
              >
                <Icon name="arrow_back" class="text-xs" />
              </button>
              <h3 class="font-black text-xs text-white uppercase tracking-widest truncate max-w-[200px]">{movie().title || movie().name}</h3>
            </div>
            <div class="flex gap-2 shrink-0">
              <div class="relative bg-neutral-900 border border-white/5 rounded-xl px-3 py-2 flex items-center gap-1.5 hover:border-white/20 transition-all shadow-inner">
                <Icon name="router" class="text-neutral-500 text-[13px]" />
                <select
                  value={activeServer()}
                  onChange={(e) => { e.stopPropagation(); setActiveServer(e.target.value); }}
                  class="bg-transparent text-[9px] font-black uppercase tracking-widest text-neutral-300 outline-none appearance-none cursor-pointer pr-5 pl-0.5"
                >
                  <For each={availableServers()}>
                    {(srv) => <option value={srv.id} class="bg-[#09090b] text-neutral-300">{srv.name}</option>}
                  </For>
                  <option value="DIRECT_PLAY" class="bg-[#09090b] text-blue-400 font-bold">DIRECT PLAY</option>
                </select>
                <Icon name="expand_more" class="text-neutral-500 text-[12px] absolute right-2.5 pointer-events-none" />
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
