import torrentStream from 'torrent-stream';
import mime from 'mime-types';
import path from 'path';

export const streamTorrent = async (req, res) => {
  const magnetUri = req.query.magnet;

  if (!magnetUri) {
    return res.status(400).json({ error: 'Missing magnet link' });
  }

  console.log(`📥 Starting stream for magnet: ${magnetUri.substring(0, 20)}...`);

  // Initialize the torrent stream engine
  const engine = torrentStream(magnetUri, {
    connections: 50, // Max peers
    path: '/tmp',    // Temporary storage on Render
    verify: true     // Verify data integrity
  });

  let fileFound = false;
  let currentFile = null;

  // Handle engine errors
  engine.on('error', (err) => {
    console.error('❌ Torrent Stream Error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to initialize torrent stream' });
    }
    engine.destroy();
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
      engine.destroy();
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
        engine.destroy();
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
  setTimeout(() => {
    if (!fileFound && !res.headersSent) {
      console.error('⏱️ Stream timeout: No file found within 30s');
      res.status(504).json({ error: 'Timeout: Could not find video file in torrent.' });
      engine.destroy();
    }
  }, 30000);
};
