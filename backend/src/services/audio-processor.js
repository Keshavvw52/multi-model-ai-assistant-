import { createReadStream } from 'fs';
import { basename } from 'path';
import { transcribeAudio } from './groq.js';

/**
 * Process an audio file: transcribe via Groq Whisper.
 * @param {string} audioPath - Path to audio file
 * @param {string} originalName - Original filename
 * @returns {Object} - { text, segments, language, duration }
 */
export async function processAudio(audioPath, originalName) {
  const audioStream = createReadStream(audioPath);

  // Create a File-like object with the correct name for the API
  const audioFile = await toFile(audioStream, originalName);

  const transcription = await transcribeAudio(audioFile, originalName);

  return transcription;
}

/**
 * Convert a ReadStream to a File object (required by Groq SDK).
 */
async function toFile(stream, filename) {
  // Collect stream into buffer
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  const buffer = Buffer.concat(chunks);

  // Create a Blob with the correct MIME type
  const mimeType = getMimeFromFilename(filename);
  const blob = new Blob([buffer], { type: mimeType });

  // Return as File
  return new File([blob], filename, { type: mimeType });
}

function getMimeFromFilename(filename) {
  const ext = filename.split('.').pop()?.toLowerCase();
  const mimes = {
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    m4a: 'audio/x-m4a',
    ogg: 'audio/ogg',
    flac: 'audio/flac',
    webm: 'audio/webm',
  };
  return mimes[ext] || 'audio/mpeg';
}

export default { processAudio };