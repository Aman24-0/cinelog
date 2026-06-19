import { createSignal, createEffect, createMemo, onMount, onCleanup, For, Show } from 'solid-js';
import { collection, doc, updateDoc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Icon, formatRuntime, cleanPlatform, getSafeGenres, getSafePlatforms, SafeInfoRow, TMDB_KEY } from '../utils';
import { PersonModal } from './PersonModal';
import { DetailsHero } from '../components/details/DetailsHero';
import { RatingsPanel } from '../components/details/RatingsPanel';
import { SimilarItems } from '../components/details/SimilarItems';
import { useTmdbDetails } from '../hooks/useTmdbDetails';
import { useOmdbRatings } from '../hooks/useOmdbRatings';
import { useWatchProgress } from '../hooks/useWatchProgress';
import { addPreviewToWatchlist, deleteWatchlistItem, updateWatchlistItem, upsertEpisodeWatchState } from '../services/watchlistService';

const DEFAULT_SERVERS = [
  { id: 'vidzee', name: 'VidZee (Fast)', movieUrl: 'https://player.vidzee.wtf/embed/movie/{id}', tvUrl: 'https://player.vidzee.wtf/embed/tv/{id}/{season}/{episode}', icon: 'smart_display' },
  { id: 'vidlink', name: 'VidLink', movieUrl: 'https://vidlink.pro/movie/{id}?primaryColor=b1a1ff&autoplay=false', tvUrl: 'https://vidlink.pro/tv/{id}/{season}/{episode}?primaryColor=b1a1ff&autoplay=false', icon: 'play_circle' },
  { id: 'vidsrcru', name: 'Vidsrc.ru', movieUrl: 'https://vidsrc.ru/movie/{id}?autoplay=true&colour=b1a1ff', tvUrl: 'https://vidsrc.ru/tv/{id}/{season}/{episode}?autoplay=true&colour=b1a1ff&autonextepisode=true', icon: 'dns' },
  { id: 'peachify', name: 'Peachify', movieUrl: 'https://peachify.top/embed/movie/{id}?accent=b1a1ff', tvUrl: 'https://peachify.top/embed/tv/{id}/{season}/{episode}?accent=b1a1ff', icon: 'stream' },
  { id: 'vidsrccc', name: 'Vidsrc.cc', movieUrl: 'https://vidsrc.cc/v2/embed/movie/{id}', tvUrl: 'https://vidsrc.cc/v2/embed/tv/{id}/{season}/{episode}', icon: 'dynamic_feed' },
  { id: 'autoembed', name: 'AutoEmbed', movieUrl: 'https://autoembed.co/movie/tmdb/{id}', tvUrl: 'https://autoembed.co/tv/tmdb/{id}-{season}-{episode}', icon: 'bolt' },
  { id: 'vidnest', name: 'VidNest (Official)', movieUrl: 'https://vidnest.fun/movie/{id}', tvUrl: 'https://vidnest.fun/tv/{id}/{season}/{episode}', icon: 'play_circle' }
];

const calculateDays = (start, end) => {
    if (!start || !end) return null;
    const d1 = new Date(start);
    const d2 = new Date(end);
    if (isNaN(d1) || isNaN(d2)) return null;
    if (d2 < d1) return 0;
    const diffTime = Math.abs(d2 - d1);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
};

