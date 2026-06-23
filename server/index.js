import express from 'express';
import cors from 'cors';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { appRouter } from './routers.js';
import { streamTorrent } from './streamer.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: ['https://cinlog.netlify.app', 'http://localhost:5173'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());

// ✅ FIXED: Path now matches frontend /api/trpc
app.use('/api/trpc', createExpressMiddleware({
  router: appRouter,
  createContext: ({ req, res }) => ({ req, res }),
}));

// Streaming Proxy (Still needed for CORS bypass)
app.get('/api/stream', streamTorrent);

app.get('/', (req, res) => {
  res.json({ status: 'Cinelog Backend Running 🚀 (Torrentio Mode)' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(` tRPC: http://localhost:${PORT}/api/trpc`);
  console.log(`🎬 Stream: http://localhost:${PORT}/api/stream`);
});
