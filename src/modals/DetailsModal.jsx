import { createSignal, createEffect, createMemo, onMount, onCleanup, Show, For } from 'solid-js';
import { collection, doc, updateDoc, deleteDoc, setDoc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Icon, cleanPlatform, getSafeGenres, getSafePlatforms, TMDB_KEY, OMDB_KEY, fetchTmdbWatchProviders } from '../utils';

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

const DEFAULT_SERVERS = [
  { id: 'vidzee', name: 'VidZee (Fast)', movieUrl: 'https://player.vidzee.wtf/embed/movie/{id}', tvUrl: 'https://player.vidzee.wtf/embed/tv/{id}/{season}/{episode}', icon: 'smart_display' },
  { id: 'vidlink', name: 'VidLink', movieUrl: 'https://vidlink.pro/movie/{id}?primaryColor=b1a1ff&autoplay=false', tvUrl: 'https://vidlink.pro/tv/{id}/{season}/{episode}?primaryColor=b1a1ff&autoplay=false', icon: 'play_circle' },
  { id: 'vidsrcru', name: 'Vidsrc.ru', movieUrl: 'https://vidsrc.ru/movie/{id}?autoplay=true&colour=b1a1ff', tvUrl: 'https://vidsrc.ru/tv/{id}/{season}/{episode}?autoplay=true&colour=b1a1ff&autonextepisode=true', icon: 'dns' },
  { id: 'peachify', name: 'Peachify', movieUrl: 'https://peachify.top/embed/movie/{id}?accent=b1a1ff', tvUrl: 'https://peachify.top/embed/tv/{id}/{season}/{episode}?accent=b1a1ff', icon: 'stream' },
  { id: 'vidsrccc', name: 'Vidsrc.cc', movieUrl: 'https://vidsrc.cc/v2/embed/movie/{id}', tvUrl: 'https://vidsrc.cc/v2/embed/tv/{id}/{season}/{episode}', icon: 'dynamic_feed' },
  { id: 'autoembed', name: 'AutoEmbed', movieUrl: 'https://autoembed.co/movie/tmdb/{id}', tvUrl: 'https://autoembed.co/tv/tmdb/{id}-{season}-{episode}', icon: 'bolt' },
  { id: 'vidnest', name: 'VidNest (Official)', movieUrl: 'https://vidnest.fun/movie/{id}', tvUrl: 'https://vidnest.fun/tv/{id}/{season}/{episode}', icon: 'play_circle' }
];

const getPlatformDict = (title, platformName) => {
    const enc = encodeURIComponent(title || '');
    const cleanN = platformName ? platformName.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
    const dbData = {
        'netflix': { name: 'Netflix', logo: 'https://image.tmdb.org/t/p/w92/t2yyOv40HZeVlLjVrCsPhIdZfC4.jpg', url: `https://www.netflix.com/search?q=${enc}` },
        'amazonprimevideo': { name: 'Amazon Prime Video', logo: 'https://image.tmdb.org/t/p/w92/5NyLm42TmCqCMOZFvH4fvn2FI11.jpg', url: `https://www.primevideo.com/search/ref=atv_sr_sug_sc?phrase=${enc}` },
        'primevideo': { name: 'Amazon Prime Video', logo: 'https://image.tmdb.org/t/p/w92/5NyLm42TmCqCMOZFvH4fvn2FI11.jpg', url: `https://www.primevideo.com/search/ref=atv_sr_sug_sc?phrase=${enc}` },
        'amazon': { name: 'Amazon Prime Video', logo: 'https://image.tmdb.org/t/p/w92/5NyLm42TmCqCMOZFvH4fvn2FI11.jpg', url: `https://www.primevideo.com/search/ref=atv_sr_sug_sc?phrase=${enc}` },
        'jiohotstar': { name: 'JioHotstar', logo: 'https://image.tmdb.org/t/p/w92/uzKjVDmQIA2rZGSNpGbnWXUWVQIM.jpg', url: `https://www.hotstar.com/in/explore?searchQuery=${enc}` },
        'hotstar': { name: 'JioHotstar', logo: 'https://image.tmdb.org/t/p/w92/uzKjVDmQIA2rZGSNpGbnWXUWVQIM.jpg', url: `https://www.hotstar.com/in/explore?searchQuery=${enc}` },
        'sonyliv': { name: 'Sony LIV', logo: 'https://image.tmdb.org/t/p/w92/8N0DNa4BO3lH24KWv1EjJh4TxGL.jpg', url: `https://www.sonyliv.com/` },
        'zee5': { name: 'Zee5', logo: 'https://image.tmdb.org/t/p/w92/5vVzg0rtZAwQGzQoT2Zk0n43Nym.jpg', url: `https://www.zee5.com/global/search?q=${enc}` },
        'appletv': { name: 'Apple TV', logo: 'https://image.tmdb.org/t/p/w92/2E0ficP6ijhlCSJuwHI4isW0QhD.jpg', url: `https://tv.apple.com/` },
        'crunchyroll': { name: 'Crunchyroll', logo: 'https://image.tmdb.org/t/p/w92/mXeC4TrcgdU6j81XreWIjA6k7yC.jpg', url: `https://www.crunchyroll.com/search?q=${enc}` },
        'youtube': { name: 'YouTube', logo: 'https://image.tmdb.org/t/p/w92/p3Z12gKq2qvJaUOMeKNU2mzKVI9.jpg', url: `https://www.youtube.com/results?search_query=${enc}` }
    };
    return dbData[cleanN] || null;
};

