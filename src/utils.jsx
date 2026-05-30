export const TMDB_KEY = import.meta.env.VITE_TMDB_API_KEY;
export const OMDB_KEY = import.meta.env.VITE_OMDB_API_KEY;

export const WATCHMODE_KEY = "QQQ2oiV5GK9fIM0sjEfgHwMTjGtusEYSy6I8TIfp";

const watchmodeState = { active: 0, queue: [] };

const runNextWatchmodeRequest = () => {
  if (watchmodeState.active >= 3 || watchmodeState.queue.length === 0) return;
  const next = watchmodeState.queue.shift();
  watchmodeState.active++;
  next()
    .catch(() => {})
    .finally(() => {
      watchmodeState.active = Math.max(0, watchmodeState.active - 1);
      runNextWatchmodeRequest();
    });
};

const enqueueWatchmodeRequest = (task) => new Promise((resolve) => {
  watchmodeState.queue.push(async () => resolve(await task()));
  runNextWatchmodeRequest();
});

export const fetchWatchmodeSources = async (mediaType, id) => {
  if (!id || !WATCHMODE_KEY) return null;
  const cacheKey = `watchmode_${id}`;

  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch (e) {}

  return enqueueWatchmodeRequest(async () => {
    try {
      const wmType = mediaType === 'tv' ? 'tv' : 'movie';
      const res = await fetch(`https://api.watchmode.com/v1/title/${wmType}-${id}/sources/?apiKey=${WATCHMODE_KEY}&regions=IN,US`);
      if (!res.ok) return null;
      const data = await res.json();
      if (!Array.isArray(data)) return null;
      try { localStorage.setItem(cacheKey, JSON.stringify(data)); } catch (e) {}
      return data;
    } catch (e) {
      return null;
    }
  });
};

export const cleanPlatform = (p) => {
  if (!p) return null; const l = p.toLowerCase();
  if (l.includes('netflix')) return 'Netflix'; if (l.includes('prime') || l.includes('amazon')) return 'Amazon Prime Video';
  if (l.includes('hotstar') || l.includes('jio') || l.includes('disney')) return 'JioHotstar';
  if (l.includes('sony') || l.includes('liv')) return 'Sony LIV'; if (l.includes('zee')) return 'Zee5';
  if (l.includes('apple')) return 'Apple TV'; if (l.includes('crunchyroll')) return 'Crunchyroll';
  return p.trim();
};

export const getSafeGenres = (m) => m?.genresList || (typeof m?.genres === 'string' ? m.genres.split(',') : []) || [];
export const getSafePlatforms = (m) => [...new Set((m?.platformsList || []).map(cleanPlatform).filter(Boolean))];

export const formatRuntime = (mins) => {
  if (!mins || mins <= 0) return null;
  const h = Math.floor(mins / 60); const m = mins % 60;
  return h > 0 ? `${h}h ${m > 0 ? m + 'm' : ''}` : `${m}m`;
};

export const Icon = (props) => <span class={`material-symbols-outlined ${props.fill ? 'filled' : ''} ${props.class || ''}`}>{props.name}</span>;

export const SafeInfoRow = (props) => (
  <div class="grid grid-cols-[100px_1fr] items-center py-1">
    <span class="text-[10px] text-gray-500 font-black uppercase tracking-widest flex items-center gap-2">
      <Icon name={props.icon} class="text-[14px]" /> {props.label}
    </span>
    <div class="text-sm font-bold text-gray-200">{props.value}</div>
  </div>
);
