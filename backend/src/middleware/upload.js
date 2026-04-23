import multer from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { config } from '../config.js';
import { fileTypeFromBuffer } from 'file-type';

// Ensure upload directory exists
if (!existsSync(config.UPLOADS_DIR)) {
  mkdirSync(config.UPLOADS_DIR, { recursive: true });
}

// Use memory storage for validation first
const storage = multer.memoryStorage();

/**
 * Multer upload middleware (memory)
 */
export const uploadMiddleware = multer({
  storage,
  limits: {
    fileSize: config.VIDEO_MAX_SIZE, // Max allowed
    files: 10,
  },
}).fields([
  { name: 'file', maxCount: 1 },
  { name: 'files', maxCount: 10 },
]);

export const singleUpload = multer({
  storage,
  limits: { fileSize: config.VIDEO_MAX_SIZE },
}).single('file');

/**
 * Validate file type using magic bytes
 */
export async function validateFile(file) {
  if (!file || !file.buffer) {
    throw new Error('Invalid file');
  }

  const type = await fileTypeFromBuffer(file.buffer);

  if (!type) {
    throw new Error('Unable to detect file type');
  }

  const mime = type.mime;

  // Check against allowed types
  const isImage = config.ALLOWED_IMAGE_TYPES.includes(mime);
  const isVideo = config.ALLOWED_VIDEO_TYPES.includes(mime);
  const isAudio = config.ALLOWED_AUDIO_TYPES.includes(mime);
  const isDoc = config.ALLOWED_DOC_TYPES.includes(mime);

  if (!isImage && !isVideo && !isAudio && !isDoc) {
    throw new Error(`Unsupported file type: ${mime}`);
  }

  return {
    mime,
    ext: type.ext,
    category: isImage
      ? 'image'
      : isVideo
      ? 'video'
      : isAudio
      ? 'audio'
      : 'document',
  };
}

/**
 * Handle multer errors
 */
export function handleMulterError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,
      error: err.message,
    });
  }

  next(err);
}

export default {
  uploadMiddleware,
  singleUpload,
  validateFile,
  handleMulterError,
};