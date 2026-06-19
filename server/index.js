import express from 'express';
import cors from 'cors';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { appRouter } from './routers.js';
import { streamTorrent } from './streamer.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ CRITICAL: Configure CORS for Netlify + Render
app.use(cors({
  origin: ['https://cinlog.netlify.app', 'http://localhost:5173', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Parse JSON bodies
app.use(express.json());

// ✅ FIXED: Changed '/trpc' to '/api/trpc' to match frontend
app.use('/api/trpc', createExpressMiddleware({
  router: appRouter,
  createContext: ({ req, res }) => ({ req, res }),
}));

// Streaming Endpoint
app.get('/api/stream', streamTorrent);

// Health Check
app.get('/', (req, res) => {
  res.json({ status: 'Cinelog Backend is Running 🚀' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 tRPC endpoint: http://localhost:${PORT}/api/trpc`);
  console.log(`🎬 Stream endpoint: http://localhost:${PORT}/api/stream`);
});
