/**
 * Scraper configuration using clean fetch requests instead of heavy puppeteer
 */
const SCRAPER_SOURCES = [
  {
    name: 'HiMovies',
    searchUrl: (title) => `https://himovies.to/search/${encodeURIComponent(title)}`,
  },
  {
    name: 'Flixtor',
    searchUrl: (title) => `https://flixtor.to/search/${encodeURIComponent(title)}`,
  }
];

/**
 * Superfast Fetch-based scraping logic
 */
async function scrapeFromSource(movieTitle, source) {
  try {
    const searchUrl = source.searchUrl(movieTitle);
    console.log(`🔍 Fetching stream from ${source.name}: ${searchUrl}`);
    
    // Direct fetch request instead of loading a heavy browser
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) return null;
    const html = await response.text();

    // Regex to extract video links (.mp4 or .m3u8) directly from the page source
    const streamRegex = /(https?:\/\/[^\s"'><]+\.(?:mp4|m3u8|mkv)(?:[^\s"'><]*))/gi;
    const matches = html.match(streamRegex);

    if (matches && matches.length > 0) {
      // Return the first clean playable link found
      const videoUrl = matches[0];
      console.log(`✅ Found Live Stream Link: ${videoUrl}`);
      return videoUrl;
    }

    return null;
  } catch (error) {
    console.error(`❌ Error fetching from ${source.name}:`, error.message);
    return null;
  }
}

export async function findVideoSource(movieTitle) {
  console.log(`\n🎬 Starting live fetch for: "${movieTitle}"`);
  
  for (const source of SCRAPER_SOURCES) {
    const videoUrl = await scrapeFromSource(movieTitle, source);
    if (videoUrl) return videoUrl;
  }

  console.log(`❌ No stream found across sources for "${movieTitle}"`);
  return null;
}

/**
 * Fallback: Standard working sample video that never fails in VideoJS
 */
export function getDemoVideoUrl() {
  return 'https://vjs.zencdn.net/v/oceans.mp4';
}
