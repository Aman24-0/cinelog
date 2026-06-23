import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { appRouter } from './routers.js';
import { createContext } from './context.js';

// Load environment variables
dotenv.config();

const app = express();

// ============================================
// Configuration & Validation
// ============================================
const PORT = process.env.PORT || 5000;

// Validate Port to prevent silent crashes
const portNumber = Number(PORT);
if (isNaN(portNumber) || portNumber < 1 || portNumber > 65535) {
  console.error(`❌ Invalid PORT value: "${PORT}". Please set a valid port number (1-65535) in your .env file.`);
  process.exit(1);
}

// ============================================
// Enhanced CORS Configuration
// ============================================
const corsOrigins = process.env.CORS_ORIGIN || 'http://localhost:5173';
const allowedOrigins = corsOrigins.split(',').map(origin => origin.trim());

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, Postman, or curl)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`️ Blocked CORS request from: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' })); // Added limit for larger payloads

// ============================================
// Health Check Route
// ============================================
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'CineLog Backend is running 🎬', 
    timestamp: new Date().toISOString() 
  });
});

// ============================================
// tRPC API Routes
// ============================================
app.use('/trpc', createExpressMiddleware({
  router: appRouter,
  createContext,
}));

// ============================================
// Global Error Handler
// ============================================
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err.message);
  res.status(500).json({ error: 'Internal Server Error' });
});

// ============================================
// Start Server
// ============================================
app.listen(portNumber, '0.0.0.0', () => {
  console.log(`✅ CineLog Backend running on port ${portNumber}`);
  console.log(` tRPC endpoint: http://localhost:${portNumber}/trpc`);
  console.log(`🔒 CORS enabled for: ${allowedOrigins.join(', ')}`);
});
