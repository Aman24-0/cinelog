import { createMemo, createSignal } from 'solid-js';
import { collection, doc, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { TMDB_KEY } from '../utils';
import { upsertEpisodeWatchState } from '../services/watchlistService';

export function useEpisodeTracking({ movie, details, isPreview, isGuest, uid, activeServer, inferDurationSeconds, setForm, setWatchProgress, setPlayerStartProgress, showToast, onLogin }) {
  const [selectedSeason, setSelectedSeason] = createSignal(null);
  const [seasonEpisodes, setSeasonEpisodes] = createSignal({});
  const [seasonsLoading, setSeasonsLoading] = createSignal(false);
  const [expandedEpisodes, setExpandedEpisodes] = createSignal({});
  const [watchedEpisodes, setWatchedEpisodes] = createSignal({});

  const tvSeasons = createMemo(() => (details().seasons || []).filter(s => Number(s.season_number) > 0).sort((a, b) => Number(a.season_number) - Number(b.season_number)));
  const selectedSeasonData = createMemo(() => tvSeasons().find(s => Number(s.season_number) === Number(selectedSeason())));
  const selectedSeasonEpisodes = createMemo(() => seasonEpisodes()[selectedSeason()]?.episodes || []);
  const episodeDocId = (season, episode) => `s${season}_e${episode}`;
  const compareEpisodePosition = (aSeason, aEpisode, bSeason, bEpisode) => (Number(aSeason) - Number(bSeason)) || (Number(aEpisode) - Number(bEpisode));
  const getEpisodesForSeason = (season) => (seasonEpisodes()[season]?.episodes || []).slice().sort((a, b) => Number(a.episode_number) - Number(b.episode_number));

  const seasonCacheKey = () => `tmdb_${movie()?.id}_seasons`;
  const cacheIsFresh = (cache) => cache?.timestamp && (Date.now() - cache.timestamp < 24 * 60 * 60 * 1000);
  const getStoredSeasonCache = () => { try { return JSON.parse(localStorage.getItem(seasonCacheKey()) || '{}'); } catch (e) { return {}; } };
  const writeStoredSeasonCache = (cache) => { try { localStorage.setItem(seasonCacheKey(), JSON.stringify(cache)); } catch (e) {} };

  const loadWatchedEpisodes = async () => {
    if (isGuest || !uid || isPreview() || movie()?.media_type !== 'tv') return;
    try {
      const snap = await getDocs(collection(db, 'users', uid, 'watchlist', String(movie().id), 'episodes'));
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
      writeStoredSeasonCache({ timestamp: Date.now(), seasons: { ...(cache.seasons || {}), [seasonNumber]: season } });
      setSeasonEpisodes(prev => ({ ...prev, [seasonNumber]: season }));
    } catch (e) {
      if (cachedSeason) setSeasonEpisodes(prev => ({ ...prev, [seasonNumber]: cachedSeason }));
    } finally {
      setSeasonsLoading(false);
    }
  };

  const findNextEpisodePointer = (season, episode) => {
    const nextInSeason = getEpisodesForSeason(season).find(ep => Number(ep.episode_number) > Number(episode));
    if (nextInSeason) return { season: Number(season), episode: Number(nextInSeason.episode_number) };
    const nextSeason = tvSeasons().find(s => Number(s.season_number) > Number(season));
    if (!nextSeason) return null;
    const nextSeasonNumber = Number(nextSeason.season_number);
    const nextSeasonEpisodes = getEpisodesForSeason(nextSeasonNumber);
    return { season: nextSeasonNumber, episode: Number(nextSeasonEpisodes[0]?.episode_number || 1) };
  };

  const updateCurrentEpisodePointer = async (nextPointer, completed = false, currentSeasonNumber, currentEpisodeNumber) => {
    const nextSeason = Number(nextPointer?.season || currentSeasonNumber());
    const nextEpisode = Number(nextPointer?.episode || currentEpisodeNumber());
    const nextStatus = completed ? 'Completed' : (movie()?.status === 'Planned' || movie()?.status === 'Plan to Watch' || movie()?.status === 'Completed' ? 'Watching' : (movie()?.status || 'Watching'));
    const nextProgress = { currentTime: 0, duration: inferDurationSeconds() || 0, server: activeServer() || null, updatedAt: new Date().toISOString(), season: nextSeason, episode: nextEpisode };
    setForm(prev => ({ ...prev, season: nextSeason, episode: nextEpisode, status: nextStatus }));
    setWatchProgress(nextProgress);
    setPlayerStartProgress(0);
    if (!isGuest && uid && movie() && !isPreview()) await updateDoc(doc(db, 'users', uid, 'watchlist', String(movie().id)), { season: nextSeason, episode: nextEpisode, status: nextStatus, watchProgress: nextProgress });
  };

  const toggleEpisodeWatched = async (ep, currentSeasonNumber, currentEpisodeNumber) => {
    if (isGuest) { showToast('Sign in to track episodes! 🔒'); if (onLogin) onLogin(); return; }
    if (!uid || !movie() || !ep) return;
    const season = Number(ep.season_number || selectedSeason() || currentSeasonNumber());
    const episode = Number(ep.episode_number || 1);
    const id = episodeDocId(season, episode);
    const isWatched = !!watchedEpisodes()[id]?.watched;
    const payload = { watched: !isWatched, season, episode, episodeId: id, title: ep.name || '', airDate: ep.air_date || '', runtime: ep.runtime || null, updatedAt: new Date().toISOString() };
    setWatchedEpisodes(prev => ({ ...prev, [id]: payload }));
    try {
      await upsertEpisodeWatchState({ uid, itemId: movie().id, episodeId: id, payload });
      if (payload.watched) {
        const nextPointer = findNextEpisodePointer(season, episode);
        await updateCurrentEpisodePointer(nextPointer || { season, episode }, !nextPointer, currentSeasonNumber, currentEpisodeNumber);
        showToast(nextPointer ? `S${season} E${episode} watched — next S${nextPointer.season} E${nextPointer.episode}` : `S${season} E${episode} watched — show completed`);
      } else {
        if (compareEpisodePosition(currentSeasonNumber(), currentEpisodeNumber(), season, episode) > 0 || movie()?.status === 'Completed') await updateCurrentEpisodePointer({ season, episode }, false, currentSeasonNumber, currentEpisodeNumber);
        showToast(`S${season} E${episode} marked unwatched`);
      }
    } catch (e) {
      setWatchedEpisodes(prev => ({ ...prev, [id]: { ...payload, watched: isWatched } }));
      showToast('Could not update episode. Try again.');
    }
  };

  return { selectedSeason, setSelectedSeason, seasonEpisodes, seasonsLoading, expandedEpisodes, setExpandedEpisodes, watchedEpisodes, tvSeasons, selectedSeasonData, selectedSeasonEpisodes, episodeDocId, getEpisodesForSeason, loadWatchedEpisodes, fetchSeasonEpisodes, toggleEpisodeWatched };
}
