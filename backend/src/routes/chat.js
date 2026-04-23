import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { conversationModel, messageModel, mediaModel } from '../models/database.js';
import { getContextForLLM } from '../services/context-manager.js';
import { streamChatCompletion, chatCompletion } from '../services/groq.js';
import {
  analyzeImageStream,
  analyzeVideoStream,
  analyzeTranscriptStream,
  analyzeDocumentStream,
} from '../services/vision.js';
import { processAudio } from '../services/audio-processor.js';
import { extractFrames } from '../services/video-processor.js';

const router = Router();

/**
 * POST /api/chat
 * Non-streaming chat
 */
router.post('/', async (req, res, next) => {
  try {
    let { conversationId, message, mediaRefs = [] } = req.body;

    if (!message?.trim()) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }

    // Create conversation if needed
    if (!conversationId) {
      conversationId = uuidv4();
      conversationModel.create(conversationId, message.slice(0, 60) || 'New Conversation');
    } else if (!conversationModel.findById(conversationId)) {
      conversationModel.create(conversationId, message.slice(0, 60));
    }

    // Save user message
    const userMsgId = uuidv4();
    messageModel.create(userMsgId, conversationId, 'user', message, mediaRefs);
    conversationModel.touch(conversationId);

    // Get context
    const history = await getContextForLLM(conversationId);

    // Use full history (system prompt handled in groq.js)
    const messages = [...history];

    const response = await chatCompletion(messages, { max_tokens: 2048 });

    // Save assistant response
    const assistantMsgId = uuidv4();
    messageModel.create(assistantMsgId, conversationId, 'assistant', response);
    conversationModel.touch(conversationId);

    res.json({
      success: true,
      conversationId,
      message: {
        id: assistantMsgId,
        role: 'assistant',
        content: response,
        created_at: Math.floor(Date.now() / 1000),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/chat/stream
 * Streaming via SSE
 */
router.get('/stream', async (req, res) => {
  const { message, conversationId: convId, mediaIds } = req.query;

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Keep connection alive (important)
  const keepAlive = setInterval(() => {
    res.write(': keep-alive\n\n');
  }, 15000);

  req.on('close', () => {
    clearInterval(keepAlive);
    console.log('🔌 Client disconnected');
  });

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const sendError = (error) => {
    sendEvent('error', { error });
    clearInterval(keepAlive);
    res.end();
  };

  try {
    if (!message?.trim()) {
      return sendError('Message is required');
    }

    let conversationId = convId;

    // Clean mediaIds
    const mediaRefIds = mediaIds
      ? mediaIds.split(',').map(id => id.trim()).filter(Boolean)
      : [];

    // Create conversation if needed
    if (!conversationId) {
      conversationId = uuidv4();
      conversationModel.create(conversationId, message.slice(0, 60));
    } else if (!conversationModel.findById(conversationId)) {
      conversationModel.create(conversationId, message.slice(0, 60));
    }

    // Load media references
    const mediaRefs = mediaRefIds
      .map(id => mediaModel.findById(id))
      .filter(Boolean)
      .map(m => ({
        id: m.id,
        type: m.media_type,
        name: m.original_name,
      }));

    // Save user message
    const userMsgId = uuidv4();
    messageModel.create(userMsgId, conversationId, 'user', message, mediaRefs);
    conversationModel.touch(conversationId);

    sendEvent('start', { conversationId, messageId: userMsgId });

    // Get context
    const history = await getContextForLLM(conversationId);
    const llmMessages = [...history];

    let fullResponse = '';
    const assistantMsgId = uuidv4();

    // Media-specific handling
    if (mediaRefs.length > 0) {
      const primaryMedia = mediaModel.findById(mediaRefIds[0]);

      if (primaryMedia) {
        let streamGen;

        if (primaryMedia.media_type === 'image') {
          streamGen = analyzeImageStream(primaryMedia, message, history.slice(0, -1));
        } else if (primaryMedia.media_type === 'video') {
          let frames = [];
          try {
            frames = await extractFrames(primaryMedia.path, primaryMedia.id);
          } catch (e) {
            console.warn('[Stream] Frame extraction failed:', e.message);
          }
          streamGen = analyzeVideoStream(frames, primaryMedia, message, history.slice(0, -1));
        } else if (primaryMedia.media_type === 'audio') {
          try {
            const transcription = await processAudio(primaryMedia.path, primaryMedia.original_name);
            streamGen = analyzeTranscriptStream(
              transcription,
              primaryMedia,
              message,
              history.slice(0, -1)
            );
          } catch (e) {
            streamGen = streamChatCompletion(llmMessages);
          }
        } else if (primaryMedia.media_type === 'document') {
          streamGen = analyzeDocumentStream(
            primaryMedia,
            message,
            history.slice(0, -1)
          );
        } else {
          streamGen = streamChatCompletion(llmMessages);
        }

        for await (const chunk of streamGen) {
          fullResponse += chunk;
          sendEvent('chunk', { text: chunk });
        }
      } else {
        for await (const chunk of streamChatCompletion(llmMessages)) {
          fullResponse += chunk;
          sendEvent('chunk', { text: chunk });
        }
      }
    } else {
      for await (const chunk of streamChatCompletion(llmMessages)) {
        fullResponse += chunk;
        sendEvent('chunk', { text: chunk });
      }
    }

    // Save assistant message
    messageModel.create(assistantMsgId, conversationId, 'assistant', fullResponse);
    conversationModel.touch(conversationId);

    sendEvent('done', { messageId: assistantMsgId, conversationId });

    clearInterval(keepAlive);
    res.end();

  } catch (error) {
    console.error('[Stream Error]', error);
    sendError(error.message || 'Streaming error');
  }
});

export default router;