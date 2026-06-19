import { createEffect, createSignal } from 'solid-js';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { OMDB_KEY } from '../utils';

export function useOmdbRatings(movie, { uid, isGuest, isPreview }) {
  const [omdbData, setOmdbData] = createSignal({ imdb: '-', rt: '-' });

  createEffect(() => {
    const item = movie();
    if (!item?.id) return;
    const title = item.title || item.name;
    fetch(`https://www.omdbapi.com/?t=${encodeURIComponent(title)}&apikey=${OMDB_KEY}`)
      .then(r => r.json())
      .then(d => {
        if (d.Response !== 'True') return;
        const rt = d.Ratings?.find(r => r.Source === 'Rotten Tomatoes')?.Value || '-';
        setOmdbData({ imdb: d.imdbRating || '-', rt });
        if (!isPreview() && !isGuest) {
          updateDoc(doc(db, 'users', uid, 'watchlist', String(item.id)), { imdbRating: d.imdbRating || '-', rtRating: rt.replace('%', '') });
        }
      })
      .catch(() => {});
  });

  return { omdbData };
}
