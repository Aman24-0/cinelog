// server/scraper.js

export async function findVideoSource(movieTitle, year) {
  // Clean title aur year ko jodh kar exact query banana
  const cleanTitle = movieTitle.trim();
  const exactQuery = year ? `${cleanTitle} ${year}` : cleanTitle;
  
  console.log(`\n🎬 Prowlarr List Search For: "${exactQuery}"`);

  const baseUrl = (process.env.PROWLARR_URL || '').replace(/\/$/, '');
  const apiKey = process.env.PROWLARR_API_KEY;

  if (!baseUrl || !apiKey) {
    throw new Error("Render environment variables (PROWLARR_URL or PROWLARR_API_KEY) missing!");
  }

  try {
    const url = new URL(`${baseUrl}/api/v1/search`);
    url.searchParams.append('query', exactQuery);
    url.searchParams.append('type', 'search');
    // Removed categories parameter to avoid Prowlarr validation errors with comma-separated values.
    // Prowlarr will search all enabled indexers/categories by default.
    
    console.log(`📡 Fetching from Prowlarr: ${url.toString()}`);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-Api-Key': apiKey
      }
    });

    if (!response.ok) {
      throw new Error(`Prowlarr API returned HTTP Status ${response.status}`);
    }

    const results = await response.json();

    // Safety Check: Agar Prowlarr se array nahi mila toh crash na ho
    if (!results || !Array.isArray(results)) {
      console.log("⚠️ Prowlarr did not return an array. Response:", results);
      return [];
    }

    if (results.length === 0) {
      console.log(`❌ Zero results returned from Prowlarr for "${exactQuery}"`);
      return [];
    }

    // Seeders ke hisaab se sort karke top 20 nikalna
    const sorted = results.sort((a, b) => (b.seeders || 0) - (a.seeders || 0)).slice(0, 20);

    const streams = sorted.map(item => {
      let sizeStr = "Unknown Size";
      if (item.size) {
        sizeStr = (item.size / (1024 * 1024 * 1024)).toFixed(2) + " GB";
      }
      return {
        title: item.title || 'Unknown Title',
        link: item.magnetUrl || item.downloadUrl || null,
        seeders: item.seeders || 0,
        size: sizeStr,
        indexer: item.indexer || 'Torrent'
      };
    }).filter(item => item.link);

    console.log(`✅ Successfully extracted ${streams.length} playable streams.`);
    return streams;

  } catch (error) {
    console.error(`❌ Scraper Exception:`, error.message);
    throw error;
  }
}

export function getDemoVideoUrl() {
  return 'https://vjs.zencdn.net/v/oceans.mp4';
}
