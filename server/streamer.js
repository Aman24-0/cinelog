import torrentStream from 'torrent-stream';
import mime from 'mime-types';
import path from 'path';

// Rate limiting store (in-memory for simplicity; use Redis in production)
const requestCounts = new Map();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10;

// Validate magnet link format
function isValidMagnetLink(magnet) {
  if (!magnet || typeof magnet !== 'string') return false;
  // Basic magnet link format validation
  return magnet.startsWith('magnet:?xt=urn:btih:') && magnet.length > 40;
}

// Check rate limit for IP
function checkRateLimit(ip) {
  const now = Date.now();
  const userRequests = requestCounts.get(ip) || [];
  
  // Filter out old requests outside the window
  const recentRequests = userRequests.filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW_MS);
  
  if (recentRequests.length >= MAX_REQUESTS_PER_WINDOW) {
    return false; // Rate limited
  }
  
  recentRequests.push(now);
  requestCounts.set(ip, recentRequests);
  return true;
}

// Cleanup old rate limit data periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of requestCounts.entries()) {
    const recent = timestamps.filter(ts => now - ts < RATE_LIMIT_WINDOW_MS);
    if (recent.length === 0) {
      requestCounts.delete(ip);
    } else {
      requestCounts.set(ip, recent);
    }
  }
}, RATE_LIMIT_WINDOW_MS);

export const streamTorrent = async (req, res) => {
  const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
  
  // Rate limiting check
  if (!checkRateLimit(clientIP)) {
    console.warn(`⚠️ Rate limit exceeded for IP: ${clientIP}`);
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }
  
  const magnetUri = req.query.magnet;
  
  // Input validation
  if (!magnetUri) {
    console.warn(`❌ Missing magnet parameter from IP: ${clientIP}`);
    return res.status(400).json({ error: 'Missing magnet link' });
  }
  
  if (!isValidMagnetLink(magnetUri)) {
    console.warn(`❌ Invalid magnet link format from IP: ${clientIP}`);
    return res.status(400).json({ error: 'Invalid magnet link format' });
  }
  
  console.log(`📥 Starting stream for magnet: ${magnetUri.substring(0, 20)}... from IP: ${clientIP}`);

  // Initialize the torrent stream engine
  const engine = torrentStream(magnetUri, {
    connections: 30, // Reduced max peers for resource control
    path: '/tmp',    // Temporary storage on Render
    verify: true,     // Verify data integrity
    maxBufferLength: 10 * 1024 * 1024, // 10MB max buffer
  });

  let fileFound = false;
  let currentFile = null;
  let timeoutId = null;

  const cleanup = () => {
    if (timeoutId) clearTimeout(timeoutId);
    if (engine) engine.destroy();
  };

  // Handle engine errors
  engine.on('error', (err) => {
    console.error('❌ Torrent Stream Error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to initialize torrent stream' });
    }
    cleanup();
  });

  engine.on('ready', () => {
    console.log('✅ Torrent engine ready. Searching for video file...');
    
    // Find the largest video file in the torrent
    const files = engine.files;
    files.sort((a, b) => b.length - a.length); // Sort by size descending

    currentFile = files.find(f => {
      const ext = path.extname(f.name).toLowerCase();
      return ['.mp4', '.mkv', '.avi', '.mov', '.webm'].includes(ext);
    });

    if (!currentFile) {
      console.error('❌ No valid video file found in torrent.');
      if (!res.headersSent) {
        res.status(404).json({ error: 'No playable video file found in this torrent.' });
      }
      cleanup();
      return;
    }

    fileFound = true;
    console.log(`🎬 Selected file: ${currentFile.name} (${(currentFile.length / 1024 / 1024).toFixed(2)} MB)`);

    const mimeType = mime.lookup(currentFile.name) || 'video/mp4';
    const fileSize = currentFile.length;

    // Handle HTTP Range Requests (for seeking/pausing)
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = (end - start) + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': mimeType,
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*' // Allow Netlify to access
      });

      const stream = currentFile.createReadStream({ start, end });
      
      // Cleanup on close
      req.on('close', () => {
        console.log('🔌 Client disconnected. Stopping stream.');
        stream.destroy();
        cleanup();
      });

      stream.pipe(res);
    } else {
      // Non-range request (full file download - not recommended for video but fallback)
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': mimeType,
        'Access-Control-Allow-Origin': '*'
      });
      currentFile.createReadStream().pipe(res);
    }
  });

  // Timeout safety: If no file found within 30 seconds
  timeoutId = setTimeout(() => {
    if (!fileFound && !res.headersSent) {
      console.error('⏱️ Stream timeout: No file found within 30s');
      res.status(504).json({ error: 'Timeout: Could not find video file in torrent.' });
      cleanup();
    }
  }, 30000);
};
