import ffmpeg from 'fluent-ffmpeg';
import { join, basename } from 'path';
import { mkdirSync, existsSync, readdirSync } from 'fs';
import { config } from '../config.js';

/**
 * Get video metadata (duration, resolution, fps, codec, etc.)
 */
export function getVideoMetadata(videoPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) return reject(err);

      const videoStream = metadata.streams?.find(s => s.codec_type === 'video');
      const audioStream = metadata.streams?.find(s => s.codec_type === 'audio');
      const format = metadata.format;

      resolve({
        duration: parseFloat(format.duration) || 0,
        size: parseInt(format.size) || 0,
        bitrate: parseInt(format.bit_rate) || 0,
        width: videoStream?.width || 0,
        height: videoStream?.height || 0,
        fps: eval(videoStream?.r_frame_rate || '0/1') || 0, // e.g., "30000/1001"
        videoCodec: videoStream?.codec_name || 'unknown',
        audioCodec: audioStream?.codec_name || null,
        hasAudio: !!audioStream,
      });
    });
  });
}

/**
 * Extract frames from a video at fixed intervals.
 * @param {string} videoPath - Path to video file
 * @param {string} mediaId - UUID for organizing frames
 * @param {number} intervalSeconds - Extract one frame every N seconds
 * @returns {Array} - Array of { timestamp, framePath, index }
 */
export async function extractFrames(videoPath, mediaId, intervalSeconds = config.FRAME_INTERVAL) {
  const framesDir = join(config.FRAMES_DIR, mediaId);
  if (!existsSync(framesDir)) {
    mkdirSync(framesDir, { recursive: true });
  }

  const metadata = await getVideoMetadata(videoPath);
  const duration = metadata.duration;

  // Determine frame timestamps
  const timestamps = [];
  for (let t = 0; t <= duration; t += intervalSeconds) {
    timestamps.push(parseFloat(t.toFixed(2)));
  }

  // Limit to MAX_FRAMES
  const selectedTimestamps = timestamps.slice(0, config.MAX_FRAMES);

  // Extract frames using FFmpeg
  await new Promise((resolve, reject) => {
    let command = ffmpeg(videoPath);

    selectedTimestamps.forEach((ts, i) => {
      command = command
        .seekInput(ts)
        .output(join(framesDir, `frame_${String(i).padStart(4, '0')}_${Math.round(ts)}s.jpg`))
        .outputOptions(['-vframes 1', '-q:v 3', '-vf scale=640:-1']);
    });

    command
      .on('end', resolve)
      .on('error', reject)
      .run();
  });

  // Collect extracted frame paths
  const frameFiles = readdirSync(framesDir)
    .filter(f => f.endsWith('.jpg'))
    .sort();

  const frames = frameFiles.map((filename, index) => {
    const match = filename.match(/_(\d+)s\.jpg$/);
    const timestamp = match ? parseInt(match[1]) : index * intervalSeconds;
    return {
      index,
      timestamp,
      framePath: join(framesDir, filename),
      filename,
    };
  });

  return frames;
}

/**
 * Extract audio track from video file.
 * @param {string} videoPath
 * @param {string} mediaId
 * @returns {string} - Path to extracted audio file
 */
export function extractAudioFromVideo(videoPath, mediaId) {
  return new Promise((resolve, reject) => {
    const audioPath = join(config.UPLOADS_DIR, `${mediaId}_audio.mp3`);

    ffmpeg(videoPath)
      .noVideo()
      .audioCodec('libmp3lame')
      .audioBitrate('128k')
      .output(audioPath)
      .on('end', () => resolve(audioPath))
      .on('error', reject)
      .run();
  });
}

/**
 * Generate a poster/thumbnail frame from a video (at 10% duration).
 * @param {string} videoPath
 * @param {string} mediaId
 * @returns {string} - Path to thumbnail image
 */
export function generateVideoThumbnail(videoPath, mediaId) {
  return new Promise(async (resolve, reject) => {
    const thumbDir = config.THUMBNAILS_DIR;
    if (!existsSync(thumbDir)) mkdirSync(thumbDir, { recursive: true });

    const thumbFilename = `${mediaId}_thumb.jpg`;

    try {
      const meta = await getVideoMetadata(videoPath);
      const seekTime = Math.min(meta.duration * 0.1, 5); // 10% or 5 seconds

      ffmpeg(videoPath)
        .seekInput(seekTime)
        .output(join(thumbDir, thumbFilename))
        .outputOptions(['-vframes 1', '-q:v 3', '-vf scale=300:-1'])
        .on('end', () => resolve(join(thumbDir, thumbFilename)))
        .on('error', reject)
        .run();
    } catch (err) {
      reject(err);
    }
  });
}

export default {
  getVideoMetadata,
  extractFrames,
  extractAudioFromVideo,
  generateVideoThumbnail,
};