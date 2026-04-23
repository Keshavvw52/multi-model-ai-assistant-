import { fileTypeFromBuffer } from 'file-type';
import { config } from '../config.js';

/**
 * Validates file using magic bytes (not just extension).
 * Returns { valid: boolean, mediaType: string, mimeType: string, error?: string }
 */
export async function validateFile(buffer, originalName, declaredMimeType) {
  // Detect real MIME type from file content
  const detected = await fileTypeFromBuffer(buffer);

  if (!detected) {
    // Could be plain text/PDF that file-type doesn't detect
    // Fall back to declared type for PDFs
    if (declaredMimeType === 'application/pdf') {
      // Check PDF magic bytes: %PDF
      if (buffer.slice(0, 4).toString() === '%PDF') {
        return { valid: true, mediaType: 'document', mimeType: 'application/pdf' };
      }
    }
    return { valid: false, error: 'Could not determine file type. File may be corrupt.' };
  }

  const mimeType = detected.mime;

  // Check images
  if (config.ALLOWED_IMAGE_TYPES.includes(mimeType)) {
    if (buffer.length > config.IMAGE_MAX_SIZE) {
      return { valid: false, error: `Image too large. Max size: ${config.IMAGE_MAX_SIZE / 1024 / 1024}MB` };
    }
    return { valid: true, mediaType: 'image', mimeType };
  }

  // Check videos
  if (config.ALLOWED_VIDEO_TYPES.includes(mimeType)) {
    if (buffer.length > config.VIDEO_MAX_SIZE) {
      return { valid: false, error: `Video too large. Max size: ${config.VIDEO_MAX_SIZE / 1024 / 1024}MB` };
    }
    return { valid: true, mediaType: 'video', mimeType };
  }

  // Check audio
  if (config.ALLOWED_AUDIO_TYPES.includes(mimeType)) {
    if (buffer.length > config.AUDIO_MAX_SIZE) {
      return { valid: false, error: `Audio too large. Max size: ${config.AUDIO_MAX_SIZE / 1024 / 1024}MB` };
    }
    return { valid: true, mediaType: 'audio', mimeType };
  }

  // Check documents
  if (config.ALLOWED_DOC_TYPES.includes(mimeType)) {
    if (buffer.length > config.DOC_MAX_SIZE) {
      return { valid: false, error: `Document too large. Max size: ${config.DOC_MAX_SIZE / 1024 / 1024}MB` };
    }
    return { valid: true, mediaType: 'document', mimeType };
  }

  return {
    valid: false,
    error: `Unsupported file type: ${mimeType}. Allowed: images (JPEG/PNG/GIF/WebP/BMP), videos (MP4/WebM/MOV/AVI), audio (MP3/WAV/M4A/OGG/FLAC), documents (PDF/images)`
  };
}

export default { validateFile };