export function DetailsModal(props) {
  const isPreview = createMemo(() => typeof props.id === 'string' && props.id.startsWith('PREVIEW_'));
  const isResume = createMemo(() => typeof props.id === 'string' && props.id.startsWith('RESUME_'));
  
  const previewData = createMemo(() => { if (!isPreview()) return null; try { return JSON.parse(props.id.replace('PREVIEW_', '')); } catch(e) { return null; } });
  
  const baseId = createMemo(() => {
      if (isPreview()) return previewData()?.id;
      if (isResume()) return props.id.replace('RESUME_', '');
      return props.id;
  });

  const [overrideItem, setOverrideItem] = createSignal(null);

  const movie = createMemo(() => overrideItem() || (isPreview() ? previewData() : props.watchlist?.find(m => String(m.id) === String(baseId()))));
  

  const [isEdit, setIsEdit] = createSignal(false); 

  const [playTrailer, setPlayTrailer] = createSignal(false);
  const [showPlayer, setShowPlayer] = createSignal(false); 
  const [activeServer, setActiveServer] = createSignal(null); 
  const [personId, setPersonId] = createSignal(null); 

  const [form, setForm] = createSignal({ status: '', rating: '', watchDate: '', notes: '', region: '', season: 1, episode: 1, tag: '', platforms: '', genres: '', seasonDates: {} });
  
  const [customServers, setCustomServers] = createSignal({});
  
  const [watchProgress, setWatchProgress] = createSignal(null);
  const [contentDuration, setContentDuration] = createSignal(0);
  const { details, trailerKey, richPlatforms, similarItems } = useTmdbDetails(movie, { uid: props.uid, isGuest: props.isGuest, isPreview, setForm, setContentDuration });
  const { omdbData } = useOmdbRatings(movie, { uid: props.uid, isGuest: props.isGuest, isPreview });
  const [playerSessionStart, setPlayerSessionStart] = createSignal(null);
  const [playerStartProgress, setPlayerStartProgress] = createSignal(0);
  const [receivedRealProgress, setReceivedRealProgress] = createSignal(false);
  const [selectedSeason, setSelectedSeason] = createSignal(null);
  const [seasonEpisodes, setSeasonEpisodes] = createSignal({});
  const [seasonsLoading, setSeasonsLoading] = createSignal(false);
  const [expandedEpisodes, setExpandedEpisodes] = createSignal({});
  const [watchedEpisodes, setWatchedEpisodes] = createSignal({});
  let autoPlayTriggered = false;


  const inferDurationSeconds = () => {
    const d = details();
    const mins = d?.runtime || d?.episode_run_time?.[0] || movie()?.runtime || 0;
    const sec = Number(mins) * 60;
    if (Number.isFinite(sec) && sec > 0) return sec;
    return movie()?.media_type === 'tv' ? 45 * 60 : 120 * 60;
  };


  const tvSeasons = createMemo(() => (details().seasons || [])
    .filter(s => Number(s.season_number) > 0)
    .sort((a, b) => Number(a.season_number) - Number(b.season_number)));

  const selectedSeasonData = createMemo(() => tvSeasons().find(s => Number(s.season_number) === Number(selectedSeason())));
  const selectedSeasonEpisodes = createMemo(() => seasonEpisodes()[selectedSeason()]?.episodes || []);
  const currentSeasonNumber = createMemo(() => parseInt(form().season || movie()?.season || 1) || 1);
  const currentEpisodeNumber = createMemo(() => parseInt(form().episode || movie()?.episode || 1) || 1);
  const progressControls = useWatchProgress({ movie, isPreview, isGuest: props.isGuest, uid: props.uid, activeServer, watchProgress, setWatchProgress, contentDuration, setContentDuration, playerSessionStart, setPlayerSessionStart, playerStartProgress, setPlayerStartProgress, receivedRealProgress, setReceivedRealProgress, currentSeasonNumber, currentEpisodeNumber, inferDurationSeconds, showToast: props.showToast });
  const episodeDocId = (season, episode) => `s${season}_e${episode}`;
  const compareEpisodePosition = (aSeason, aEpisode, bSeason, bEpisode) => (Number(aSeason) - Number(bSeason)) || (Number(aEpisode) - Number(bEpisode));
  const getEpisodesForSeason = (season) => (seasonEpisodes()[season]?.episodes || []).slice().sort((a, b) => Number(a.episode_number) - Number(b.episode_number));
  const findNextEpisodePointer = (season, episode) => {
    const currentSeasonEpisodes = getEpisodesForSeason(season);
    const nextInSeason = currentSeasonEpisodes.find(ep => Number(ep.episode_number) > Number(episode));
    if (nextInSeason) return { season: Number(season), episode: Number(nextInSeason.episode_number) };

    const nextSeason = tvSeasons().find(s => Number(s.season_number) > Number(season));
    if (!nextSeason) return null;
    const nextSeasonNumber = Number(nextSeason.season_number);
    const nextSeasonEpisodes = getEpisodesForSeason(nextSeasonNumber);
    return { season: nextSeasonNumber, episode: Number(nextSeasonEpisodes[0]?.episode_number || 1) };
  };
  const getCurrentEpisode = () => {
    const season = currentSeasonNumber();
    const episode = currentEpisodeNumber();
    return getEpisodesForSeason(season).find(ep => Number(ep.episode_number) === episode) || { season_number: season, episode_number: episode, name: `Episode ${episode}` };
  };
  const seasonCacheKey = () => `tmdb_${movie()?.id}_seasons`;
  const cacheIsFresh = (cache) => cache?.timestamp && (Date.now() - cache.timestamp < 24 * 60 * 60 * 1000);

  const getStoredSeasonCache = () => {
    try { return JSON.parse(localStorage.getItem(seasonCacheKey()) || '{}'); } catch (e) { return {}; }
  };

  const writeStoredSeasonCache = (cache) => {
    try { localStorage.setItem(seasonCacheKey(), JSON.stringify(cache)); } catch (e) {}
  };

  const loadWatchedEpisodes = async () => {
    if (props.isGuest || !props.uid || isPreview() || movie()?.media_type !== 'tv') return;
    try {
      const snap = await getDocs(collection(db, 'users', props.uid, 'watchlist', String(movie().id), 'episodes'));
      const next = {};
      snap.docs.forEach(d => { next[d.id] = d.data(); });
      setWatchedEpisodes(next);
    } catch (e) {}
  };

  const fetchSeasonEpisodes = async (seasonNumber, forceRefresh = false) => {
    if (!movie()?.id || movie()?.media_type !== 'tv' || !seasonNumber) return;
    const cache = getStoredSeasonCache();
    const cachedSeason = cache?.seasons?.[seasonNumber];
    if (!forceRefresh && cacheIsFresh(cache) && cachedSeason) {
      setSeasonEpisodes(prev => ({ ...prev, [seasonNumber]: cachedSeason }));
      return;
    }

    setSeasonsLoading(true);
    try {
      const res = await fetch(`https://api.themoviedb.org/3/tv/${movie().id}/season/${seasonNumber}?api_key=${TMDB_KEY}`);
      if (!res.ok) throw new Error('season fetch failed');
      const season = await res.json();
      const nextCache = {
        timestamp: Date.now(),
        seasons: { ...(cache.seasons || {}), [seasonNumber]: season }
      };
      writeStoredSeasonCache(nextCache);
      setSeasonEpisodes(prev => ({ ...prev, [seasonNumber]: season }));
    } catch (e) {
      if (cachedSeason) setSeasonEpisodes(prev => ({ ...prev, [seasonNumber]: cachedSeason }));
    } finally {
      setSeasonsLoading(false);
    }
  };

  const updateCurrentEpisodePointer = async (nextPointer, completed = false) => {
    const nextSeason = Number(nextPointer?.season || currentSeasonNumber());
    const nextEpisode = Number(nextPointer?.episode || currentEpisodeNumber());
    const nextStatus = completed ? 'Completed' : (movie()?.status === 'Planned' || movie()?.status === 'Plan to Watch' || movie()?.status === 'Completed' ? 'Watching' : (movie()?.status || 'Watching'));
    const nextProgress = {
      currentTime: 0,
      duration: inferDurationSeconds() || 0,
      server: activeServer() || null,
      updatedAt: new Date().toISOString(),
      season: nextSeason,
      episode: nextEpisode
    };

    setForm(prev => ({ ...prev, season: nextSeason, episode: nextEpisode, status: nextStatus }));
    setWatchProgress(nextProgress);
    setPlayerStartProgress(0);

    if (!props.isGuest && props.uid && movie() && !isPreview()) {
      await updateDoc(doc(db, 'users', props.uid, 'watchlist', String(movie().id)), {
        season: nextSeason,
        episode: nextEpisode,
        status: nextStatus,
        watchProgress: nextProgress
      });
    }
  };

  const toggleEpisodeWatched = async (ep) => {
    if (props.isGuest) {
      props.showToast("Sign in to track episodes! 🔒");
      if (props.onLogin) props.onLogin();
      return;
    }
    if (!props.uid || !movie() || !ep) return;

    const season = Number(ep.season_number || selectedSeason() || currentSeasonNumber());
    const episode = Number(ep.episode_number || 1);
    const id = episodeDocId(season, episode);
    const isWatched = !!watchedEpisodes()[id]?.watched;
    const nextWatched = !isWatched;
    const payload = {
      watched: nextWatched,
      season,
      episode,
      episodeId: id,
      title: ep.name || '',
      airDate: ep.air_date || '',
      runtime: ep.runtime || null,
      updatedAt: new Date().toISOString()
    };

    setWatchedEpisodes(prev => ({ ...prev, [id]: payload }));

    try {
      await upsertEpisodeWatchState({ uid: props.uid, itemId: movie().id, episodeId: id, payload });

      if (nextWatched) {
        const nextPointer = findNextEpisodePointer(season, episode);
        await updateCurrentEpisodePointer(nextPointer || { season, episode }, !nextPointer);
        props.showToast(nextPointer ? `S${season} E${episode} watched — next S${nextPointer.season} E${nextPointer.episode}` : `S${season} E${episode} watched — show completed`);
      } else {
        if (compareEpisodePosition(currentSeasonNumber(), currentEpisodeNumber(), season, episode) > 0 || movie()?.status === 'Completed') {
          await updateCurrentEpisodePointer({ season, episode }, false);
        }
        props.showToast(`S${season} E${episode} marked unwatched`);
      }
    } catch (e) {
      setWatchedEpisodes(prev => ({ ...prev, [id]: { ...payload, watched: isWatched } }));
      props.showToast("Could not update episode. Try again.");
    }
  };

  const availableServers = createMemo(() => {
    const custom = customServers();
    const merged = [];
    DEFAULT_SERVERS.forEach(s => {
      const overrides = custom[s.id];
      if (!overrides || overrides.enabled !== false) {
        merged.push({ ...s, name: overrides?.name || s.name, movieUrl: overrides?.movieUrl || s.movieUrl, tvUrl: overrides?.tvUrl || s.tvUrl });
      }
    });
    Object.keys(custom).forEach(key => {
      if (!DEFAULT_SERVERS.find(s => s.id === key) && custom[key].enabled !== false) {
        merged.push({ id: key, name: custom[key].name || 'Custom Server', movieUrl: custom[key].movieUrl || '', tvUrl: custom[key].tvUrl || '', icon: 'add_link' });
      }
    });
    return merged;
  });

  createEffect(() => {
    const serversList = availableServers();
    if (serversList.length > 0 && !serversList.find(s => s.id === activeServer())) {
      setActiveServer(serversList[0].id);
    }
  });
  
  const { primePlaybackProgress, handlePlayerMessages, hydrateSessionProgressFromElapsed, saveProgressToDb } = progressControls;

  createEffect(() => {
      if (isResume() && movie() && !autoPlayTriggered) {
          const serversList = availableServers();
          if (serversList.length > 0) {
              autoPlayTriggered = true;
              const savedServer = movie().watchProgress?.server;
              if (savedServer && serversList.find(s => s.id === savedServer)) {
                  setActiveServer(savedServer);
              }
              setTimeout(() => {
                  // Failsafe injection
                  if (movie().watchProgress) {
                      if (movie().watchProgress.duration) setContentDuration(movie().watchProgress.duration);
                      setWatchProgress(movie().watchProgress);
                  } else {
                      const inferred = inferDurationSeconds();
                      if (inferred > 0) setContentDuration(inferred);
                      setWatchProgress({ currentTime: 0, duration: inferred });
                  }
                  setPlayerStartProgress(movie().watchProgress?.currentTime || 0);
                  setReceivedRealProgress(false);
                  setPlayerSessionStart(Date.now());
                  setShowPlayer(true);
              }, 200);
          }
      }
  });

  onMount(async () => {
    if (!props.isGuest) {
      try {
        const userDoc = await getDoc(doc(db, 'users', props.uid || 'unknown'));
        const customSettings = userDoc.data()?.customServers || {};
        setCustomServers(customSettings);
      } catch (e) {}
    }
  });


  createEffect(() => {
    if (movie()?.media_type !== 'tv') return;
    const seasons = tvSeasons();
    if (!seasons.length) return;
    const preferred = Number(movie().season || seasons[0].season_number || 1);
    const exists = seasons.some(s => Number(s.season_number) === preferred);
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

  const togglePlatform = (p) => { let curr = form().platforms.split(',').map(s=>s.trim()).filter(Boolean); if(curr.includes(p)) curr = curr.filter(x=>x!==p); else curr.push(p); setForm({...form(), platforms: curr.join(', ')}); };
  
  const saveChanges = async () => { 
    if (props.isGuest) {
      props.showToast("Sign in to save changes! 🔒");
      if (props.onLogin) props.onLogin();
      return;
    }
    const nextSeason = parseInt(form().season) || 1;
    const nextEpisode = parseInt(form().episode) || 1;
    const prevSeason = parseInt(movie().season) || 1;
    const prevEpisode = parseInt(movie().episode) || 1;
    const episodeChanged = movie().media_type === 'tv' && (nextSeason !== prevSeason || nextEpisode !== prevEpisode);

    const updates = { 
      status: form().status, 
      rating: parseFloat(form().rating)||0, 
      watchDate: form().watchDate, 
      seasonDates: form().seasonDates,
      notes: form().notes, 
      region: form().region, 
      season: nextSeason, 
      episode: nextEpisode, 
      tag: form().tag, 
      genresList: form().genres.split(',').map(s=>s.trim()).filter(Boolean), 
      platformsList: form().platforms.split(',').map(s=>cleanPlatform(s.trim())).filter(Boolean) 
    };

    if (episodeChanged) {
      const inferred = inferDurationSeconds();
      updates.watchProgress = {
        currentTime: 0,
        duration: inferred || 0,
        server: activeServer() || null,
        updatedAt: new Date().toISOString(),
        season: nextSeason,
        episode: nextEpisode
      };
      setWatchProgress({ currentTime: 0, duration: inferred || 0 });
      setPlayerStartProgress(0);
    }

    await updateWatchlistItem(props.uid, movie().id, updates); 
    props.showToast("Saved"); 
    setIsEdit(false); 
  };
  
  const isCompleted = createMemo(() => !isPreview() && (form().status || movie()?.status) === 'Completed');
  const progressPct = createMemo(() => {
    if (isCompleted()) return 100;
    const loadedSeasonTotal = getEpisodesForSeason(currentSeasonNumber()).length;
    const total = Number(movie()?.totalEps) || loadedSeasonTotal || 1;
    return Math.min((currentEpisodeNumber() / total) * 100, 100);
  });
  const movieFranchises = createMemo(() => props.franchises?.filter(f => movie()?.franchises?.[f.id] !== undefined).map(f => f.name).join(', '));

  const addToVaultFromPreview = async () => {
    if (props.isGuest) {
      props.showToast("Sign in to add to Vault! 🔒");
      if (props.onLogin) props.onLogin();
      return;
    }
    const item = movie();
    if ((props.watchlist || []).some(w => String(w.id) === String(item.id))) return props.showToast("Already in Vault! 🍿");
    props.showToast("Adding to Vault...");
    try {
      const castNames = details().credits?.cast?.slice(0, 5).map(c => c.name) || [];
      const director = details().credits?.crew?.find(c => c.job === 'Director')?.name || '';
      const castList = [...castNames, director].filter(Boolean);
      await addPreviewToWatchlist({ uid: props.uid, item, details: details() });
      props.showToast("Added to Vault! 🍿");
      props.onClose();
    } catch (err) {
      props.showToast("Error adding to vault.");
    }
  };
  
  const getStreamUrl = (serverId) => { 
    if (!serverId) return '';
    const id = movie().id; 
    const s = movie().media_type === 'tv' ? currentSeasonNumber() : (movie().season || 1);
    const e = movie().media_type === 'tv' ? currentEpisodeNumber() : (movie().episode || 1);
    const type = movie().media_type === 'tv' ? 'tv' : 'movie';
    
    const serverConfig = availableServers().find(srv => srv.id === serverId);
    if (!serverConfig) return '';
    
    let urlTemplate = type === 'tv' ? serverConfig.tvUrl : serverConfig.movieUrl;
    if(!urlTemplate) return '';
    
    let timeParam = '';
    const canResumeFromProgress = movie().watchProgress
      && movie().watchProgress.server === serverId
      && movie().watchProgress.currentTime > 0
      && (
        movie().media_type !== 'tv' ||
        (
          parseInt(movie().watchProgress.season || 1) === parseInt(movie().season || 1) &&
          parseInt(movie().watchProgress.episode || 1) === parseInt(movie().episode || 1)
        )
      );
    if (canResumeFromProgress) {
        const t = Math.floor(movie().watchProgress.currentTime);
        timeParam = urlTemplate.includes('?')
          ? `&t=${t}&start=${t}&time=${t}`
          : `?t=${t}&start=${t}&time=${t}`; 
    }
    
    return urlTemplate
      .replace(/\{id\}|\[TMDB_ID\]/gi, id)
      .replace(/\{season\}|\[SEASON\]/gi, s)
      .replace(/\{episode\}|\[EPISODE\]/gi, e) + timeParam;
  };

  return (
    <div class="fixed inset-0 z-[999999] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in" onClick={props.onClose}>
      <div class="absolute inset-0 bg-[#08090b] overflow-hidden pointer-events-none"><Show when={movie()?.backdrop_path}><img src={`https://image.tmdb.org/t/p/w500${movie().backdrop_path}`} class="w-full h-full object-cover opacity-40 blur-3xl scale-125" /></Show><div class="absolute inset-0 bg-black/60"></div></div>
      <Show when={movie()}>
        <div class="w-full max-w-xl lg:max-w-[800px] bg-[#08090b]/80 backdrop-blur-3xl rounded-t-[2.5rem] sm:rounded-[2.5rem] overflow-hidden border border-white/10 relative max-h-[95vh] shadow-[0_-10px_40px_rgba(0,0,0,0.5)] animate-pop-in flex flex-col" onClick={e=>e.stopPropagation()}>
          
          <button onClick={props.onClose} class="absolute top-4 right-4 z-[100] bg-black/50 backdrop-blur-md border border-white/10 p-2.5 rounded-full hover:bg-black/80 active:scale-95 transition-all"><Icon name="close" class="text-sm text-white"/></button>
          
          <div class="overflow-y-auto hide-scrollbar w-full">
              <DetailsHero movie={movie} playTrailer={playTrailer} setPlayTrailer={setPlayTrailer} trailerKey={trailerKey} />

              <div class="px-6 md:px-8 pb-28 -mt-16 relative z-10">
                <div class="flex justify-between items-start mb-2">
                    <div class="pr-2">
                        <h2 class="text-3xl font-black drop-shadow-md leading-tight">{movie().title || movie().name}</h2>
                        <p class="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-1">
                            {movie().release_date || details().release_date || 'N/A'} • {movie().media_type === 'tv' ? 'SERIES' : 'MOVIE'} 
                            <Show when={details().runtime || details().episode_run_time?.[0]}> • {formatRuntime(details().runtime || details().episode_run_time?.[0])}</Show>
                        </p>
                    </div>
                    <Show when={!isPreview()}>
                        <button onClick={()=>{
                            if (props.isGuest) {
                              props.showToast("Sign in to edit! 🔒");
                              if (props.onLogin) props.onLogin();
                              return;
                            }
                            setIsEdit(!isEdit())
                        }} class={`p-2.5 rounded-full border transition-colors shrink-0 ${isEdit() ? 'bg-[var(--primary)] text-[#0c0e14] border-[var(--primary)]' : 'glass-surface text-gray-400 hover:text-white'}`}><Icon name={isEdit()?'check':'edit'} class="text-sm"/></button>
                    </Show>
                </div>
                
                <RatingsPanel movie={movie} omdbData={omdbData} />

                <Show when={isEdit()} fallback={
                  <div class="animate-fade-in">
                    
                    <Show when={!isPreview()}>
                    <div class="mb-6 bg-black/40 backdrop-blur-md p-4 rounded-[1.5rem] border border-white/5 shadow-inner">
                        <div class="flex justify-between items-center mb-3 px-1">
                            <span class="text-[9px] uppercase font-black text-gray-400 tracking-widest flex items-center gap-1.5"><Icon name="router" class="text-[12px] text-[var(--primary)]"/> Streaming Node</span>
                        </div>
                        <div class="flex flex-wrap gap-2 pb-2 px-1">
                            <For each={availableServers()}>{(srv) => (
                                <button type="button" onClick={(e) => { e.stopPropagation(); setActiveServer(srv.id); }}
                                  class="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all"
                                  style={activeServer() === srv.id
                                    ? 'border: 1px solid var(--p); background: var(--p-dim); color: var(--p); transform: scale(1.05); box-shadow: 0 0 12px var(--p-glow)'
                                    : 'border: 1px solid var(--border); background: var(--raised); color: var(--muted)'}>
                                    <Icon name={srv.icon} class="text-[14px]" /> {srv.name}
                                </button>
                            )}</For>
                        </div>
                        
                        {/* THE FAILSAFE 'WATCH NOW' BUTTON */}
                        <button type="button" onClick={(e) => { 
                            e.preventDefault(); 
                            e.stopPropagation(); 
                            
                            primePlaybackProgress();
                            setShowPlayer(true); 
                        }}
                          class="w-full mt-3 font-black py-4 rounded-xl uppercase text-[11px] tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2"
                          style="background: var(--p); color: #05060a; box-shadow: 0 0 24px var(--p-glow)">
                            <Icon name="play_circle" fill class="text-[18px]"/> 
                            {movie().watchProgress && movie().watchProgress.currentTime > 0 ? 'Resume Movie' : 'Watch Now'}
                        </button>
                    </div>
                    </Show>

                    <p class="text-gray-400 text-sm mb-6 leading-relaxed italic border-l-2 border-[var(--primary)]/30 pl-3">"{details().overview || (typeof movie().overview === 'string' ? movie().overview : 'No overview available.')}"</p>
                    
                    <Show when={!isPreview() && movie().media_type === 'tv'}>
                        <div class="glass-surface rounded-[1.75rem] border border-white/10 mb-6 overflow-hidden shadow-2xl" style="background: linear-gradient(145deg, rgba(14,16,24,0.95), rgba(5,6,10,0.92)); border-color: var(--border-active)">
                            <div class="p-5 border-b border-white/5">
                                <div class="flex items-center justify-between gap-3 mb-4">
                                    <div>
                                        <p class="text-[10px] font-black uppercase tracking-[0.22em] flex items-center gap-2" style="color: var(--p)"><Icon name="live_tv" class="text-[15px]"/> Seasons & Episodes</p>
                                        <p class="text-[11px] text-gray-500 font-bold mt-1">Track every episode with latest TMDB season data.</p>
                                    </div>
                                    <Show when={movie().newSeasonAvailable}>
                                        <span class="shrink-0 text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border" style="color: var(--p); background: var(--p-dim); border-color: var(--p)">New Season</span>
                                    </Show>
                                </div>
                                <div class="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
                                    <For each={tvSeasons()}>
                                        {(s) => (
                                            <button type="button" onClick={() => setSelectedSeason(Number(s.season_number))}
                                                class="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border shrink-0 active:scale-95"
                                                style={Number(selectedSeason()) === Number(s.season_number)
                                                  ? 'background: var(--p); color: #05060a; border-color: var(--p); box-shadow: 0 0 16px var(--p-glow)'
                                                  : 'background: rgba(255,255,255,0.04); color: var(--muted); border-color: var(--border)'}>
                                                S{s.season_number}
                                            </button>
                                        )}
                                    </For>
                                </div>
                            </div>

                            <Show when={!seasonsLoading()} fallback={
                                <div class="p-4 space-y-3">
                                    <For each={[1,2,3]}>
                                      {() => <div class="h-28 rounded-2xl skeleton-bg border border-white/5" />}
                                    </For>
                                </div>
                            }>
                                <div class="p-4 space-y-3 max-h-[560px] overflow-y-auto hide-scrollbar">
                                    <Show when={selectedSeasonEpisodes().length > 0} fallback={
                                        <div class="text-center py-10">
                                            <Icon name="live_tv" class="text-4xl text-gray-700 mb-2" />
                                            <p class="text-xs font-bold text-gray-500">Episode data is not available yet.</p>
                                        </div>
                                    }>
                                        <For each={selectedSeasonEpisodes()}>
                                            {(ep) => {
                                                const epId = episodeDocId(ep.season_number || selectedSeason(), ep.episode_number);
                                                const watched = createMemo(() => !!watchedEpisodes()[epId]?.watched);
                                                const expanded = createMemo(() => !!expandedEpisodes()[epId]);
                                                return (
                                                  <div class="group rounded-2xl border border-white/5 bg-black/30 hover:bg-white/[0.035] hover:border-[var(--p)]/40 transition-all overflow-hidden">
                                                    <div class="flex gap-3 p-3">
                                                        <div class="relative w-28 sm:w-36 aspect-video rounded-xl overflow-hidden bg-[#11131b] shrink-0 border border-white/5">
                                                            <Show when={ep.still_path} fallback={<div class="w-full h-full skeleton-bg flex items-center justify-center"><Icon name="movie" class="text-2xl text-gray-700" /></div>}>
                                                                <img src={`https://image.tmdb.org/t/p/w300${ep.still_path}`} loading="lazy" class={`w-full h-full object-cover transition-all duration-300 ${watched() ? 'opacity-45 grayscale' : 'group-hover:scale-105'}`} />
                                                            </Show>
                                                            <Show when={watched()}>
                                                                <div class="absolute inset-0 flex items-center justify-center bg-black/20"><Icon name="check_circle" fill class="text-3xl" style="color: var(--p)" /></div>
                                                            </Show>
                                                        </div>
                                                        <div class="min-w-0 flex-1">
                                                            <div class="flex items-start justify-between gap-3">
                                                                <div class="min-w-0">
                                                                    <h4 class="font-black text-white text-sm leading-snug">E{ep.episode_number} — {ep.name || 'Untitled Episode'}</h4>
                                                                    <div class="flex flex-wrap gap-2 mt-1.5 text-[9px] font-bold uppercase tracking-widest text-gray-500">
                                                                        <span>{ep.air_date || 'Air date TBA'}</span>
                                                                        <Show when={ep.runtime}><span>• {ep.runtime} min</span></Show>
                                                                    </div>
                                                                </div>
                                                                <button type="button" onClick={(e) => { e.stopPropagation(); toggleEpisodeWatched(ep); }}
                                                                    class="shrink-0 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border active:scale-95"
                                                                    style={watched()
                                                                      ? 'background: var(--p2); color: #05060a; border-color: var(--p2); box-shadow: 0 0 16px rgba(255,255,255,0.08)'
                                                                      : 'background: var(--p-dim); color: var(--p); border-color: var(--p)'}>
                                                                    {watched() ? 'Watched ✓' : 'Watch'}
                                                                </button>
                                                            </div>
                                                            <button type="button" onClick={() => setExpandedEpisodes(prev => ({ ...prev, [epId]: !expanded() }))} class="text-left w-full mt-2">
                                                                <p class={`text-xs text-gray-400 leading-relaxed transition-all duration-300 ${expanded() ? '' : 'line-clamp-2'}`}>{ep.overview || 'No episode overview available.'}</p>
                                                                <span class="inline-flex items-center gap-1 mt-1 text-[9px] font-black uppercase tracking-widest" style="color: var(--p)">{expanded() ? 'Show less' : 'More'} <Icon name={expanded() ? 'expand_less' : 'expand_more'} class="text-xs" /></span>
                                                            </button>
                                                        </div>
                                                    </div>
                                                  </div>
                                                );
                                            }}
                                        </For>
                                    </Show>
                                </div>
                            </Show>
                        </div>
                    </Show>

                    <Show when={!isPreview() && movie().media_type === 'tv'}>
                        <div class="glass-surface p-5 rounded-2xl border border-white/5 mb-6">
                            <div class="flex justify-between items-center mb-3">
                                <span class="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2"><Icon name="video_library" class="text-[14px] text-[var(--primary)]"/> Tracker</span>
                                <span class="font-black text-sm text-white">{isCompleted() ? 'Completed' : `S${currentSeasonNumber()} E${currentEpisodeNumber()}`}</span>
                            </div>
                            <div class="w-full h-2 bg-black rounded-full overflow-hidden mb-4"><div class="h-full bg-[var(--primary)] transition-all shadow-[0_0_10px_var(--primary)]" style={{width:`${progressPct()}%`}}></div></div>
                            <Show when={!isCompleted()}>
                                <button onClick={() => toggleEpisodeWatched(getCurrentEpisode())} class="w-full rounded-xl py-2 text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all" style="background: var(--p-dim); color: var(--p); border: 1px solid var(--p)">Mark Current Watched → Next Episode</button>
                            </Show>
                        </div>
                    </Show>

                    <Show when={details().credits}>
                        <div class="mb-8">
                            <h3 class="text-[10px] font-black uppercase text-gray-500 tracking-widest mb-4">Cast & Crew</h3>
                            <div class="flex gap-5 overflow-x-auto hide-scrollbar pb-2">
                                <For each={details().credits.cast.slice(0, 8)}>{(c) => (
                                    <div onClick={() => setPersonId(c.id)} class="flex flex-col items-center min-w-[75px] shrink-0 cursor-pointer group">
                                        <img src={c.profile_path ? `https://image.tmdb.org/t/p/w200${c.profile_path}` : `https://api.dicebear.com/7.x/initials/svg?seed=${c.name}&backgroundColor=171921`} class="w-16 h-16 rounded-full object-cover border border-white/10 mb-2 shadow-lg bg-[#171921] group-hover:border-[var(--primary)] transition-colors" />
                                        <p class="text-[9px] font-black text-center text-white truncate w-full group-hover:text-[var(--primary)] transition-colors">{c.name}</p>
                                        <p class="text-[7px] text-gray-500 text-center uppercase truncate w-full font-bold mt-0.5">{c.character}</p>
                                    </div>
                                )}</For>
                                <For each={details().credits.crew.filter(x=>x.job==='Director' || x.job==='Producer').slice(0,3)}>{(c) => (
                                    <div onClick={() => setPersonId(c.id)} class="flex flex-col items-center min-w-[75px] shrink-0 cursor-pointer group">
                                        <img src={c.profile_path ? `https://image.tmdb.org/t/p/w200${c.profile_path}` : `https://api.dicebear.com/7.x/initials/svg?seed=${c.name}&backgroundColor=171921`} class="w-16 h-16 rounded-full object-cover border border-[var(--secondary)] mb-2 shadow-lg bg-[#171921] group-hover:border-[var(--primary)] transition-colors" />
                                        <p class="text-[9px] font-black text-center text-white truncate w-full group-hover:text-[var(--primary)] transition-colors">{c.name}</p>
                                        <p class="text-[7px] text-[var(--secondary)] text-center uppercase font-black tracking-widest mt-0.5">{c.job}</p>
                                    </div>
                                )}</For>
                            </div>
                        </div>
                    </Show>

                    <div class="glass-surface p-5 rounded-2xl space-y-4 border border-white/5">
                        <Show when={!isPreview()}><SafeInfoRow icon="adjust" label="Status" value={<span class="text-[var(--primary)] font-black uppercase text-[10px] tracking-widest">{movie().status||'Planned'}</span>} /></Show>
                        
                        <Show when={!isPreview() && (movie().media_type !== 'tv' || !movie().seasonDates || Object.keys(movie().seasonDates).length === 0)}>
                            <SafeInfoRow icon="calendar_today" label="Watch Date" value={<span class="text-xs text-gray-300">{movie().watchDate || 'Not set'}</span>} />
                        </Show>

                        <Show when={!isPreview()}><SafeInfoRow icon="public" label="Region" value={movie().region || 'International'} /></Show>
                        <SafeInfoRow icon="format_list_bulleted" label="Genre" value={<span class="text-xs text-gray-300">{details().genres ? details().genres.map(g => g.name).join(', ') : (getSafeGenres(movie()).join(', ') || 'N/A')}</span>} />
                        
                        <SafeInfoRow icon="connected_tv" label="Available On" value={
                            <Show when={richPlatforms().length > 0} fallback={<span class="text-xs font-bold text-gray-500">-</span>}>
                                <div class="flex flex-wrap gap-2 mt-1">
                                    <For each={richPlatforms().slice(0, 6)}>{(p) => (
                                        <a href={p.url} target="_blank" rel="noopener noreferrer" title={p.name} class="flex flex-col items-center gap-1 bg-white/5 hover:bg-[var(--primary)]/20 border border-white/10 hover:border-[var(--primary)]/50 px-2 py-2 rounded-xl transition-all group shadow-sm min-w-[58px]">
                                            <Show when={!p.isCss && p.logo} fallback={
                                                <div class="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black shadow-inner" style={{ "background-color": p.color || 'var(--p-dim)', color: p.color === '#ffffff' ? '#000' : 'var(--p)' }}>
                                                    {p.name.charAt(0).toUpperCase()}
                                                </div>
                                            }>
                                                <img src={p.logo} alt={p.name} class="w-7 h-7 rounded-lg object-cover bg-black border border-white/10" loading="lazy" />
                                            </Show>
                                            <span class="text-[8px] font-black text-gray-300 group-hover:text-white uppercase tracking-widest max-w-[54px] truncate">{p.name}</span>
                                        </a>
                                    )}</For>
                                </div>
                            </Show>
                        } />
                        
                        <Show when={!isPreview() && movie().tag}><SafeInfoRow icon="label" label="Tag" value={<span class="text-[9px] font-black uppercase tracking-widest bg-white/10 text-white px-2 py-0.5 rounded border border-white/20">{movie().tag}</span>} /></Show>
                        <Show when={!isPreview() && movieFranchises()}><SafeInfoRow icon="folder_special" label="Lists" value={<span class="text-xs font-bold text-white">{movieFranchises()}</span>} /></Show>
                        <Show when={!isPreview() && movie().notes && typeof movie().notes === 'string'}><div class="border-t border-white/5 pt-3 mt-3"><p class="text-[10px] uppercase font-black text-gray-500 tracking-widest mb-1 flex items-center gap-1"><Icon name="edit_note" class="text-[14px]"/> Notes</p><p class="text-sm text-gray-300 italic">"{movie().notes}"</p></div></Show>

                        <SimilarItems items={similarItems} onSelect={(item) => { setOverrideItem({ ...item, media_type: item.media_type || (movie().media_type === 'tv' ? 'tv' : 'movie') }); document.querySelector('.overflow-y-auto.hide-scrollbar.w-full')?.scrollTo({ top: 0, behavior: 'smooth' }); }} />

                        <Show when={!isPreview() && movie().media_type === 'tv' && movie().seasonDates && Object.keys(movie().seasonDates).some(k => movie().seasonDates[k].start || movie().seasonDates[k].end)}>
                            <div class="border-t border-white/5 pt-4 mt-2">
                                <p class="text-[10px] uppercase font-black text-[var(--primary)] tracking-widest mb-2 flex items-center gap-1.5"><Icon name="history" class="text-[14px]"/> Season Timeline</p>
                                <div class="space-y-1.5">
                                    <For each={Object.entries(movie().seasonDates).filter(e => e[1].start || e[1].end).sort((a,b)=>Number(a[0])-Number(b[0]))}>
                                        {([s, d]) => {
                                            const days = calculateDays(d.start, d.end);
                                            const formatD = (ds) => ds ? new Date(ds).toLocaleDateString('en-GB', {day:'2-digit', month:'short', year:'2-digit'}) : 'Present';
                                            return (
                                                <div class="flex justify-between items-center bg-black/40 px-3 py-2 rounded-xl border border-white/5 shadow-inner">
                                                    <span class="text-[10px] font-black text-white tracking-widest uppercase">Season {s}</span>
                                                    <div class="flex items-center gap-2.5">
                                                        <span class="text-[9px] text-gray-300 font-bold tracking-wider flex items-center gap-1.5">
                                                            {formatD(d.start)} <Icon name="arrow_forward" class="text-[10px] text-gray-500"/> {d.end ? formatD(d.end) : <span class="text-gray-500">Present</span>}
                                                        </span>
                                                        <Show when={days !== null}>
                                                            <span class="text-[8px] bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20 px-1.5 py-0.5 rounded font-black uppercase tracking-widest shadow-sm">{days} Day{days !== 1 ? 's' : ''}</span>
                                                        </Show>
                                                    </div>
                                                </div>
                                            );
                                        }}
                                    </For>
                                </div>
                            </div>
                        </Show>
                    </div>

                    <Show when={isPreview()}>
                        <button onClick={addToVaultFromPreview} class="w-full mt-6 font-black py-4 px-5 rounded-xl text-xs uppercase tracking-widest active:scale-95 transition-transform flex items-center justify-center gap-2 border" style="background: var(--p); color: #05060a; border-color: var(--p); box-shadow: 0 0 24px var(--p-glow); min-height: 52px; opacity: 1; visibility: visible">
                            <Icon name="add_circle" class="text-lg"/> Add to My Universe
                        </button>
                    </Show>
                    <Show when={!isPreview()}>
                        <div class="mt-8 flex justify-end"><button onClick={async () => { 
                            if (props.isGuest) {
                              props.showToast("Sign in to edit vault! 🔒");
                              if (props.onLogin) props.onLogin();
                              return;
                            }
                            if(confirm("Permanently delete?")) { await deleteWatchlistItem(props.uid, movie().id); props.showToast("Deleted"); props.onClose(); } 
                          }} class="text-red-500/50 hover:text-red-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-1 transition-colors mx-auto active:scale-95"><Icon name="delete" class="text-sm"/> Remove from Universe</button></div>
                    </Show>
                  </div>
                }>
                  <div class="glass-surface p-6 rounded-2xl space-y-4 animate-fade-in border border-[var(--primary)]/30 mt-4 shadow-lg shadow-[var(--primary)]/10">
                    <div class="grid grid-cols-2 gap-4">
                        <div><label class="text-[9px] uppercase font-black text-gray-500 mb-1 block tracking-widest">Status</label><select value={form().status} onChange={e=>setForm({...form(), status: e.target.value})} class="w-full bg-[#0c0e14] border border-white/10 p-2.5 rounded-xl text-sm text-white outline-none focus:border-[var(--primary)]"><option value="Planned">Planned</option><option value="Watching">Watching</option><option value="Completed">Completed</option></select></div>
                        <div><label class="text-[9px] uppercase font-black text-gray-500 mb-1 block tracking-widest">Personal Rating</label><input type="number" step="0.1" min="0" max="10" value={form().rating} onChange={e=>setForm({...form(), rating: e.target.value})} class="w-full bg-[#0c0e14] border border-white/10 p-2.5 rounded-xl text-sm text-white outline-none focus:border-[var(--primary)]"/></div>
                    </div>
                    
                    <Show when={movie().media_type === 'tv'}>
                        <div class="grid grid-cols-2 gap-4">
                            <div><label class="text-[9px] uppercase font-black text-gray-500 mb-1 block tracking-widest">Season</label><input type="number" value={form().season} onInput={e=>setForm({...form(), season: e.target.value})} class="w-full bg-[#0c0e14] border border-white/10 p-2.5 rounded-xl text-sm text-white outline-none focus:border-[var(--primary)]"/></div>
                            <div><label class="text-[9px] uppercase font-black text-gray-500 mb-1 block tracking-widest">Episode</label><input type="number" value={form().episode} onInput={e=>setForm({...form(), episode: e.target.value})} class="w-full bg-[#0c0e14] border border-white/10 p-2.5 rounded-xl text-sm text-white outline-none focus:border-[var(--primary)]"/></div>
                        </div>
                    </Show>
                    
                    <div class="grid grid-cols-2 gap-4">
                        <Show when={movie().media_type === 'movie'}>
                            <div><label class="text-[9px] uppercase font-black text-gray-500 mb-1 block tracking-widest">Watch Date</label><input type="date" value={form().watchDate} onInput={e=>setForm({...form(), watchDate: e.target.value})} class="w-full bg-[#0c0e14] border border-white/10 p-2.5 rounded-xl text-sm text-white [color-scheme:dark] outline-none focus:border-[var(--primary)]"/></div>
                        </Show>
                        <div class={movie().media_type === 'tv' ? 'col-span-2' : ''}><label class="text-[9px] uppercase font-black text-gray-500 mb-1 block tracking-widest">Region</label><select value={form().region} onChange={e=>setForm({...form(), region: e.target.value})} class="w-full bg-[#0c0e14] border border-white/10 p-2.5 rounded-xl text-sm text-white outline-none focus:border-[var(--primary)]"><option>International</option><option>Indian</option></select></div>
                    </div>

                    <Show when={movie().media_type === 'tv'}>
                        <div class="mt-4">
                            <label class="text-[9px] uppercase font-black text-gray-500 mb-2 block tracking-widest flex items-center gap-1"><Icon name="history" class="text-[14px]"/> Season Timelines</label>
                            <div class="space-y-2 bg-black/40 p-3 rounded-2xl border border-white/5 shadow-inner max-h-48 overflow-y-auto hide-scrollbar">
                                <For each={Array.from({length: Math.max(1, parseInt(form().season) || 1)})}>
                                    {(_, i) => {
                                        const s = i() + 1;
                                        const d = form().seasonDates[s] || { start: '', end: '' };
                                        return (
                                            <div class="flex flex-col sm:flex-row sm:items-center gap-2 bg-[#0c0e14] p-2 rounded-xl border border-white/5">
                                                <span class="text-[10px] font-black text-[var(--primary)] w-8 text-center bg-[var(--primary)]/10 py-1 rounded-md">S{s}</span>
                                                <div class="flex flex-1 items-center gap-2">
                                                    <div class="flex-1">
                                                        <input type="date" value={d.start} onInput={e => setForm(prev => ({...prev, seasonDates: {...prev.seasonDates, [s]: {...(prev.seasonDates[s]||{}), start: e.target.value}}}))} class="w-full bg-transparent border-b border-white/10 p-1 text-xs text-white [color-scheme:dark] outline-none focus:border-[var(--primary)] transition-colors" title={`Season ${s} Start Date`}/>
                                                    </div>
                                                    <Icon name="arrow_forward" class="text-gray-600 text-[12px]"/>
                                                    <div class="flex-1">
                                                        <input type="date" value={d.end} onInput={e => setForm(prev => ({...prev, seasonDates: {...prev.seasonDates, [s]: {...(prev.seasonDates[s]||{}), end: e.target.value}}}))} class="w-full bg-transparent border-b border-white/10 p-1 text-xs text-white [color-scheme:dark] outline-none focus:border-[var(--primary)] transition-colors" title={`Season ${s} End Date`}/>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    }}
                                </For>
                            </div>
                        </div>
                    </Show>

                    <div><label class="text-[9px] uppercase font-black text-gray-500 mb-1 block tracking-widest">Custom Tag</label><input placeholder="e.g. Theatre" value={form().tag} onInput={e=>setForm({...form(), tag: e.target.value})} class="w-full bg-[#0c0e14] border border-white/10 p-2.5 rounded-xl text-sm text-white outline-none focus:border-[var(--primary)] placeholder-gray-700"/></div>
                    <div><label class="text-[9px] uppercase font-black text-gray-500 mb-1 block tracking-widest">Available Platforms</label><div class="flex flex-wrap gap-2 p-3 bg-[#0c0e14] border border-white/5 rounded-xl"><For each={allAvailablePlatforms()}>{p => <button type="button" onClick={()=>togglePlatform(p)} class={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-colors shadow-sm active:scale-95 ${form().platforms.split(',').map(s=>s.trim()).includes(p) ? 'bg-gradient-to-tr from-[var(--secondary)] to-[var(--primary)] text-[#0c0e14]' : 'bg-white/5 text-gray-400 hover:text-white border border-white/5'}`}>{p}</button>}</For></div></div>
                    <div><label class="text-[9px] uppercase font-black text-gray-500 mb-1 block tracking-widest">Genres (Comma separated)</label><input value={form().genres || (details().genres ? details().genres.map(g=>g.name).join(', ') : '')} onInput={e=>setForm({...form(), genres: e.target.value})} class="w-full bg-[#0c0e14] border border-white/10 p-2.5 rounded-xl text-sm text-white outline-none focus:border-[var(--primary)]"/></div>
                    <div><label class="text-[9px] uppercase font-black text-gray-500 mb-1 block tracking-widest">My Notes</label><textarea value={form().notes} onInput={e=>setForm({...form(), notes: e.target.value})} class="w-full bg-[#0c0e14] border border-white/10 p-2.5 rounded-xl text-sm text-white outline-none focus:border-[var(--primary)] placeholder-gray-700" rows="3" placeholder="Write your thoughts..."></textarea></div>
                    <button onClick={saveChanges} class="w-full font-black py-4 rounded-xl text-[10px] uppercase tracking-widest mt-2 active:scale-95 transition-all flex items-center justify-center gap-2" style="background: var(--p); color: #05060a; box-shadow: 0 0 28px var(--p-glow), 0 4px 16px rgba(0,0,0,0.4)">Save Universe Changes</button>
                  </div>
                </Show>
              </div>
          </div>
        </div>
      </Show>

      {/* Fullscreen Player Modal */}
      <Show when={showPlayer()}>
        <div class="fixed inset-0 bg-black z-[10000000] flex flex-col animate-fade-in" onClick={(e)=>e.stopPropagation()}>
          <div class="p-4 flex justify-between items-center bg-[#0c0e14] border-b border-white/5 shadow-xl">
            <div class="flex items-center gap-3 overflow-hidden pr-2 flex-1">
                <button type="button" onClick={(e) => { 
                    e.stopPropagation(); 
                    hydrateSessionProgressFromElapsed();
                    saveProgressToDb();
                    setPlayerSessionStart(null);
                    setPlayerStartProgress(0);
                    setShowPlayer(false); 
                }} class="p-2 bg-white/5 hover:bg-white/10 rounded-full active:scale-95 transition-all shrink-0"><Icon name="arrow_back" class="text-sm" /></button>
                <h3 class="font-bold text-sm text-white truncate max-w-[150px]">{movie().title || movie().name}</h3>
            </div>
            
            <div class="flex gap-2 shrink-0">
                <div class="relative bg-white/5 border border-white/10 rounded-xl px-2 py-1.5 flex items-center gap-1 hover:bg-white/10 transition-colors">
                    <Icon name="router" class="text-gray-400 text-[14px]" />
                    <select value={activeServer()} onChange={(e) => { e.stopPropagation(); setActiveServer(e.target.value); }} class="bg-transparent text-[10px] font-black uppercase tracking-widest text-[var(--primary)] outline-none appearance-none cursor-pointer pr-4 pl-1">
                        <For each={availableServers()}>{(srv) => <option value={srv.id} class="bg-[#0c0e14] text-white">{srv.name}</option>}</For>
                    </select>
                    <Icon name="expand_more" class="text-gray-400 text-[14px] absolute right-1 pointer-events-none" />
                </div>
            </div>
          </div>
          <div class="flex-1 bg-black w-full h-full relative">
            <div class="absolute inset-0 flex flex-col gap-3 items-center justify-center pointer-events-none opacity-50"><Icon name="dns" class="text-[var(--primary)] text-4xl animate-pulse"/><p class="text-[10px] uppercase font-black tracking-widest text-[var(--primary)]">Connecting to Node...</p></div>
            <iframe src={getStreamUrl(activeServer())} class="w-full h-full border-none relative z-10" allowfullscreen ></iframe>
          </div>
        </div>
      </Show>

      {/* Person Modal Overlay */}
      <Show when={personId()}>
        <PersonModal
          personId={personId()}
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
              props.showToast(`Search for ${item.title || item.name} to view details!`);
            }
          }}
        />
      </Show>

    </div>
  );
}
