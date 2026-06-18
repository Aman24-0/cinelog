import express from 'express';
import cors from 'cors';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { appRouter } from './routers.js';
import { createContext } from './context.js';
import { streamTorrent } from './streamer.js';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: function (origin, callback) {
    callback(null, true);
  },
  credentials: true,
}));
app.use(express.json());

app.use('/api/trpc', createExpressMiddleware({
  router: appRouter,
  createContext,
}));

// Torrent Streaming Route
app.get('/api/stream', streamTorrent);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`🎬 Cinelog Backend Server running on http://localhost:${PORT}`);
});
