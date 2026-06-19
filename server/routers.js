import { z } from 'zod';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { router, publicProcedure } from './trpc.js';

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const OMDB_API_KEY = process.env.OMDB_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const OMDB_BASE_URL = 'https://www.omdbapi.com/';

const requireEnv = (value, name) => {
  if (!value) throw new Error(`${name} is not configured on the server`);
  return value;
};

const tmdbFetch = async (path, params = {}) => {
  const key = requireEnv(TMDB_API_KEY, 'TMDB_API_KEY');
  const safePath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${TMDB_BASE_URL}${safePath}`);
  url.searchParams.set('api_key', key);
  Object.entries(params || {}).forEach(([paramKey, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(paramKey, String(value));
  });
  const response = await fetch(url);
  if (!response.ok) throw new Error(`TMDB API error: ${response.status} ${response.statusText}`);
  return response.json();
};

const tmdbMediaTypeSchema = z.enum(['movie', 'tv']);

// In-memory cache to protect against rate limits (5 min TTL)
const torrentCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Search movies using TMDB API
 */
const searchMovies = publicProcedure
  .input(z.object({ query: z.string().min(1) }))
  .query(async ({ input }) => {
    try {
      const data = await tmdbFetch('/search/movie', { query: input.query, page: 1 });
      const movies = (data.results || []).slice(0, 10).map(movie => ({
        id: movie.id,
        title: movie.title,
        year: movie.release_date ? new Date(movie.release_date).getFullYear() : 'N/A',
        poster: movie.poster_path ? `https://image.tmdb.org/t/p/w300${movie.poster_path}` : null,
        overview: movie.overview || 'No overview available',
        rating: movie.vote_average || 0,
      }));

      return { success: true, movies, total: data.total_results };
    } catch (error) {
      console.error('Error searching movies:', error);
      return { success: false, movies: [], error: error.message };
    }
  });


const searchTmdb = publicProcedure
  .input(z.object({ query: z.string().min(1), mediaType: z.enum(['multi', 'movie', 'tv', 'person']).default('multi'), page: z.number().int().min(1).max(500).default(1) }))
  .query(({ input }) => tmdbFetch(`/search/${input.mediaType}`, { query: input.query, page: input.page }));

const tmdbDetails = publicProcedure
  .input(z.object({ mediaType: z.enum(['movie', 'tv', 'person']), id: z.number().int().positive(), appendToResponse: z.string().optional() }))
  .query(({ input }) => tmdbFetch(`/${input.mediaType}/${input.id}`, { append_to_response: input.appendToResponse }));

const tmdbCollection = publicProcedure
  .input(z.object({ id: z.number().int().positive() }))
  .query(({ input }) => tmdbFetch(`/collection/${input.id}`));

const tmdbWatchProviders = publicProcedure
  .input(z.object({ mediaType: tmdbMediaTypeSchema, id: z.number().int().positive() }))
  .query(({ input }) => tmdbFetch(`/${input.mediaType}/${input.id}/watch/providers`));

const tmdbSeasonDetails = publicProcedure
  .input(z.object({ tvId: z.number().int().positive(), seasonNumber: z.number().int().min(0) }))
  .query(({ input }) => tmdbFetch(`/tv/${input.tvId}/season/${input.seasonNumber}`));

const tmdbRecommendations = publicProcedure
  .input(z.object({ mediaType: tmdbMediaTypeSchema, id: z.number().int().positive(), page: z.number().int().min(1).max(500).default(1), fallbackSimilar: z.boolean().default(true) }))
  .query(async ({ input }) => {
    const recommendations = await tmdbFetch(`/${input.mediaType}/${input.id}/recommendations`, { language: 'en-US', page: input.page });
    if (!input.fallbackSimilar || (recommendations.results || []).length > 0) return recommendations;
    return tmdbFetch(`/${input.mediaType}/${input.id}/similar`, { language: 'en-US', page: input.page });
  });

const tmdbUpcomingDiscovery = publicProcedure
  .input(z.object({ startDate: z.string(), endDate: z.string(), region: z.enum(['Indian', 'International']).default('Indian'), language: z.string().default('all') }))
  .query(async ({ input }) => {
    const movieParams = { 'primary_release_date.gte': input.startDate, 'primary_release_date.lte': input.endDate, sort_by: 'popularity.desc' };
    const tvParams = { 'air_date.gte': input.startDate, 'air_date.lte': input.endDate, sort_by: 'popularity.desc', without_genres: '10764,10767' };
    if (input.region === 'Indian') {
      movieParams.with_origin_country = 'IN';
      tvParams.with_origin_country = 'IN';
      if (input.language !== 'all') {
        movieParams.with_original_language = input.language;
        tvParams.with_original_language = input.language;
      }
    }
    const [m1, m2, t1, t2] = await Promise.all([
      tmdbFetch('/discover/movie', { ...movieParams, page: 1 }),
      tmdbFetch('/discover/movie', { ...movieParams, page: 2 }),
      tmdbFetch('/discover/tv', { ...tvParams, page: 1 }),
      tmdbFetch('/discover/tv', { ...tvParams, page: 2 }),
    ]);
    const tvDetails = await Promise.all([...(t1.results || []), ...(t2.results || [])].slice(0, 25).map(t => tmdbFetch(`/tv/${t.id}`).catch(() => null)));
    return { movies: [...(m1.results || []), ...(m2.results || [])], tvDetails: tvDetails.filter(Boolean) };
  });

