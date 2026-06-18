import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { initDb } from './db/database.js';
import { contentRouter } from './routes/content.js';
import { queueRouter } from './routes/queue.js';
import { policiesRouter } from './routes/policies.js';

const app = express();

// Configure CORS to allow frontend domain
const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';
app.use(cors({
  origin: allowedOrigin,
  credentials: true,
}));

app.use(express.json({ limit: '1mb' }));

// Root route
app.get('/', (_req, res) => {
  res.json({ status: 'AI Content Moderation API is running', docs: '/api/health' });
});

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    model: process.env.MODERATION_MODEL || 'llama-3.3-70b-versatile',
    apiKeyConfigured: Boolean(process.env.GROQ_API_KEY),
  });
});

app.use('/api', contentRouter);
app.use('/api', queueRouter);
app.use('/api', policiesRouter);

const PORT = Number(process.env.PORT || 4000);

// sql.js init is async — start server only after DB is ready
initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`🛡️  Moderation API listening on http://localhost:${PORT}`);
  });
}).catch((err) => {
  console.error('Failed to initialise database:', err);
  process.exit(1);
});

// Check for API key on startup
if (!process.env.GROQ_API_KEY) {
  console.warn('⚠  GROQ_API_KEY is not set — classification calls will fail.');
}
