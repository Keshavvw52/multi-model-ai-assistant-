import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

if (!process.env.GROQ_API_KEY) {
  console.error("❌ GROQ_API_KEY is missing in .env");
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

export const config = {
  PORT: process.env.PORT || 3001,
  NODE_ENV: process.env.NODE_ENV || 'development',

  // Groq API
  GROQ_API_KEY: process.env.GROQ_API_KEY,
  GROQ_BASE_URL: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
  GROQ_LLM_MODEL: process.env.GROQ_LLM_MODEL || 'llama-3.1-8b-instant',
  GROQ_WHISPER_MODEL: process.env.GROQ_WHISPER_MODEL || 'whisper-large-v3',

  // File paths
  UPLOADS_DIR: join(ROOT_DIR, 'uploads'),
  THUMBNAILS_DIR: join(ROOT_DIR, 'thumbnails'),
  FRAMES_DIR: join(ROOT_DIR, 'frames'),
  DB_PATH: join(ROOT_DIR, 'database.sqlite'),

  // File size limits
  IMAGE_MAX_SIZE: 20 * 1024 * 1024,
  VIDEO_MAX_SIZE: 100 * 1024 * 1024,
  AUDIO_MAX_SIZE: 50 * 1024 * 1024,
  DOC_MAX_SIZE: 20 * 1024 * 1024,

  // Allowed MIME types
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'],
  ALLOWED_VIDEO_TYPES: ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'],
  ALLOWED_AUDIO_TYPES: ['audio/mpeg', 'audio/wav', 'audio/x-m4a', 'audio/ogg', 'audio/flac', 'audio/mp4'],
  ALLOWED_DOC_TYPES: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],

  // Video processing
  FRAME_INTERVAL: 5,
  MAX_FRAMES: 20,

  // Cleanup
  FILE_TTL_HOURS: 24,

  // CORS
  FRONTEND_URL: process.env.FRONTEND_URL?.split(',') || ['http://localhost:3000'],
};

export default config;