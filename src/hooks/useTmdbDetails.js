import { createEffect, createSignal } from 'solid-js';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { cleanPlatform, getSafeGenres, getSafePlatforms, TMDB_KEY, fetchTmdbWatchProviders } from '../utils';

const getPlatformDict = (title, platformName) => {
  const enc = encodeURIComponent(title || '');
  const cleanN = platformName ? platformName.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
  const dbData = {
    netflix: { name: 'Netflix', logo: 'https://image.tmdb.org/t/p/w92/t2yyOv40HZeVlLjVrCsPhIdZfC4.jpg', url: `https://www.netflix.com/search?q=${enc}` },
    amazonprimevideo: { name: 'Amazon Prime Video', logo: 'https://image.tmdb.org/t/p/w92/5NyLm42TmCqCMOZFvH4fvn2FI11.jpg', url: `https://www.primevideo.com/search/ref=atv_sr_sug_sc?phrase=${enc}` },
    primevideo: { name: 'Amazon Prime Video', logo: 'https://image.tmdb.org/t/p/w92/5NyLm42TmCqCMOZFvH4fvn2FI11.jpg', url: `https://www.primevideo.com/search/ref=atv_sr_sug_sc?phrase=${enc}` },
    amazon: { name: 'Amazon Prime Video', logo: 'https://image.tmdb.org/t/p/w92/5NyLm42TmCqCMOZFvH4fvn2FI11.jpg', url: `https://www.primevideo.com/search/ref=atv_sr_sug_sc?phrase=${enc}` },
    jiohotstar: { name: 'JioHotstar', logo: 'https://image.tmdb.org/t/p/w92/uzKjVDmQIA2rZGSNpGbnWXUWVQIM.jpg', url: `https://www.hotstar.com/in/explore?searchQuery=${enc}` },
    hotstar: { name: 'JioHotstar', logo: 'https://image.tmdb.org/t/p/w92/uzKjVDmQIA2rZGSNpGbnWXUWVQIM.jpg', url: `https://www.hotstar.com/in/explore?searchQuery=${enc}` },
    sonyliv: { name: 'Sony LIV', logo: 'https://image.tmdb.org/t/p/w92/8N0DNa4BO3lH24KWv1EjJh4TxGL.jpg', url: 'https://www.sonyliv.com/' },
    zee5: { name: 'Zee5', logo: 'https://image.tmdb.org/t/p/w92/5vVzg0rtZAwQGzQoT2Zk0n43Nym.jpg', url: `https://www.zee5.com/global/search?q=${enc}` },
    appletv: { name: 'Apple TV', logo: 'https://image.tmdb.org/t/p/w92/2E0ficP6ijhlCSJuwHI4isW0QhD.jpg', url: 'https://tv.apple.com/' },
    crunchyroll: { name: 'Crunchyroll', logo: 'https://image.tmdb.org/t/p/w92/mXeC4TrcgdU6j81XreWIjA6k7yC.jpg', url: `https://www.crunchyroll.com/search?q=${enc}` },
    youtube: { name: 'YouTube', logo: 'https://image.tmdb.org/t/p/w92/p3Z12gKq2qvJaUOMeKNU2mzKVI9.jpg', url: `https://www.youtube.com/results?search_query=${enc}` }
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

export function useTmdbDetails(movie, { uid, isGuest, isPreview, setForm, setContentDuration }) {
  const [details, setDetails] = createSignal({});
  const [trailerKey, setTrailerKey] = createSignal(null);
  const [richPlatforms, setRichPlatforms] = createSignal([]);
  const [similarItems, setSimilarItems] = createSignal([]);

  createEffect(() => {
    const item = movie();
    if (!item?.id) { setSimilarItems([]); return; }
    const mediaType = item.media_type === 'tv' ? 'tv' : 'movie';
    fetch(`https://api.themoviedb.org/3/${mediaType}/${item.id}/recommendations?api_key=${TMDB_KEY}&language=en-US&page=1`)
      .then(r => r.json())
      .then(d => {
        const results = (d.results || []).filter(x => x.poster_path).slice(0, 12);
        if (results.length) setSimilarItems(results);
        else return fetch(`https://api.themoviedb.org/3/${mediaType}/${item.id}/similar?api_key=${TMDB_KEY}&language=en-US&page=1`).then(r => r.json()).then(d2 => setSimilarItems((d2.results || []).filter(x => x.poster_path).slice(0, 12)));
      })
      .catch(() => setSimilarItems([]));
  });

  createEffect(() => {
    const item = movie();
    if (!item?.id) return;
    fetch(`https://api.themoviedb.org/3/${item.media_type || 'movie'}/${item.id}?api_key=${TMDB_KEY}&append_to_response=videos,credits`)
      .then(r => r.json())
      .then(async d => {
        setDetails(d);
        if (item.media_type === 'tv' && !isPreview() && !isGuest) {
          const regularSeasons = (d.seasons || []).filter(s => Number(s.season_number) > 0);
          const latestSeason = regularSeasons.reduce((max, s) => Math.max(max, Number(s.season_number) || 0), 0);
          const previousKnown = Number(item.latestTmdbSeason || item.totalSeasons || 0);
          if (latestSeason > 0 && latestSeason !== previousKnown) {
            await updateDoc(doc(db, 'users', uid, 'watchlist', String(item.id)), { latestTmdbSeason: latestSeason, newSeasonAvailable: previousKnown > 0 && latestSeason > previousKnown });
          }
        }
        const inferred = (d?.runtime || d?.episode_run_time?.[0] || 0) * 60;
        if (inferred > 0) setContentDuration(inferred);
        const v = d?.videos?.results;
        const t = v?.find(x => x.site === 'YouTube' && x.type === 'Trailer') || v?.find(x => x.site === 'YouTube' && x.type === 'Teaser') || v?.find(x => x.site === 'YouTube');
        if (t) setTrailerKey(t.key);
        if (!isPreview() && !isGuest && d.genres?.length && !getSafeGenres(item).join(', ')) {
          setForm(f => ({ ...f, genres: d.genres.map(g => g.name).join(', ') }));
        }
      })
      .catch(() => {});

    const title = item.title || item.name;
    const makeStoredProvider = (platform) => {
      const cleanP = cleanPlatform(platform);
      if (!cleanP) return null;
      const pData = getPlatformDict(title, cleanP);
      if (pData) return { name: pData.name, logo: pData.logo, url: pData.url, source: 'stored' };
      return { name: cleanP, isCss: true, color: getBrandColor(cleanP), url: `https://www.google.com/search?q=Watch+${encodeURIComponent(title)}+on+${encodeURIComponent(cleanP)}`, source: 'stored' };
    };
    const storedProviders = () => getSafePlatforms(item).map(makeStoredProvider).filter(Boolean);
    Promise.race([fetchTmdbWatchProviders(item.media_type, item.id), new Promise(resolve => setTimeout(() => resolve(null), 3000))])
      .then(async providerData => {
        const hasDisplayProviders = (region) => !!region && [region.flatrate, region.rent, region.buy].some(list => Array.isArray(list) && list.length > 0);
        const region = hasDisplayProviders(providerData?.results?.IN) ? providerData.results.IN : (hasDisplayProviders(providerData?.results?.US) ? providerData.results.US : null);
        const raw = region ? [...(region.flatrate || []), ...(region.rent || []), ...(region.buy || [])] : [];
        const seen = new Set();
        const tmdbProviders = raw.map(p => {
          const name = cleanPlatform(p.provider_name) || p.provider_name;
          if (!name || seen.has(name)) return null;
          seen.add(name);
          return { name, logo: p.logo_path ? `https://image.tmdb.org/t/p/original${p.logo_path}` : null, url: region?.link || `https://www.google.com/search?q=Watch+${encodeURIComponent(title)}+on+${encodeURIComponent(name)}`, source: 'tmdb' };
        }).filter(Boolean).slice(0, 6);
        if (tmdbProviders.length > 0) {
          setRichPlatforms(tmdbProviders);
          if (!isPreview() && !isGuest) {
            const currentDbPlatforms = item.platformsList || [];
            const fetchedNames = tmdbProviders.map(p => p.name);
            const missingInDb = fetchedNames.filter(n => !currentDbPlatforms.includes(n));
            if (missingInDb.length > 0) await updateDoc(doc(db, 'users', uid, 'watchlist', String(item.id)), { platformsList: [...new Set([...currentDbPlatforms, ...fetchedNames])] });
          }
        } else setRichPlatforms(storedProviders().slice(0, 6));
      })
      .catch(() => setRichPlatforms(storedProviders().slice(0, 6)));
  });

  return { details, trailerKey, richPlatforms, similarItems };
}
