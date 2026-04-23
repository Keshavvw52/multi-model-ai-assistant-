import { Router } from 'express';
import { writeFile } from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { uploadMiddleware } from '../middleware/upload.js';
import { validateFile } from '../middleware/upload.js';
import { generateThumbnail, getImageMetadata } from '../services/image-processor.js';
import { getVideoMetadata, generateVideoThumbnail } from '../services/video-processor.js';
import { mediaModel } from '../models/database.js';
import { config } from '../config.js';

const router = Router();

// Ensure directories exist
for (const dir of [config.UPLOADS_DIR, config.THUMBNAILS_DIR, config.FRAMES_DIR]) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

/**
 * Validate file size based on type
 */
function validateSize(file, category) {
  if (category === 'image' && file.size > config.IMAGE_MAX_SIZE) {
    throw new Error('Image exceeds size limit');
  }
  if (category === 'video' && file.size > config.VIDEO_MAX_SIZE) {
    throw new Error('Video exceeds size limit');
  }
  if (category === 'audio' && file.size > config.AUDIO_MAX_SIZE) {
    throw new Error('Audio exceeds size limit');
  }
  if (category === 'document' && file.size > config.DOC_MAX_SIZE) {
    throw new Error('Document exceeds size limit');
  }
}

/**
 * POST /api/upload
 * Single file upload
 */
router.post('/', (req, res, next) => {
  uploadMiddleware(req, res, async (err) => {
    if (err) return next(err);

    try {
      const file = req.files?.file?.[0] || req.files?.files?.[0];

      if (!file) {
        return res.status(400).json({ success: false, error: 'No file provided' });
      }

      // Validate file (magic bytes)
      const validation = await validateFile(file);

      // Validate size per type
      validateSize(file, validation.category);

      const mediaId = uuidv4();
      const ext = validation.ext; // ✅ secure extension
      const filename = `${mediaId}.${ext}`;
      const filePath = join(config.UPLOADS_DIR, filename);

      // Save file (async)
      await writeFile(filePath, file.buffer);

      let thumbnailPath = null;
      let metadata = {};

      // Process media
      try {
        if (validation.category === 'image') {
          metadata = await getImageMetadata(filePath);
          thumbnailPath = await generateThumbnail(filePath, mediaId);
        } else if (validation.category === 'video') {
          metadata = await getVideoMetadata(filePath);
          thumbnailPath = await generateVideoThumbnail(filePath, mediaId);
        }
      } catch (processingErr) {
        console.warn('[Upload] Processing warning:', processingErr.message);
      }

      // Save in DB
      const mediaRecord = mediaModel.create({
        id: mediaId,
        original_name: file.originalname,
        filename,
        mime_type: validation.mime,
        media_type: validation.category,
        size: file.size,
        path: filePath,
        thumbnail_path: thumbnailPath,
        metadata,
      });

      res.status(201).json({
        success: true,
        media: {
          id: mediaRecord.id,
          originalName: mediaRecord.original_name,
          mediaType: mediaRecord.media_type,
          mimeType: mediaRecord.mime_type,
          size: mediaRecord.size,
          metadata: mediaRecord.metadata,
          thumbnailUrl: thumbnailPath ? `/api/media/${mediaId}/thumb` : null,
          url: `/api/media/${mediaId}`,
        },
      });

    } catch (error) {
      next(error);
    }
  });
});

/**
 * POST /api/upload/batch
 * Multiple file upload
 */
router.post('/batch', (req, res, next) => {
  uploadMiddleware(req, res, async (err) => {
    if (err) return next(err);

    try {
      const files = req.files?.files || req.files?.file || [];

      if (!files.length) {
        return res.status(400).json({ success: false, error: 'No files provided' });
      }

      const results = [];

      for (const file of files) {
        try {
          const validation = await validateFile(file);
          validateSize(file, validation.category);

          const mediaId = uuidv4();
          const ext = validation.ext;
          const filename = `${mediaId}.${ext}`;
          const filePath = join(config.UPLOADS_DIR, filename);

          await writeFile(filePath, file.buffer);

          let thumbnailPath = null;
          let metadata = {};

          try {
            if (validation.category === 'image') {
              metadata = await getImageMetadata(filePath);
              thumbnailPath = await generateThumbnail(filePath, mediaId);
            } else if (validation.category === 'video') {
              metadata = await getVideoMetadata(filePath);
              thumbnailPath = await generateVideoThumbnail(filePath, mediaId);
            }
          } catch (e) {
            console.warn('[Batch Upload] Processing warning:', e.message);
          }

          const mediaRecord = mediaModel.create({
            id: mediaId,
            original_name: file.originalname,
            filename,
            mime_type: validation.mime,
            media_type: validation.category,
            size: file.size,
            path: filePath,
            thumbnail_path: thumbnailPath,
            metadata,
          });

          results.push({
            id: mediaRecord.id,
            originalName: mediaRecord.original_name,
            mediaType: mediaRecord.media_type,
            mimeType: mediaRecord.mime_type,
            thumbnailUrl: thumbnailPath ? `/api/media/${mediaId}/thumb` : null,
            url: `/api/media/${mediaId}`,
          });

        } catch (err) {
          results.push({
            originalName: file.originalname,
            error: err.message,
          });
        }
      }

      res.status(201).json({
        success: true,
        files: results,
      });

    } catch (error) {
      next(error);
    }
  });
});

export default router;