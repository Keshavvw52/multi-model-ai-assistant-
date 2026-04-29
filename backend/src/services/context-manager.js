import { messageModel } from '../models/database.js';
import { chatCompletion } from './groq.js';

const MAX_MESSAGES_BEFORE_SUMMARY = 20;
const TOKEN_ESTIMATE_PER_CHAR = 0.25; // Rough estimate
const MAX_CONTEXT_TOKENS = 6000;

/**
 * Get conversation history formatted for LLM.
 * Handles context window management by summarizing old messages.
 */
export async function getContextForLLM(conversationId) {
  const messages = messageModel.findByConversation(conversationId);

  if (messages.length === 0) return [];

  // If too many messages, summarize older ones
  if (messages.length > MAX_MESSAGES_BEFORE_SUMMARY) {
    return await summarizeAndTruncate(messages);
  }

  return formatMessagesForLLM(messages);
}

/**
 * Format DB messages into LLM message format.
 */
function formatMessagesForLLM(messages) {
  return messages.map(msg => ({
    role: msg.role,
    content: buildMessageContent(msg),
  }));
}

/**
 * Build content string including media references.
 */
function buildMessageContent(msg) {
  let content = msg.content;

  if (msg.media_refs && msg.media_refs.length > 0) {
    const mediaInfo = msg.media_refs.map(ref => 
      `[Referenced: ${ref.type} file "${ref.name}" (ID: ${ref.id})]`
    ).join('\n');
    content = `${content}\n\n${mediaInfo}`;
  }

  return content;
}

/**
 * Summarize old messages to save context window space.
 */
async function summarizeAndTruncate(messages) {
  const oldMessages = messages.slice(0, -10); // All but last 10
  const recentMessages = messages.slice(-10);  // Keep last 10 verbatim

  try {
    const summaryPrompt = [
      {
        role: 'system',
        content: 'Summarize the following conversation history concisely, preserving key context, media references, and important information. Be brief but complete.'
      },
      {
        role: 'user',
        content: oldMessages.map(m => `${m.role}: ${buildMessageContent(m)}`).join('\n\n')
      }
    ];

    const summary = await chatCompletion(summaryPrompt, { max_tokens: 500, temperature: 0.3 });

    return [
      { role: 'system', content: `[Conversation Summary]: ${summary}` },
      ...formatMessagesForLLM(recentMessages),
    ];
  } catch (e) {
    // If summarization fails, just return last 10 messages
    return formatMessagesForLLM(recentMessages);
  }
}

export default { getContextForLLM };