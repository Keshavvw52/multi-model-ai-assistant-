import express from 'express';
import cors from 'cors';
import { existsSync, mkdirSync } from 'fs';
import { config } from './config.js';
import { initDb } from './models/database.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';

import uploadRouter from './routes/upload.js';
import chatRouter from './routes/chat.js';
import analyzeRouter from './routes/analyze.js';
import mediaRouter from './routes/media.js';
import conversationsRouter from './routes/conversations.js';

// Ensure required directories
for (const dir of [config.UPLOADS_DIR, config.THUMBNAILS_DIR, config.FRAMES_DIR]) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

const app = express();

app.use(cors({
  origin: config.FRONTEND_URL,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

app.use('/api/upload', uploadRouter);
app.use('/api/chat', chatRouter);
app.use('/api/analyze', analyzeRouter);
app.use('/api/media', mediaRouter);
app.use('/api/conversations', conversationsRouter);
app.use('/api/export', conversationsRouter);

app.use(notFoundHandler);
app.use(errorHandler);

// Initialize DB then start server
initDb().then(() => {
  app.listen(config.PORT, () => {
    console.log(`\n Multi-Modal AI Assistant Backend`);
    console.log(`   Running on: http://localhost:${config.PORT}`);
    console.log(`   Environment: ${config.NODE_ENV}`);
    console.log(`   Groq API: ${config.GROQ_API_KEY ? '✓ Configured' : ' Missing GROQ_API_KEY'}\n`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});

export default app;