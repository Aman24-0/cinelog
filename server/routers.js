import { z } from 'zod';
import { router, publicProcedure } from './trpc.js';
import { findVideoSource, getDemoVideoUrl } from './scraper.js';

const TMDB_API_KEY = process.env.TMDB_API_KEY || 'your_tmdb_api_key_here';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

/**
 * Search movies using TMDB API
 */
const searchMovies = publicProcedure
  .input(z.object({
    query: z.string().min(1),
  }))
  .query(async ({ input }) => {
    try {
      const response = await fetch(
        `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(input.query)}&page=1`
      );
      
      if (!response.ok) {
        throw new Error(`TMDB API error: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Transform TMDB results
      const movies = (data.results || []).slice(0, 10).map(movie => ({
        id: movie.id,
        title: movie.title,
        year: movie.release_date ? new Date(movie.release_date).getFullYear() : 'N/A',
        poster: movie.poster_path ? `https://image.tmdb.org/t/p/w300${movie.poster_path}` : null,
        overview: movie.overview || 'No overview available',
        rating: movie.vote_average || 0,
      }));

      return {
        success: true,
        movies,
        total: data.total_results,
      };
    } catch (error) {
      console.error('Error searching movies:', error);
      return {
        success: false,
        movies: [],
        error: error.message,
      };
    }
  });

/**
 * Scrape video source for a movie
 */
const scrapeVideoSource = publicProcedure
  .input(z.object({
    movieTitle: z.string().min(1),
  }))
  .mutation(async ({ input }) => {
    try {
      console.log(`\n📡 Scraping video for: ${input.movieTitle}`);
      
      // Attempt to find video source
      const videoUrl = await findVideoSource(input.movieTitle);

      if (videoUrl) {
        return {
          success: true,
          videoUrl,
          source: 'scraped',
        };
      }

      // Fallback to demo video if scraping fails
      console.log('⚠️ Scraping failed, returning demo video');
      return {
        success: true,
        videoUrl: getDemoVideoUrl(),
        source: 'demo',
        message: 'Demo video (actual scraping failed)',
      };
    } catch (error) {
      console.error('Error scraping video:', error);
      
      // Return demo video as ultimate fallback
      return {
        success: true,
        videoUrl: getDemoVideoUrl(),
        source: 'demo_fallback',
        message: 'Using demo video due to error',
      };
    }
  });

/**
 * Get TMDB configuration (for image URLs, etc.)
 */
const getTmdbConfig = publicProcedure.query(async () => {
  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/configuration?api_key=${TMDB_API_KEY}`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch TMDB config');
    }

    const config = await response.json();
    return {
      success: true,
      imageBaseUrl: config.images.base_url,
      posterSizes: config.images.poster_sizes,
    };
  } catch (error) {
    console.error('Error fetching TMDB config:', error);
    return {
      success: false,
      error: error.message,
    };
  }
});

/**
 * Health check procedure
 */
const health = publicProcedure.query(() => {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
  };
});

export const appRouter = router({
  movies: router({
    search: searchMovies,
    scrapeVideoSource,
    getTmdbConfig,
  }),
  health,
});

// tRPC types frontend ke liye sirf compile-time par chahiye hote hain
export {};
