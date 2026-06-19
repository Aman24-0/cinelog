import { updateWatchlistItem } from '../services/watchlistService';

export function useWatchProgress({
  movie,
  isPreview,
  isGuest,
  uid,
  activeServer,
  watchProgress,
  setWatchProgress,
  contentDuration,
  setContentDuration,
  playerSessionStart,
  setPlayerSessionStart,
  playerStartProgress,
  setPlayerStartProgress,
  receivedRealProgress,
  setReceivedRealProgress,
  currentSeasonNumber,
  currentEpisodeNumber,
  inferDurationSeconds,
  showToast
}) {
  const primePlaybackProgress = () => {
    if (!movie().watchProgress || movie().watchProgress.currentTime === 0) {
      const inferred = inferDurationSeconds();
      if (inferred > 0) setContentDuration(inferred);
      setWatchProgress({ currentTime: 0, duration: inferred });
    } else {
      if (movie().watchProgress.duration) setContentDuration(movie().watchProgress.duration);
      setWatchProgress(movie().watchProgress);
    }

    setPlayerStartProgress(movie().watchProgress?.currentTime || 0);
    setReceivedRealProgress(false);
    setPlayerSessionStart(Date.now());
  };

  const handlePlayerMessages = (event) => {
    try {
      if (event.data?.source?.includes('react-devtools')) return;
      let msg = event.data;
      if (typeof msg === 'string') msg = JSON.parse(msg);
      const cTime = msg?.type === 'MEDIA_DATA' && msg?.data
        ? (msg.data.currentTime || msg.data.time || 0)
        : msg?.event === 'timeupdate'
          ? msg.currentTime
          : msg?.currentTime;
      if (typeof cTime !== 'number' || cTime <= 0) return;
      const dur = msg?.data?.duration || msg?.duration || contentDuration() || inferDurationSeconds() || 0;
      if (dur > 0) setContentDuration(dur);
      setReceivedRealProgress(true);
      setWatchProgress({ currentTime: cTime, duration: dur });
    } catch (e) {}
  };

  const hydrateSessionProgressFromElapsed = () => {
    const startedAt = playerSessionStart();
    if (!startedAt || receivedRealProgress()) return;
    const elapsed = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
    if (elapsed < 60) return;
    const base = Math.max(0, Number(playerStartProgress()) || 0);
    const dur = contentDuration() || watchProgress()?.duration || inferDurationSeconds() || 0;
    const next = dur > 0 ? Math.min(base + elapsed, dur) : base + elapsed;
    if (next > base) setWatchProgress({ currentTime: next, duration: dur });
  };

  const saveProgressToDb = async () => {
    const prog = watchProgress();
    if (prog && prog.currentTime > 0 && !isGuest && movie() && !isPreview()) {
      try {
        const updates = {
          watchProgress: {
            currentTime: prog.currentTime,
            duration: prog.duration || contentDuration() || inferDurationSeconds() || 0,
            server: activeServer(),
            updatedAt: new Date().toISOString(),
            season: currentSeasonNumber(),
            episode: currentEpisodeNumber()
          }
        };
        if (movie().status === 'Planned' || movie().status === 'Plan to Watch') updates.status = 'Watching';
        await updateWatchlistItem(uid, movie().id, updates);
        if (showToast) showToast('Progress Saved! 🍿');
        setWatchProgress(null);
      } catch (e) {
        console.error('Error saving progress', e);
      }
    }
  };

  return { primePlaybackProgress, handlePlayerMessages, hydrateSessionProgressFromElapsed, saveProgressToDb };
}
