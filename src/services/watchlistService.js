import { doc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

const watchlistDoc = (uid, itemId) => doc(db, 'users', uid, 'watchlist', String(itemId));

export const updateWatchlistItem = (uid, itemId, updates) => updateDoc(watchlistDoc(uid, itemId), updates);

export const deleteWatchlistItem = (uid, itemId) => deleteDoc(watchlistDoc(uid, itemId));

export const addPreviewToWatchlist = ({ uid, item, details }) => {
  const castNames = details?.credits?.cast?.slice(0, 5).map(c => c.name) || [];
  const director = details?.credits?.crew?.find(c => c.job === 'Director')?.name || '';
  const castList = [...castNames, director].filter(Boolean);

  return setDoc(watchlistDoc(uid, item.id), {
    id: String(item.id),
    title: item.title || item.name,
    media_type: item.media_type || 'movie',
    poster_path: item.poster_path,
    backdrop_path: item.backdrop_path,
    release_date: item.release_date || item.first_air_date || '',
    status: 'Planned',
    addedAt: new Date(),
    castList
  });
};

export const upsertEpisodeWatchState = ({ uid, itemId, episodeId, payload }) =>
  setDoc(doc(db, 'users', uid, 'watchlist', String(itemId), 'episodes', episodeId), payload, { merge: true });
