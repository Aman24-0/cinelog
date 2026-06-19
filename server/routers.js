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
      // Note: TMDB Search DOES NOT return imdb_id. We will fetch it later.
      const movies = (data.results || []).slice(0, 10).map(movie => ({
        id: movie.id,
        title: movie.title,
        year: movie.release_date ? new Date(movie.release_date).getFullYear() : 'N/A',
        poster: movie.poster_path ? `https://image.tmdb.org/t/p/w300${movie.poster_path}` : null,
        overview: movie.overview || 'No overview available',
        rating: movie.vote_average || 0,
        // imdb_id is intentionally omitted here as it's not in search results
      }));

      return { success: true, movies, total: data.total_results };
    } catch (error) {
      console.error('Error searching movies:', error);
      return { success: false, movies: [], error: error.message };
    }
  });

/**
 * ✅ FIXED: Now fetches IMDB ID from TMDB Details endpoint automatically
 */
const scrapeVideoSource = publicProcedure
  .input(z.object({
    tmdbId: z.number(), // Changed from imdbId string to tmdbId number
    type: z.enum(['movie', 'series']).default('movie')
  }))
  .mutation(async ({ input }) => {    try {
      // 1. First, get the IMDB ID from TMDB Details
      console.log(` Fetching IMDB ID for TMDB ID: ${input.tmdbId}`);
      const detailsRes = await fetch(
        `${TMDB_BASE_URL}/movie/${input.tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`
      );
      
      if (!detailsRes.ok) throw new Error('Failed to fetch movie details from TMDB');
      const details = await detailsRes.json();
      
      const imdbId = details.external_ids?.imdb_id;
      if (!imdbId) throw new Error('IMDB ID not found in TMDB external IDs');
      
      console.log(`✅ Found IMDB ID: ${imdbId}`);

      // 2. Check cache first
      const cacheKey = `${input.type}:${imdbId}`;
      const cached = torrentCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        console.log(`📦 Cache hit for ${cacheKey}`);
        return cached.data;
      }

      // 3. Fetch streams from Torrentio using the real IMDB ID
      console.log(`📡 Fetching streams from Torrentio for: ${imdbId}`);
      const response = await fetch(
        `https://torrentio.strem.fun/stream/${input.type}/${imdbId}.json`
      );

      if (!response.ok) throw new Error('Torrentio API unavailable');
      
      const data = await response.json();
      
      const streams = (data.streams || []).map(stream => ({
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
            console.log(`✅ Found ${streams.length} streams via Torrentio`);
      return result;
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
});

export {};
