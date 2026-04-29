import { Router } from 'express';
import { mediaModel } from '../models/database.js';
import { getContextForLLM } from '../services/context-manager.js';
import {
  analyzeImage,
  analyzeVideoFrames,
  analyzeTranscript,
  compareMedia,
} from '../services/vision.js';
import { extractFrames, getVideoMetadata } from '../services/video-processor.js';
import { processAudio } from '../services/audio-processor.js';
import { parseDocument } from '../services/document-parser.js';

const router = Router();

/**
 * POST /api/analyze/image
 */
router.post('/image', async (req, res, next) => {
  try {
    const { mediaId, query, conversationId } = req.body;

    if (!mediaId || !query) {
      return res.status(400).json({ success: false, error: 'mediaId and query are required' });
    }

    const mediaFile = mediaModel.findById(mediaId);
    if (!mediaFile) {
      return res.status(404).json({ success: false, error: 'Media file not found' });
    }
    if (mediaFile.media_type !== 'image') {
      return res.status(400).json({ success: false, error: 'File is not an image' });
    }

    const history = conversationId ? await getContextForLLM(conversationId) : [];
    const finalQuery = query.trim();

    const analysis = await analyzeImage(mediaFile, finalQuery, history);

    mediaModel.updateAnalysis(mediaId, JSON.stringify(analysis));

    res.json({ success: true, analysis, mediaId });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/analyze/video
 * NOTE: Currently synchronous (can be moved to background job queue later)
 */
router.post('/video', async (req, res, next) => {
  try {
    const { mediaId, query, conversationId } = req.body;

    if (!mediaId) {
      return res.status(400).json({ success: false, error: 'mediaId is required' });
    }

    const mediaFile = mediaModel.findById(mediaId);
    if (!mediaFile) {
      return res.status(404).json({ success: false, error: 'Media file not found' });
    }
    if (mediaFile.media_type !== 'video') {
      return res.status(400).json({ success: false, error: 'File is not a video' });
    }

    let frames = [];
    let videoMeta = mediaFile.metadata;

    try {
      if (!videoMeta?.duration) {
        videoMeta = await getVideoMetadata(mediaFile.path);
        mediaModel.updateAnalysis(mediaId, JSON.stringify({ metadata: videoMeta }));
      }

      frames = await extractFrames(mediaFile.path, mediaId);
    } catch (err) {
      console.warn('[Video] Processing warning:', err.message);
    }

    const history = conversationId ? await getContextForLLM(conversationId) : [];
    const finalQuery = query?.trim() || 'Provide a comprehensive analysis of this video.';

    const analysis = await analyzeVideoFrames(
      frames,
      { ...mediaFile, metadata: videoMeta },
      finalQuery,
      history
    );

    mediaModel.updateAnalysis(mediaId, JSON.stringify(analysis));

    res.json({
      success: true,
      analysis,
      framesExtracted: frames.length,
      metadata: videoMeta,
      mediaId,
    });

  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/analyze/audio
 */
router.post('/audio', async (req, res, next) => {
  try {
    const { mediaId, query, conversationId } = req.body;

    if (!mediaId) {
      return res.status(400).json({ success: false, error: 'mediaId is required' });
    }

    const mediaFile = mediaModel.findById(mediaId);
    if (!mediaFile) {
      return res.status(404).json({ success: false, error: 'Media file not found' });
    }
    if (mediaFile.media_type !== 'audio') {
      return res.status(400).json({ success: false, error: 'File is not an audio file' });
    }

    let transcription;

    try {
      transcription = await processAudio(mediaFile.path, mediaFile.original_name);
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: 'Audio transcription failed',
      });
    }

    const history = conversationId ? await getContextForLLM(conversationId) : [];
    const finalQuery = query?.trim() || 'Summarize this audio and extract key insights.';

    const analysis = await analyzeTranscript(
      transcription,
      mediaFile,
      finalQuery,
      history
    );

    const result = { transcription, analysis };

    mediaModel.updateAnalysis(mediaId, JSON.stringify(result));

    res.json({
      success: true,
      transcription,
      analysis,
      mediaId,
    });

  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/analyze/document
 */
router.post('/document', async (req, res, next) => {
  try {
    const { mediaId, query, conversationId } = req.body;

    if (!mediaId) {
      return res.status(400).json({ success: false, error: 'mediaId is required' });
    }

    const mediaFile = mediaModel.findById(mediaId);
    if (!mediaFile) {
      return res.status(404).json({ success: false, error: 'Media file not found' });
    }
    if (!['document', 'image'].includes(mediaFile.media_type)) {
      return res.status(400).json({
        success: false,
        error: 'File is not a document or image',
      });
    }

    const history = conversationId ? await getContextForLLM(conversationId) : [];
    const finalQuery = query?.trim() || 'Extract and analyze all important information from this document.';

    const analysis = await parseDocument(mediaFile, finalQuery, history);

    mediaModel.updateAnalysis(mediaId, JSON.stringify(analysis));

    res.json({ success: true, analysis, mediaId });

  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/compare
 */
router.post('/compare', async (req, res, next) => {
  try {
    const { mediaIds, query, conversationId } = req.body;

    if (!mediaIds || !Array.isArray(mediaIds) || mediaIds.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'At least 2 mediaIds required',
      });
    }

    const mediaFiles = mediaIds
      .map(id => mediaModel.findById(id))
      .filter(Boolean);

    if (mediaFiles.length !== mediaIds.length) {
      return res.status(404).json({
        success: false,
        error: 'Some media files not found',
      });
    }

    const history = conversationId ? await getContextForLLM(conversationId) : [];
    const finalQuery = query?.trim() || 'Compare these media files and highlight similarities and differences.';

    const analysis = await compareMedia(mediaFiles, finalQuery, history);

    res.json({
      success: true,
      analysis,
      comparedFiles: mediaFiles.map(m => m.id),
    });

  } catch (error) {
    next(error);
  }
});

export default router;