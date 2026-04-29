import { Router } from 'express';
import { createReadStream, existsSync, readdirSync } from 'fs';
import { unlink, rm } from 'fs/promises';
import { join } from 'path';
import path from 'path';
import { mediaModel } from '../models/database.js';
import { config } from '../config.js';

const router = Router();

/**
 * GET /api/media/:id
 * Serve original media
 */
router.get('/:id', (req, res, next) => {
  try {
    const media = mediaModel.findById(req.params.id);

    if (!media) {
      return res.status(404).json({ success: false, error: 'Media not found' });
    }

    if (!existsSync(media.path)) {
      return res.status(404).json({ success: false, error: 'File not found on disk' });
    }

    res.setHeader('Content-Type', media.mime_type);
    res.setHeader('Content-Disposition', `inline; filename="${media.original_name}"`);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Accept-Ranges', 'bytes');

    const stream = createReadStream(media.path);

    stream.on('error', (err) => {
      console.error('Stream error:', err);
      res.status(500).end();
    });

    stream.pipe(res);

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/media/:id/thumb
 * Serve thumbnail
 */
router.get('/:id/thumb', (req, res, next) => {
  try {
    const media = mediaModel.findById(req.params.id);

    if (!media) {
      return res.status(404).json({ success: false, error: 'Media not found' });
    }

    const thumbPath = media.thumbnail_path;

    if (!thumbPath || !existsSync(thumbPath)) {
      return res.status(404).json({ success: false, error: 'Thumbnail not available' });
    }

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');

    const stream = createReadStream(thumbPath);

    stream.on('error', () => res.status(500).end());

    stream.pipe(res);

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/media/:id/frames
 * List video frames
 */
router.get('/:id/frames', (req, res, next) => {
  try {
    const media = mediaModel.findById(req.params.id);

    if (!media) {
      return res.status(404).json({ success: false, error: 'Media not found' });
    }

    if (media.media_type !== 'video') {
      return res.status(400).json({ success: false, error: 'Not a video file' });
    }

    const framesDir = join(config.FRAMES_DIR, req.params.id);

    if (!existsSync(framesDir)) {
      return res.json({ success: true, frames: [] });
    }

    const frameFiles = readdirSync(framesDir)
      .filter(f => f.endsWith('.jpg'))
      .sort()
      .map((filename, index) => {
        const match = filename.match(/_(\d+)s\.jpg$/);
        const timestamp = match ? parseInt(match[1]) : index * config.FRAME_INTERVAL;

        return {
          index,
          timestamp,
          filename,
          url: `/api/media/${req.params.id}/frames/${filename}`,
        };
      });

    res.json({ success: true, frames: frameFiles });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/media/:id/frames/:filename
 * Serve individual frame (SAFE)
 */
router.get('/:id/frames/:filename', (req, res, next) => {
  try {
    const safeFilename = path.basename(req.params.filename);
    const framePath = join(config.FRAMES_DIR, req.params.id, safeFilename);

    if (!existsSync(framePath)) {
      return res.status(404).json({ success: false, error: 'Frame not found' });
    }

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');

    const stream = createReadStream(framePath);

    stream.on('error', () => res.status(500).end());

    stream.pipe(res);

  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/media/:id
 * Delete media and related files
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const media = mediaModel.findById(req.params.id);

    if (!media) {
      return res.status(404).json({ success: false, error: 'Media not found' });
    }

    // Delete main file
    await unlink(media.path).catch(() => {});

    // Delete thumbnail
    if (media.thumbnail_path) {
      await unlink(media.thumbnail_path).catch(() => {});
    }

    // Delete frames directory
    const framesDir = join(config.FRAMES_DIR, req.params.id);
    await rm(framesDir, { recursive: true, force: true }).catch(() => {});

    mediaModel.delete(req.params.id);

    res.json({
      success: true,
      message: 'Media deleted successfully',
    });

  } catch (error) {
    next(error);
  }
});

export default router;