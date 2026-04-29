import Groq from 'groq-sdk';
import { config } from '../config.js';

let groqClient = null;

/**
 * Initialize and reuse Groq client (Singleton)
 */
function getClient() {
  if (!groqClient) {
    if (!config.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY is not set in environment variables');
    }
    groqClient = new Groq({ apiKey: config.GROQ_API_KEY });
  }
  return groqClient;
}

/**
 * Add system prompt to every request
 */
function withSystemMessage(messages, options = {}) {
  return [
    {
      role: "system",
      content:
        options.systemPrompt ||
        "You are a multi-modal AI assistant that analyzes images, videos, audio, and documents intelligently."
    },
    ...messages
  ];
}

/**
 * Send a chat completion request to Groq LLM
 */
export async function chatCompletion(messages, options = {}) {
  try {
    const client = getClient();

    const finalMessages = withSystemMessage(messages, options);

    const response = await client.chat.completions.create({
      model: options.model || config.GROQ_LLM_MODEL,
      messages: finalMessages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens || 2048,
      ...options,
    });

    return response.choices[0]?.message?.content || '';
  } catch (error) {
    console.error("Groq chatCompletion error:", error.message);
    throw new Error("LLM request failed");
  }
}

/**
 * Stream chat completion (for SSE)
 */
export async function* streamChatCompletion(messages, options = {}) {
  try {
    const client = getClient();

    const finalMessages = withSystemMessage(messages, options);

    const stream = await client.chat.completions.create({
      model: options.model || config.GROQ_LLM_MODEL,
      messages: finalMessages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens || 2048,
      stream: true,
      ...options,
    });

    for await (const chunk of stream) {
      const text = chunk.choices?.[0]?.delta?.content;
      if (text) {
        yield text;
      }
    }
  } catch (error) {
    console.error("Groq streaming error:", error.message);
    throw new Error("Streaming failed");
  }
}

/**
 * Transcribe audio using Groq Whisper
 */
export async function transcribeAudio(audioFile, filename) {
  try {
    const client = getClient();

    const transcription = await client.audio.transcriptions.create({
      file: audioFile,
      model: config.GROQ_WHISPER_MODEL,
      response_format: 'verbose_json',
      timestamp_granularities: ['segment'],
    });

    return {
      text: transcription.text,
      segments: transcription.segments || [],
      language: transcription.language || 'en',
      duration: transcription.duration || 0,
    };
  } catch (error) {
    console.error("Groq transcription error:", error.message);
    throw new Error("Audio transcription failed");
  }
}

export default {
  chatCompletion,
  streamChatCompletion,
  transcribeAudio,
};