const getBrandColor = (name) => {
    const n = name.toLowerCase();
    if(n.includes('vi ')) return '#ed1c24'; 
    if(n.includes('aha')) return '#ff6600'; 
    if(n.includes('hoichoi')) return '#e50b14'; 
    if(n.includes('sun')) return '#f09a36'; 
    if(n.includes('voot')) return '#5a2282'; 
    if(n.includes('mx')) return '#003366'; 
    if(n.includes('ullu')) return '#00b0b8'; 
    if(n.includes('alt')) return '#e30f1d'; 
    if(n.includes('eros')) return '#ff0000'; 
    if(n.includes('apple')) return '#ffffff'; 
    if(n.includes('discovery')) return '#001e61'; 
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return `hsl(${Math.abs(hash) % 360}, 70%, 45%)`;
};

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
  
  const [details, setDetails] = createSignal({});
  const [isEdit, setIsEdit] = createSignal(false); 
  const [trailerKey, setTrailerKey] = createSignal(null); 
  const [playTrailer, setPlayTrailer] = createSignal(false);
  const [showPlayer, setShowPlayer] = createSignal(false); 
  const [activeServer, setActiveServer] = createSignal(null); 
  const [personId, setPersonId] = createSignal(null); 
  const [omdbData, setOmdbData] = createSignal({ imdb: '-', rt: '-' });
  const [form, setForm] = createSignal({ status: '', rating: '', watchDate: '', notes: '', region: '', season: 1, episode: 1, tag: '', platforms: '', genres: '', seasonDates: {} });
  
  const [directPlayUrl, setDirectPlayUrl] = createSignal(localStorage.getItem('cinelog_direct_play_url') || '');
  const [isEditingDirectUrl, setIsEditingDirectUrl] = createSignal(false);

  const [richPlatforms, setRichPlatforms] = createSignal([]);
  const [customServers, setCustomServers] = createSignal({});
  const [similarItems, setSimilarItems] = createSignal([]);
  
  const [watchProgress, setWatchProgress] = createSignal(null);
  const [contentDuration, setContentDuration] = createSignal(0);
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

  const tvSeasons = createMemo(() => (details().seasons || []).filter(s => Number(s.season_number) > 0).sort((a, b) => Number(a.season_number) - Number(b.season_number)));
  const selectedSeasonEpisodes = createMemo(() => seasonEpisodes()[selectedSeason()]?.episodes || []);
  const currentSeasonNumber = createMemo(() => parseInt(form().season || movie()?.season || 1) || 1);
  const currentEpisodeNumber = createMemo(() => parseInt(form().episode || movie()?.episode || 1) || 1);
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
  const getStoredSeasonCache = () => { try { return JSON.parse(localStorage.getItem(seasonCacheKey()) || '{}'); } catch (e) { return {}; } };
  const writeStoredSeasonCache = (cache) => { try { localStorage.setItem(seasonCacheKey(), JSON.stringify(cache)); } catch (e) {} };

  const loadWatchedEpisodes = async () => {
    if (props.isGuest || !props.uid || isPreview() || movie()?.media_type !== 'tv') return;
    try {
      const snap = await getDocs(collection(db, 'users', props.uid, 'watchlist', String(movie().id), 'episodes'));
      const next = {}; snap.docs.forEach(d => { next[d.id] = d.data(); }); setWatchedEpisodes(next);
    } catch (e) {}
  };

  const fetchSeasonEpisodes = async (seasonNumber, forceRefresh = false) => {
    if (!movie()?.id || movie()?.media_type !== 'tv' || !seasonNumber) return;
    const cache = getStoredSeasonCache();
    const cachedSeason = cache?.seasons?.[seasonNumber];
    if (!forceRefresh && cacheIsFresh(cache) && cachedSeason) { setSeasonEpisodes(prev => ({ ...prev, [seasonNumber]: cachedSeason })); return; }
    setSeasonsLoading(true);
    try {
      const res = await fetch(`https://api.themoviedb.org/3/tv/${movie().id}/season/${seasonNumber}?api_key=${TMDB_KEY}`);
      if (!res.ok) throw new Error('season fetch failed');
      const season = await res.json();
      const nextCache = { timestamp: Date.now(), seasons: { ...(cache.seasons || {}), [seasonNumber]: season } };
      writeStoredSeasonCache(nextCache);
      setSeasonEpisodes(prev => ({ ...prev, [seasonNumber]: season }));
    } catch (e) {
      if (cachedSeason) setSeasonEpisodes(prev => ({ ...prev, [seasonNumber]: cachedSeason }));
    } finally { setSeasonsLoading(false); }
  };

  const updateCurrentEpisodePointer = async (nextPointer, completed = false) => {
    const nextSeason = Number(nextPointer?.season || currentSeasonNumber());
    const nextEpisode = Number(nextPointer?.episode || currentEpisodeNumber());
    const nextStatus = completed ? 'Completed' : (movie()?.status === 'Planned' || movie()?.status === 'Plan to Watch' || movie()?.status === 'Completed' ? 'Watching' : (movie()?.status || 'Watching'));
    const nextProgress = { currentTime: 0, duration: inferDurationSeconds() || 0, server: activeServer() || null, updatedAt: new Date().toISOString(), season: nextSeason, episode: nextEpisode };
    setForm(prev => ({ ...prev, season: nextSeason, episode: nextEpisode, status: nextStatus }));
    setWatchProgress(nextProgress); setPlayerStartProgress(0);
    if (!props.isGuest && props.uid && movie() && !isPreview()) {
      await updateDoc(doc(db, 'users', props.uid, 'watchlist', String(movie().id)), { season: nextSeason, episode: nextEpisode, status: nextStatus, watchProgress: nextProgress });
    }
  };

  const toggleEpisodeWatched = async (ep) => {
    if (props.isGuest) { props.showToast("Sign in to track episodes! 🔒"); if (props.onLogin) props.onLogin(); return; }
    if (!props.uid || !movie() || !ep) return;
    const season = Number(ep.season_number || selectedSeason() || currentSeasonNumber());
    const episode = Number(ep.episode_number || 1);
    const id = episodeDocId(season, episode);
    const isWatched = !!watchedEpisodes()[id]?.watched;
    const nextWatched = !isWatched;
    const payload = { watched: nextWatched, season, episode, episodeId: id, title: ep.name || '', airDate: ep.air_date || '', runtime: ep.runtime || null, updatedAt: new Date().toISOString() };
    setWatchedEpisodes(prev => ({ ...prev, [id]: payload }));
    try {
      await setDoc(doc(db, 'users', props.uid, 'watchlist', String(movie().id), 'episodes', id), payload, { merge: true });
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
    const custom = customServers(); const merged = [];
    DEFAULT_SERVERS.forEach(s => { const overrides = custom[s.id]; if (!overrides || overrides.enabled !== false) { merged.push({ ...s, name: overrides?.name || s.name, movieUrl: overrides?.movieUrl || s.tvUrl, tvUrl: overrides?.tvUrl || s.tvUrl }); } });
    Object.keys(custom).forEach(key => { if (!DEFAULT_SERVERS.find(s => s.id === key) && custom[key].enabled !== false) { merged.push({ id: key, name: custom[key].name || 'Custom Server', movieUrl: custom[key].movieUrl || '', tvUrl: custom[key].tvUrl || '', icon: 'add_link' }); } });
    return merged;
  });

  createEffect(() => {
    const serversList = availableServers();
    if (serversList.length > 0 && !serversList.find(s => s.id === activeServer()) && activeServer() !== 'DIRECT_PLAY') { setActiveServer(serversList[0].id); }
  });
  
  const handlePlayerMessages = (event) => {
    try {
        if (event.data?.source?.includes('react-devtools')) return; 
        let msg = event.data; if (typeof msg === 'string') msg = JSON.parse(msg);
        if (msg?.type === 'MEDIA_DATA' && msg?.data) {
            const cTime = msg.data.currentTime || msg.data.time || 0; const dur = msg.data.duration || contentDuration() || inferDurationSeconds() || 0;
            if (cTime > 0) { if (dur > 0) setContentDuration(dur); setReceivedRealProgress(true); setWatchProgress({ currentTime: cTime, duration: dur }); }
        } else if (msg?.event === 'timeupdate' && msg?.currentTime) {
            const dur = msg.duration || contentDuration() || inferDurationSeconds() || 0;
            if (msg.currentTime > 0) { if (dur > 0) setContentDuration(dur); setReceivedRealProgress(true); setWatchProgress({ currentTime: msg.currentTime, duration: dur }); }
        } else if (msg?.currentTime !== undefined && typeof msg.currentTime === 'number') {
            const dur = msg.duration || contentDuration() || inferDurationSeconds() || 0;
            if (msg.currentTime > 0) { if (dur > 0) setContentDuration(dur); setReceivedRealProgress(true); setWatchProgress({ currentTime: msg.currentTime, duration: dur }); }
        }
    } catch (e) {}
  };

  const saveProgressToDb = async () => {
      const prog = watchProgress();
      if (prog && prog.currentTime > 0 && !props.isGuest && movie() && !isPreview()) {
          try {
              const updates = { watchProgress: { currentTime: prog.currentTime, duration: prog.duration || contentDuration() || inferDurationSeconds() || 0, server: activeServer(), updatedAt: new Date().toISOString(), season: currentSeasonNumber(), episode: currentEpisodeNumber() } };
              if (movie().status === 'Planned' || movie().status === 'Plan to Watch') updates.status = 'Watching';
              await updateDoc(doc(db, 'users', props.uid, 'watchlist', String(movie().id)), updates);
              if(props.showToast) props.showToast("Progress Saved! 🍿"); setWatchProgress(null); 
          } catch (e) {}
      }
  };

  const hydrateSessionProgressFromElapsed = () => {
    const startedAt = playerSessionStart(); if (!startedAt || receivedRealProgress()) return; 
    const elapsed = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
    if (elapsed < 60) return; 
    const base = Math.max(0, Number(playerStartProgress()) || 0);
    const dur = contentDuration() || watchProgress()?.duration || inferDurationSeconds() || 0;
    const next = dur > 0 ? Math.min(base + elapsed, dur) : base + elapsed;
    if (next > base) setWatchProgress({ currentTime: next, duration: dur });
  };

  createEffect(() => {
      if (isResume() && movie() && !autoPlayTriggered) {
          const serversList = availableServers();
          if (serversList.length > 0) {
              autoPlayTriggered = true;
              const savedServer = movie().watchProgress?.server;
              if (savedServer && (serversList.find(s => s.id === savedServer) || savedServer === 'DIRECT_PLAY')) setActiveServer(savedServer);
              setTimeout(() => {
                  if (movie().watchProgress) { if (movie().watchProgress.duration) setContentDuration(movie().watchProgress.duration); setWatchProgress(movie().watchProgress); } 
                  else { const inferred = inferDurationSeconds(); if (inferred > 0) setContentDuration(inferred); setWatchProgress({ currentTime: 0, duration: inferred }); }
                  setPlayerStartProgress(movie().watchProgress?.currentTime || 0); setReceivedRealProgress(false); setPlayerSessionStart(Date.now()); setShowPlayer(true);
              }, 200);
          }
      }
  });

  onMount(async () => { if (!props.isGuest) { try { const userDoc = await getDoc(doc(db, 'users', props.uid || 'unknown')); setCustomServers(userDoc.data()?.customServers || {}); } catch (e) {} } });
  createEffect(() => { if (movie()?.media_type !== 'tv') return; const seasons = tvSeasons(); if (!seasons.length) return; const preferred = Number(movie().season || seasons[0].season_number || 1); const exists = seasons.some(s => Number(s.season_number) === preferred); if (!selectedSeason()) setSelectedSeason(exists ? preferred : Number(seasons[0].season_number)); });
  createEffect(() => { const seasonNumber = selectedSeason(); if (movie()?.media_type === 'tv' && seasonNumber) fetchSeasonEpisodes(seasonNumber); });
  createEffect(() => { const m = movie(); if (m?.media_type === 'tv' && !isPreview()) loadWatchedEpisodes(); });
  
  createEffect(() => {
    const m = movie(); if (!m?.id) { setSimilarItems([]); return; }
    const mediaType = m.media_type === 'tv' ? 'tv' : 'movie';
    fetch(`https://api.themoviedb.org/3/${mediaType}/${m.id}/recommendations?api_key=${TMDB_KEY}&language=en-US&page=1`).then(r => r.json()).then(d => {
        let results = (d.results || []).filter(x => x.poster_path).slice(0, 12);
        if (results.length === 0) fetch(`https://api.themoviedb.org/3/${mediaType}/${m.id}/similar?api_key=${TMDB_KEY}&language=en-US&page=1`).then(r => r.json()).then(d2 => setSimilarItems((d2.results || []).filter(x => x.poster_path).slice(0, 12))).catch(() => setSimilarItems([]));
        else setSimilarItems(results);
    }).catch(() => setSimilarItems([]));
  });

  onMount(() => { document.body.style.overflow = 'hidden'; window.addEventListener('message', handlePlayerMessages); }); 
  onCleanup(() => { hydrateSessionProgressFromElapsed(); saveProgressToDb(); document.body.style.overflow = ''; window.removeEventListener('message', handlePlayerMessages); });
  
  const allAvailablePlatforms = createMemo(() => [...new Set((props.watchlist || []).flatMap(m => getSafePlatforms(m)))].filter(Boolean).sort());

  createEffect(() => { 
      if(movie()) { 
          if (!isPreview() && !props.isGuest) {
              setForm({ status: movie().status||'Planned', rating: movie().rating||'', watchDate: typeof movie().watchDate==='string'?movie().watchDate:'', notes: typeof movie().notes==='string'?movie().notes:'', region: movie().region||'International', season: movie().season||1, episode: movie().episode||1, tag: movie().tag||'', platforms: getSafePlatforms(movie()).join(', '), genres: getSafeGenres(movie()).join(', '), seasonDates: movie().seasonDates || {} });
          }
          fetch(`https://api.themoviedb.org/3/${movie().media_type||'movie'}/${movie().id}?api_key=${TMDB_KEY}&append_to_response=videos,credits`).then(r=>r.json()).then(async d=>{
              setDetails(d);
              if (movie().media_type === 'tv' && !isPreview() && !props.isGuest) {
                  const regularSeasons = (d.seasons || []).filter(s => Number(s.season_number) > 0); const latestSeason = regularSeasons.reduce((max, s) => Math.max(max, Number(s.season_number) || 0), 0); const previousKnown = Number(movie().latestTmdbSeason || movie().totalSeasons || 0); const hasNewSeason = previousKnown > 0 && latestSeason > previousKnown;
                  if (latestSeason > 0 && latestSeason !== previousKnown) await updateDoc(doc(db, 'users', props.uid, 'watchlist', String(movie().id)), { latestTmdbSeason: latestSeason, newSeasonAvailable: hasNewSeason });
              }
              const inferred = (d?.runtime || d?.episode_run_time?.[0] || 0) * 60; if (inferred > 0) setContentDuration(inferred);
              const v = d?.videos?.results; if(v){ let t = v.find(x=>x.site==='YouTube'&&x.type==='Trailer')||v.find(x=>x.site==='YouTube'&&x.type==='Teaser')||v.find(x=>x.site==='YouTube'); if(t) setTrailerKey(t.key); }
              if (!isPreview() && !props.isGuest && d.genres && d.genres.length > 0) { const apiGenres = d.genres.map(g => g.name).join(', '); const dbGenres = getSafeGenres(movie()).join(', '); if (!dbGenres) setForm(f => ({ ...f, genres: apiGenres })); }
          });
          const title = movie().title || movie().name;
          fetch(`https://www.omdbapi.com/?t=${encodeURIComponent(title)}&apikey=${OMDB_KEY}`).then(r=>r.json()).then(d=>{
              if(d.Response === 'True') { const rt = d.Ratings?.find(r=>r.Source === 'Rotten Tomatoes')?.Value || '-'; setOmdbData({ imdb: d.imdbRating || '-', rt: rt }); if (!isPreview() && !props.isGuest) updateDoc(doc(db, 'users', props.uid, 'watchlist', String(movie().id)), { imdbRating: d.imdbRating || '-', rtRating: rt.replace('%','') }); }
          });
          const fetchProviders = async () => {
              const title = movie().title || movie().name;
              const makeStoredProvider = (platform) => { const cleanP = cleanPlatform(platform); if (!cleanP) return null; const pData = getPlatformDict(title, cleanP); if (pData) return { name: pData.name, logo: pData.logo, url: pData.url, source: 'stored' }; return { name: cleanP, isCss: true, color: getBrandColor(cleanP), url: `https://www.google.com/search?q=Watch+${encodeURIComponent(title)}+on+${encodeURIComponent(cleanP)}`, source: 'stored' }; };
              const storedProviders = () => getSafePlatforms(movie()).map(makeStoredProvider).filter(Boolean);
              try {
                  const providerData = await Promise.race([ fetchTmdbWatchProviders(movie().media_type, movie().id), new Promise(resolve => setTimeout(() => resolve(null), 3000)) ]);
                  const hasDisplayProviders = (region) => !!region && [region.flatrate, region.rent, region.buy].some(list => Array.isArray(list) && list.length > 0);
                  const region = hasDisplayProviders(providerData?.results?.IN) ? providerData.results.IN : (hasDisplayProviders(providerData?.results?.US) ? providerData.results.US : null);
                  const raw = region ? [...(region.flatrate || []), ...(region.rent || []), ...(region.buy || [])] : [];
                  const seen = new Set();
                  const tmdbProviders = raw.map(p => { const name = cleanPlatform(p.provider_name) || p.provider_name; if (!name || seen.has(name)) return null; seen.add(name); return { name, logo: p.logo_path ? `https://image.tmdb.org/t/p/original${p.logo_path}` : null, url: region?.link || `https://www.google.com/search?q=Watch+${encodeURIComponent(title)}+on+${encodeURIComponent(name)}`, source: 'tmdb' }; }).filter(Boolean).slice(0, 6);
                  if (tmdbProviders.length > 0) { setRichPlatforms(tmdbProviders); if (!isPreview() && !props.isGuest) { const currentDbPlatforms = movie().platformsList || []; const fetchedNames = tmdbProviders.map(p => p.name); const missingInDb = fetchedNames.filter(n => !currentDbPlatforms.includes(n)); if(missingInDb.length > 0) { const mergedPlatforms = [...new Set([...currentDbPlatforms, ...fetchedNames])]; await updateDoc(doc(db, 'users', props.uid, 'watchlist', String(movie().id)), { platformsList: mergedPlatforms }); } } return; }
              } catch (e) {}
              setRichPlatforms(storedProviders().slice(0, 6));
          };
          fetchProviders();
      } 
  });

  const togglePlatform = (p) => { let curr = form().platforms.split(',').map(s=>s.trim()).filter(Boolean); if(curr.includes(p)) curr = curr.filter(x=>x!==p); else curr.push(p); setForm({...form(), platforms: curr.join(', ')}); };
  const saveChanges = async () => { 
    if (props.isGuest) { props.showToast("Sign in to save changes! 🔒"); if (props.onLogin) props.onLogin(); return; }
    const nextSeason = parseInt(form().season) || 1; const nextEpisode = parseInt(form().episode) || 1; const prevSeason = parseInt(movie().season) || 1; const prevEpisode = parseInt(movie().episode) || 1; const episodeChanged = movie().media_type === 'tv' && (nextSeason !== prevSeason || nextEpisode !== prevEpisode);
    const updates = { status: form().status, rating: parseFloat(form().rating)||0, watchDate: form().watchDate, seasonDates: form().seasonDates, notes: form().notes, region: form().region, season: nextSeason, episode: nextEpisode, tag: form().tag, genresList: form().genres.split(',').map(s=>s.trim()).filter(Boolean), platformsList: form().platforms.split(',').map(s=>cleanPlatform(s.trim())).filter(Boolean) };
    if (episodeChanged) { const inferred = inferDurationSeconds(); updates.watchProgress = { currentTime: 0, duration: inferred || 0, server: activeServer() || null, updatedAt: new Date().toISOString(), season: nextSeason, episode: nextEpisode }; setWatchProgress({ currentTime: 0, duration: inferred || 0 }); setPlayerStartProgress(0); }
    await updateDoc(doc(db, 'users', props.uid, 'watchlist', String(movie().id)), updates); 
    if(props.showToast) props.showToast("Saved"); setIsEdit(false); 
  };
  
  const isCompleted = createMemo(() => !isPreview() && (form().status || movie()?.status) === 'Completed');
  const progressPct = createMemo(() => { if (isCompleted()) return 100; const loadedSeasonTotal = getEpisodesForSeason(currentSeasonNumber()).length; const total = Number(movie()?.totalEps) || loadedSeasonTotal || 1; return Math.min((currentEpisodeNumber() / total) * 100, 100); });
  const movieFranchises = createMemo(() => props.franchises?.filter(f => movie()?.franchises?.[f.id] !== undefined).map(f => f.name).join(', '));

  const addToVaultFromPreview = async () => {
    if (props.isGuest) { if(props.showToast) props.showToast("Sign in to add to Vault! 🔒"); if (props.onLogin) props.onLogin(); return; }
    const item = movie(); if ((props.watchlist || []).some(w => String(w.id) === String(item.id))) { if(props.showToast) props.showToast("Already in Vault! 🍿"); return; }
    if(props.showToast) props.showToast("Adding to Vault...");
    try {
      const castNames = details().credits?.cast?.slice(0, 5).map(c => c.name) || []; const director = details().credits?.crew?.find(c => c.job === 'Director')?.name || ''; const castList = [...castNames, director].filter(Boolean);
      await setDoc(doc(db, 'users', props.uid, 'watchlist', String(item.id)), { id: String(item.id), title: item.title || item.name, media_type: item.media_type || 'movie', poster_path: item.poster_path, backdrop_path: item.backdrop_path, release_date: item.release_date || item.first_air_date || '', status: 'Planned', addedAt: new Date(), castList: castList });
      if(props.showToast) props.showToast("Added to Vault! 🍿"); props.onClose();
    } catch (err) { if(props.showToast) props.showToast("Error adding to vault."); }
  };
  
  const getStreamUrl = (serverId) => { 
    if (serverId === 'DIRECT_PLAY') return directPlayUrl(); 
    if (!serverId) return ''; const id = movie().id; const s = movie().media_type === 'tv' ? currentSeasonNumber() : (movie().season || 1); const e = movie().media_type === 'tv' ? currentEpisodeNumber() : (movie().episode || 1); const type = movie().media_type === 'tv' ? 'tv' : 'movie';
    const serverConfig = availableServers().find(srv => srv.id === serverId); if (!serverConfig) return '';
    let urlTemplate = type === 'tv' ? serverConfig.tvUrl : serverConfig.movieUrl; if(!urlTemplate) return '';
    let timeParam = '';
    const canResumeFromProgress = movie().watchProgress && movie().watchProgress.server === serverId && movie().watchProgress.currentTime > 0 && ( movie().media_type !== 'tv' || ( parseInt(movie().watchProgress.season || 1) === parseInt(movie().season || 1) && parseInt(movie().watchProgress.episode || 1) === parseInt(movie().episode || 1) ) );
    if (canResumeFromProgress) { const t = Math.floor(movie().watchProgress.currentTime); timeParam = urlTemplate.includes('?') ? `&t=${t}&start=${t}&time=${t}` : `?t=${t}&start=${t}&time=${t}`; }
    return urlTemplate.replace(/\{id\}|\[TMDB_ID\]/gi, id).replace(/\{season\}|\[SEASON\]/gi, s).replace(/\{episode\}|\[EPISODE\]/gi, e) + timeParam;
  };

  return (
    <div class="fixed inset-0 z-[999999] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in" onClick={props.onClose}>
      <div class="absolute inset-0 bg-[#08090b] overflow-hidden pointer-events-none">
        <Show when={movie()?.backdrop_path}><img src={`https://image.tmdb.org/t/p/w500${movie().backdrop_path}`} class="w-full h-full object-cover opacity-40 blur-3xl scale-125" /></Show>
        <div class="absolute inset-0 bg-black/60"></div>
      </div>
      
      <Show when={movie()}>
        <div class="w-full max-w-xl lg:max-w-[800px] bg-[#08090b]/80 backdrop-blur-3xl rounded-t-[2.5rem] sm:rounded-[2.5rem] overflow-hidden border border-white/10 relative max-h-[95vh] shadow-[0_-10px_40px_rgba(0,0,0,0.5)] animate-pop-in flex flex-col" onClick={e=>e.stopPropagation()}>
          
          <button onClick={props.onClose} class="absolute top-4 right-4 z-[100] bg-black/50 backdrop-blur-md border border-white/10 p-2.5 rounded-full hover:bg-black/80 active:scale-95 transition-all"><Icon name="close" class="text-sm text-white"/></button>
          
          <div class="overflow-y-auto hide-scrollbar w-full">
            <MediaHeader 
              movie={movie()} details={details()} playTrailer={playTrailer()} setPlayTrailer={setPlayTrailer} 
              trailerKey={trailerKey()} isPreview={isPreview()} isGuest={props.isGuest} 
              isEdit={isEdit()} setIsEdit={setIsEdit} showToast={props.showToast} onLogin={props.onLogin} 
            />

            <div class="px-6 md:px-8 pb-28 relative z-10">
              <RatingsPanel omdbData={omdbData()} movie={movie()} />

              <Show when={isEdit()} fallback={
                <div class="animate-fade-in">
                  <Show when={!isPreview()}>
                    <StreamingPanel 
                      availableServers={availableServers()} activeServer={activeServer()} setActiveServer={setActiveServer} 
                      isEditingDirectUrl={isEditingDirectUrl()} setIsEditingDirectUrl={setIsEditingDirectUrl} 
                      directPlayUrl={directPlayUrl()} setDirectPlayUrl={setDirectPlayUrl} showToast={props.showToast} 
                      movie={movie()} inferDurationSeconds={inferDurationSeconds} setContentDuration={setContentDuration} 
                      setWatchProgress={setWatchProgress} setPlayerStartProgress={setPlayerStartProgress} 
                      setReceivedRealProgress={setReceivedRealProgress} setPlayerSessionStart={setPlayerSessionStart} 
                      setShowPlayer={setShowPlayer} 
                    />
                  </Show>

                  <p class="text-gray-400 text-sm mb-6 leading-relaxed italic border-l-2 border-[var(--primary)]/30 pl-3">
                    "{details().overview || (typeof movie().overview === 'string' ? movie().overview : 'No overview available.')}"
                  </p>
                  
                  <Show when={!isPreview() && movie().media_type === 'tv'}>
                    <TvTracker 
                      movie={movie()} tvSeasons={tvSeasons()} selectedSeason={selectedSeason()} setSelectedSeason={setSelectedSeason} 
                      seasonsLoading={seasonsLoading()} selectedSeasonEpisodes={selectedSeasonEpisodes()} 
                      episodeDocId={episodeDocId} watchedEpisodes={watchedEpisodes()} expandedEpisodes={expandedEpisodes()} 
                      setExpandedEpisodes={setExpandedEpisodes} toggleEpisodeWatched={toggleEpisodeWatched} 
                      isCompleted={isCompleted()} currentSeasonNumber={currentSeasonNumber()} currentEpisodeNumber={currentEpisodeNumber()} 
                      progressPct={progressPct()} getCurrentEpisode={getCurrentEpisode} 
                    />
                  </Show>

                  <CastCrewList credits={details().credits} setPersonId={setPersonId} />
                  
                  <InfoGrid 
                    movie={movie()} isPreview={isPreview()} 
                    genresText={details().genres ? details().genres.map(g => g.name).join(', ') : (getSafeGenres(movie()).join(', ') || 'N/A')} 
                    richPlatforms={richPlatforms()} movieFranchises={movieFranchises()} similarItems={similarItems()} 
                    onSimilarClick={(item) => { setOverrideItem({ ...item, media_type: item.media_type || (movie().media_type === 'tv' ? 'tv' : 'movie') }); document.querySelector('.overflow-y-auto.hide-scrollbar.w-full')?.scrollTo({ top: 0, behavior: 'smooth' }); }} 
                    calculateDays={calculateDays} 
                  />

                  <Show when={isPreview()}>
                    <button onClick={addToVaultFromPreview} class="w-full mt-6 font-black py-4 px-5 rounded-xl text-xs uppercase tracking-widest active:scale-95 transition-transform flex items-center justify-center gap-2 border" style="background: var(--p); color: #05060a; border-color: var(--p); box-shadow: 0 0 24px var(--p-glow); min-height: 52px;">
                      <Icon name="add_circle" class="text-lg"/> Add to My Universe
                    </button>
                  </Show>
                  
                  <Show when={!isPreview()}>
                    <div class="mt-8 flex justify-end">
                      <button onClick={async () => { 
                        if (props.isGuest) { if(props.showToast) props.showToast("Sign in to edit vault! 🔒"); if (props.onLogin) props.onLogin(); return; }
                        if(confirm("Permanently delete?")) { await deleteDoc(doc(db, 'users', props.uid, 'watchlist', String(movie().id))); if(props.showToast) props.showToast("Deleted"); props.onClose(); } 
                      }} class="text-red-500/50 hover:text-red-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-1 transition-colors mx-auto active:scale-95">
                        <Icon name="delete" class="text-sm"/> Remove from Universe
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
        <div class="fixed inset-0 bg-black z-[10000000] flex flex-col animate-fade-in" onClick={(e)=>e.stopPropagation()}>
          <div class="p-4 flex justify-between items-center bg-[#0c0e14] border-b border-white/5 shadow-xl">
            <div class="flex items-center gap-3 overflow-hidden pr-2 flex-1">
                <button type="button" onClick={(e) => { e.stopPropagation(); hydrateSessionProgressFromElapsed(); saveProgressToDb(); setPlayerSessionStart(null); setPlayerStartProgress(0); setShowPlayer(false); }} class="p-2 bg-white/5 hover:bg-white/10 rounded-full active:scale-95 transition-all shrink-0"><Icon name="arrow_back" class="text-sm" /></button>
                <h3 class="font-bold text-sm text-white truncate max-w-[150px]">{movie().title || movie().name}</h3>
            </div>
            <div class="flex gap-2 shrink-0">
                <div class="relative bg-white/5 border border-white/10 rounded-xl px-2 py-1.5 flex items-center gap-1 hover:bg-white/10 transition-colors">
                    <Icon name="router" class="text-gray-400 text-[14px]" />
                    <select value={activeServer()} onChange={(e) => { e.stopPropagation(); setActiveServer(e.target.value); }} class="bg-transparent text-[10px] font-black uppercase tracking-widest text-[var(--primary)] outline-none appearance-none cursor-pointer pr-4 pl-1">
                        <For each={availableServers()}>{(srv) => <option value={srv.id} class="bg-[#0c0e14] text-white">{srv.name}</option>}</For>
                        <option value="DIRECT_PLAY" class="bg-[#0c0e14] text-[#3b82f6]">DIRECT PLAY</option>
                    </select>
                    <Icon name="expand_more" class="text-gray-400 text-[14px] absolute right-1 pointer-events-none" />
                </div>
            </div>
          </div>
          <div class="flex-1 bg-black w-full h-full relative">
            <Show when={activeServer() === 'DIRECT_PLAY'} fallback={<iframe src={getStreamUrl(activeServer())} class="w-full h-full border-none relative z-10" allowfullscreen></iframe>}>
              <DirectPlayPlayer src={getStreamUrl(activeServer())} title={movie().title || movie().name} poster={`https://image.tmdb.org/t/p/original${movie().backdrop_path}`} startTime={movie().watchProgress?.currentTime || 0} onProgress={(prog) => { setReceivedRealProgress(true); setWatchProgress(prog); }} />
            </Show>
          </div>
        </div>
      </Show>

      {/* FIXED PERSON MODAL USING id INSTEAD OF personId */}
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
              if(props.showToast) props.showToast(`Search for ${item.title || item.name} to view details!`);
            }
          }}
        />
      </Show>
    </div>
  );
}
