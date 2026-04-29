import sharp from 'sharp';
import { join, basename, extname } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { config } from '../config.js';

/**
 * Generate a thumbnail for an image file.
 * @param {string} inputPath - Full path to source image
 * @param {string} mediaId - UUID of the media file
 * @returns {string} - Path to generated thumbnail
 */
export async function generateThumbnail(inputPath, mediaId) {
  if (!existsSync(config.THUMBNAILS_DIR)) {
    mkdirSync(config.THUMBNAILS_DIR, { recursive: true });
  }

  const thumbPath = join(config.THUMBNAILS_DIR, `${mediaId}_thumb.jpg`);

  await sharp(inputPath)
    .resize(300, 300, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toFile(thumbPath);

  return thumbPath;
}

/**
 * Resize image for LLM processing (reduce tokens usage).
 * @param {string} inputPath
 * @returns {Buffer} - Resized image as base64 string
 */
export async function resizeForAnalysis(inputPath) {
  const buffer = await sharp(inputPath)
    .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();

  return buffer.toString('base64');
}

/**
 * Get image metadata (width, height, format, size).
 */
export async function getImageMetadata(inputPath) {
  const meta = await sharp(inputPath).metadata();
  return {
    width: meta.width,
    height: meta.height,
    format: meta.format,
    channels: meta.channels,
    hasAlpha: meta.hasAlpha,
  };
}

export default { generateThumbnail, resizeForAnalysis, getImageMetadata };