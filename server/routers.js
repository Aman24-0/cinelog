import { z } from 'zod';
import { router, publicProcedure } from './trpc.js';

const TMDB_API_KEY = process.env.TMDB_API_KEY || 'your_tmdb_api_key_here';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

// In-memory cache to protect against Torrentio rate limits (5 min TTL)
const torrentCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Search movies using TMDB API
 */
const searchMovies = publicProcedure
  .input(z.object({ query: z.string().min(1) }))
  .query(async ({ input }) => {
    try {
      const response = await fetch(
        `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(input.query)}&page=1`
      );
      if (!response.ok) throw new Error(`TMDB API error: ${response.statusText}`);
      
      const data = await response.json();
      const movies = (data.results || []).slice(0, 10).map(movie => ({
        id: movie.id,
        title: movie.title,
        year: movie.release_date ? new Date(movie.release_date).getFullYear() : 'N/A',
        poster: movie.poster_path ? `https://image.tmdb.org/t/p/w300${movie.poster_path}` : null,
        overview: movie.overview || 'No overview available',
        rating: movie.vote_average || 0,
        imdb_id: movie.imdb_id || null, // ✅ CRITICAL: Pass IMDB ID to frontend
      }));

      return { success: true, movies, total: data.total_results };
    } catch (error) {
      console.error('Error searching movies:', error);
      return { success: false, movies: [], error: error.message };
    }
  });

/**
 * ✅ REPLACED: Uses FREE Torrentio API instead of Prowlarr
 * No server-side scraping needed!
 */
const scrapeVideoSource = publicProcedure
  .input(z.object({
    imdbId: z.string().min(1), // Torrentio requires IMDB ID
    type: z.enum(['movie', 'series']).default('movie')
  }))
  .mutation(async ({ input }) => {    try {
      // Check cache first to avoid rate limits
      const cacheKey = `${input.type}:${input.imdbId}`;
      const cached = torrentCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        console.log(` Returning cached streams for ${cacheKey}`);
        return cached.data;
      }

      console.log(`📡 Fetching streams from Torrentio for: ${cacheKey}`);
      
      // Direct call to free public Torrentio API
      const response = await fetch(
        `https://torrentio.strem.fun/stream/${input.type}/${input.imdbId}.json`
      );

      if (!response.ok) throw new Error('Torrentio API unavailable');
      
      const data = await response.json();
      
      // Transform Torrentio format to match existing VideoPlayer
      const streams = (data.streams || []).map(stream => ({
        title: stream.title.replace(/\s*\d+\s*️/g, '').trim(),
        magnet: stream.url, // Torrentio returns direct magnet links
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
      
      console.log(`✅ Found ${streams.length} streams via Torrentio`);
      return result;
    } catch (error) {
      console.error('Torrentio scrape failed:', error);
      return { success: false, message: error.message };
    }
  });

/**
 * Get TMDB configuration
 */
const getTmdbConfig = publicProcedure.query(async () => {  try {
    const res = await fetch(`${TMDB_BASE_URL}/configuration?api_key=${TMDB_API_KEY}`);
    const config = await res.json();
    return { success: true, imageBaseUrl: config.images.base_url };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

/**
 * Health check
 */
const health = publicProcedure.query(() => ({
  status: 'ok',
  timestamp: new Date().toISOString(),
}));

export const appRouter = router({
  movies: router({
    search: searchMovies,
    scrapeVideoSource,
    getTmdbConfig,
  }),
  health,
});

export {};
