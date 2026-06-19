// server/scraper.js
export async function findVideoSource(movieTitle, year) {
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
    
    let attempts = 0;
    const maxAttempts = 3;
    let response;

    while (attempts < maxAttempts) {
      try {
        console.log(`📡 Fetching from Prowlarr (Attempt ${attempts + 1}/${maxAttempts}): ${url.toString()}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        response = await fetch(url.toString(), {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'X-Api-Key': apiKey
          },
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (response.status === 502 || response.status === 503 || response.status === 504) {
          throw new Error(`Prowlarr returned ${response.status} (Gateway Error)`);
        }

        if (!response.ok) {
          throw new Error(`Prowlarr API returned HTTP Status ${response.status}`);
        }

        break; 
      } catch (error) {
        attempts++;
        console.warn(`⚠️ Attempt ${attempts} failed: ${error.message}`);
        
        if (attempts >= maxAttempts) {
          throw new Error(`Prowlarr API failed after ${maxAttempts} attempts. Last error: ${error.message}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    const results = await response.json();

    if (!results || !Array.isArray(results)) {
      console.log("⚠️ Prowlarr did not return an array. Response: ", results);
      return [];
    }

    if (results.length === 0) {
      console.log(`❌ Zero results returned from Prowlarr for "${exactQuery}"`);
      return [];
    }

    const sorted = results.sort((a, b) => (b.seeders || 0) - (a.seeders || 0)).slice(0, 20);

    const streams = sorted.map(item => {
      let sizeStr = "Unknown Size";
      if (item.size) {
        sizeStr = (item.size / (1024 * 1024 * 1024)).toFixed(2) + " GB";
      }
      
      // ✅ FIXED: Key is now 'magnet' to match frontend VideoPlayer
      return {
        title: item.title || 'Unknown Title',
        magnet: item.magnetUrl || item.downloadUrl || null, 
        seeders: item.seeders || 0,
        size: sizeStr,
        indexer: item.indexer || 'Torrent'
      };
    }).filter(item => item.magnet); // ✅ FIXED: Filter checks 'magnet'

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