const omdbRatings = publicProcedure
  .input(z.object({ title: z.string().min(1) }))
  .query(async ({ input }) => {
    const key = requireEnv(OMDB_API_KEY, 'OMDB_API_KEY');
    const url = new URL(OMDB_BASE_URL);
    url.searchParams.set('t', input.title);
    url.searchParams.set('apikey', key);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`OMDb API error: ${response.status} ${response.statusText}`);
    return response.json();
  });

const aiRecommendations = publicProcedure
  .input(z.object({ titles: z.array(z.string()).min(1).max(25), favoriteGenres: z.array(z.string()).max(8).default([]) }))
  .mutation(async ({ input }) => {
    const genAI = new GoogleGenerativeAI(requireEnv(GEMINI_API_KEY, 'GEMINI_API_KEY'));
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const prompt = `User top rated/watched titles:\n${input.titles.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\nFavorite genres: ${input.favoriteGenres.join(', ') || 'unknown'}\nRecommend 10 movies or shows the user has not seen. Return JSON array only: [{"title":"...","reason":"short reason"}].`;
    const result = await model.generateContent(prompt);
    return { text: result.response.text() };
  });

/**
 * ✅ FIXED: Uses CORS Proxy to bypass Render IP blocking on Torrentio
 */
const scrapeVideoSource = publicProcedure
  .input(z.object({
    tmdbId: z.number(),
    type: z.enum(['movie', 'series']).default('movie')
  }))
  .mutation(async ({ input }) => {
    try {
      // 1. Get IMDB ID from TMDB      console.log(`🔍 Fetching IMDB ID for TMDB ID: ${input.tmdbId}`);
      const details = await tmdbFetch(`/movie/${input.tmdbId}`, { append_to_response: 'external_ids' });
      
      const imdbId = details.external_ids?.imdb_id;
      if (!imdbId) throw new Error('IMDB ID not found in TMDB external IDs');
      
      console.log(`✅ Found IMDB ID: ${imdbId}`);

      // 2. Check cache first
      const cacheKey = `${input.type}:${imdbId}`;
      const cached = torrentCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        console.log(` Cache hit for ${cacheKey}`);
        return cached.data;
      }

      // 3. Fetch streams via CORS Proxy to avoid IP blocks
      const targetUrl = `https://torrentio.strem.fun/stream/${input.type}/${imdbId}.json`;
      // Using allorigins.win as primary proxy, corsproxy.io as fallback
      const proxyUrls = [
        `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
        `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`
      ];

      let lastError;
      for (let attempt = 1; attempt <= proxyUrls.length; attempt++) {
        try {
          console.log(` Attempt ${attempt}: Fetching via proxy for ${imdbId}`);
          const response = await fetch(proxyUrls[attempt - 1], {
            signal: AbortSignal.timeout(15000) // 15s timeout
          });

          const text = await response.text();
          
          // Check if response is actually JSON (not HTML block page)
          if (text.trim().startsWith('<')) {
            throw new Error(`Proxy returned HTML instead of JSON (Attempt ${attempt})`);
          }

          const data = JSON.parse(text);
          
          // Handle empty results gracefully
          if (!data.streams || data.streams.length === 0) {
            console.log(`️ No streams found on Torrentio for ${imdbId}`);
            return { success: true, sources: [], source: 'torrentio' };          }

          // Transform streams
          const streams = data.streams.map(stream => ({
            title: stream.title.replace(/\s*\d+\s*️/g, '').trim(),
            magnet: stream.url,
            seeders: parseInt(stream.title.match(/👤\s*(\d+)/)?.[1] || '0'),
            size: stream.title.match(/\s*([\d.]+\s*[A-Z]+)/)?.[1] || 'Unknown',
            indexer: 'Torrentio'
          })).filter(s => s.magnet && s.magnet.startsWith('magnet:'));

          const result = {
            success: true,
            sources: streams,
            source: 'torrentio'
          };

          // Store in cache
          torrentCache.set(cacheKey, { data: result, timestamp: Date.now() });
          
          console.log(`✅ Found ${streams.length} streams via Torrentio (Proxy ${attempt})`);
          return result;

        } catch (err) {
          lastError = err;
          console.warn(`⚠️ Proxy attempt ${attempt} failed: ${err.message}`);
        }
      }

      throw new Error(`All proxies failed: ${lastError.message}`);

    } catch (error) {
      console.error('Scrape failed:', error);
      return { success: false, message: error.message };
    }
  });

export const appRouter = router({
  movies: router({
    search: searchMovies,
    scrapeVideoSource,
  }),
  tmdb: router({
    search: searchTmdb,
    details: tmdbDetails,
    collection: tmdbCollection,
    watchProviders: tmdbWatchProviders,
    seasonDetails: tmdbSeasonDetails,
    recommendations: tmdbRecommendations,
    upcomingDiscovery: tmdbUpcomingDiscovery,
  }),
  omdb: router({
    ratings: omdbRatings,
  }),
  ai: router({
    recommendations: aiRecommendations,
  }),
});

export {};
