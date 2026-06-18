import torrentStream from 'torrent-stream';

export const streamTorrent = (req, res) => {
  const magnet = req.query.magnet;
  if (!magnet) {
    return res.status(400).send('Magnet link is required');
  }

  try {
    console.log('🔄 Starting Torrent Stream Engine (torrent-stream)...');
    
    // Engine start karte hain
    const engine = torrentStream(magnet);

    engine.on('ready', () => {
      // Sabse badi file dhoondho (jo video file hogi)
      const file = engine.files.reduce((a, b) => (a.length > b.length ? a : b));
      console.log(`✅ Ready to stream: ${file.name}`);

      const range = req.headers.range;
      if (!range) {
        res.writeHead(200, {
          'Content-Length': file.length,
          'Content-Type': 'video/mp4',
        });
        file.createReadStream().pipe(res);
        return;
      }

      // Video Seeking (aage-peeche karne) ke liye Range Header support
      const positions = range.replace(/bytes=/, '').split('-');
      const start = parseInt(positions[0], 10);
      const end = positions[1] ? parseInt(positions[1], 10) : file.length - 1;
      const chunksize = end - start + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${file.length}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'video/mp4',
      });

      // Video stream ko direct player tak pipe kar do
      file.createReadStream({ start, end }).pipe(res);
    });

    engine.on('error', (err) => {
      console.error('Engine error:', err);
    });

  } catch (err) {
    console.error('Streaming error:', err);
    res.status(500).send('Error starting stream');
  }
};
