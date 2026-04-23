import { Router } from 'express';
import { conversationModel, messageModel, mediaModel } from '../models/database.js';

const router = Router();

/**
 * GET /api/conversations
 * List all conversations.
 */
router.get('/', (req, res, next) => {
  try {
    const conversations = conversationModel.findAll();
    res.json({ success: true, conversations });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/conversations/:id
 * Get a conversation with full message history.
 */
router.get('/:id', (req, res, next) => {
  try {
    const conversation = conversationModel.findById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    const messages = messageModel.findByConversation(req.params.id);

    res.json({
      success: true,
      conversation: {
        ...conversation,
        messages,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/conversations/:id
 * Delete a conversation and all its messages.
 */
router.delete('/:id', (req, res, next) => {
  try {
    const conversation = conversationModel.findById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    messageModel.deleteByConversation(req.params.id);
    conversationModel.delete(req.params.id);

    res.json({ success: true, message: 'Conversation deleted' });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/export/:convId
 * Export conversation as Markdown.
 */
router.post('/:convId', (req, res, next) => {
  try {
    const conversation = conversationModel.findById(req.params.convId);
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    const messages = messageModel.findByConversation(req.params.convId);
    const { format = 'markdown' } = req.body;

    let content = '';

    if (format === 'markdown') {
      content = `# ${conversation.title}\n\n`;
      content += `*Exported on ${new Date().toLocaleDateString()}*\n\n---\n\n`;

      for (const msg of messages) {
        const role = msg.role === 'user' ? '**You**' : '**Assistant**';
        content += `${role}\n\n${msg.content}\n\n`;
        if (msg.media_refs?.length > 0) {
          content += `*Media: ${msg.media_refs.map(r => r.name).join(', ')}*\n\n`;
        }
        content += '---\n\n';
      }
    }

    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', `attachment; filename="conversation-${req.params.convId}.md"`);
    res.send(content);
  } catch (error) {
    next(error);
  }
});

export default router;
