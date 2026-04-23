import { chatCompletion, streamChatCompletion } from './groq.js';
import { getImageMetadata, resizeForAnalysis } from './image-processor.js';
import { readFileSync, existsSync } from 'fs';
import { basename } from 'path';

/**
 * Build a descriptive prompt for an image to simulate vision input.
 * Since Groq doesn't support vision, we describe the image contextually.
 */
async function buildImageContext(mediaFile) {
  const meta = await getImageMetadata(mediaFile.path);
  return {
    description: `[IMAGE: ${mediaFile.original_name}]
- File: ${mediaFile.original_name}
- Format: ${meta.format?.toUpperCase() || mediaFile.mime_type}
- Dimensions: ${meta.width}x${meta.height} pixels
- Size: ${(mediaFile.size / 1024).toFixed(1)}KB`,
    metadata: meta,
  };
}

/**
 * Analyze an image with a user query using descriptive prompt simulation.
 * @param {Object} mediaFile - Media file record from DB
 * @param {string} query - User's question
 * @param {Array} conversationHistory - Prior messages for context
 * @returns {string} - AI analysis
 */
export async function analyzeImage(mediaFile, query, conversationHistory = []) {
  const { description } = await buildImageContext(mediaFile);

  const systemPrompt = `You are an advanced multi-modal AI assistant specialized in image analysis. 
You are analyzing an image based on its metadata and context. Provide detailed, helpful analysis.
When asked about image content, reason based on the filename, format, and any contextual clues available.
If uncertain about specific visual details, acknowledge it while providing the most helpful response possible.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.slice(-10), // Keep last 10 messages for context
    {
      role: 'user',
      content: `${description}\n\nUser Question: ${query}\n\nPlease analyze this image and answer the question thoroughly.`
    }
  ];

  return await chatCompletion(messages, { max_tokens: 1500 });
}

/**
 * Analyze an image and return streaming response.
 */
export async function* analyzeImageStream(mediaFile, query, conversationHistory = []) {
  const { description } = await buildImageContext(mediaFile);

  const systemPrompt = `You are an advanced multi-modal AI assistant specialized in image analysis. 
Analyze images based on metadata, filename patterns, and user context. Be detailed and helpful.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.slice(-10),
    {
      role: 'user',
      content: `${description}\n\nUser Question: ${query}`
    }
  ];

  yield* streamChatCompletion(messages, { max_tokens: 1500 });
}

/**
 * Compare multiple images by building a combined context prompt.
 * @param {Array} mediaFiles - Array of media file records
 * @param {string} query - Comparison question
 * @param {Array} conversationHistory
 * @returns {string}
 */
export async function compareMedia(mediaFiles, query, conversationHistory = []) {
  const contexts = await Promise.all(
    mediaFiles.map(async (mf, i) => {
      const { description } = await buildImageContext(mf);
      return `File ${i + 1}: ${description}`;
    })
  );

  const systemPrompt = `You are an expert at comparing and contrasting multiple media files. 
Analyze the provided files and give a comprehensive comparison based on their metadata and context.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.slice(-6),
    {
      role: 'user',
      content: `${contexts.join('\n\n')}\n\nComparison Question: ${query}`
    }
  ];

  return await chatCompletion(messages, { max_tokens: 2000 });
}

/**
 * Analyze video frames (represented as contextual descriptions).
 * @param {Array} frames - Array of { timestamp, framePath, index } objects
 * @param {Object} videoMetadata - Video file metadata
 * @param {string} query - User question
 * @param {Array} conversationHistory
 * @returns {Object} - { summary, scenes, keyMoments, frameDescriptions }
 */
export async function analyzeVideoFrames(frames, videoFile, query, conversationHistory = []) {
  // Build frame context descriptions
  const frameContexts = frames.map((f, i) => 
    `Frame ${i + 1} (at ${formatTimestamp(f.timestamp)}): extracted from ${videoFile.original_name}`
  ).join('\n');

  const systemPrompt = `You are an expert video analyst. You have access to key frames extracted from a video.
Analyze the video content and provide comprehensive insights including:
1. Overall summary
2. Scene-by-scene breakdown with timestamps
3. Key moments and events
4. Answer to the user's specific question`;

  const videoContext = `[VIDEO ANALYSIS: ${videoFile.original_name}]
Duration: ${videoFile.metadata?.duration ? formatTimestamp(videoFile.metadata.duration) : 'Unknown'}
Resolution: ${videoFile.metadata?.width || '?'}x${videoFile.metadata?.height || '?'}
FPS: ${videoFile.metadata?.fps || 'Unknown'}
Frames extracted: ${frames.length}

Extracted frames at these timestamps:
${frameContexts}`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.slice(-6),
    {
      role: 'user',
      content: `${videoContext}\n\nUser Query: ${query || 'Please provide a comprehensive analysis of this video.'}`
    }
  ];

  const analysis = await chatCompletion(messages, { max_tokens: 2500 });

  // Also generate structured breakdown
  const structuredPrompt = [
    { role: 'system', content: 'Return ONLY valid JSON. No markdown, no explanation.' },
    {
      role: 'user',
      content: `Based on this video analysis:
${analysis}

Return a JSON object with:
{
  "summary": "2-3 sentence summary",
  "scenes": [{"timestamp": "0:00", "description": "..."}],
  "keyMoments": [{"timestamp": "0:00", "event": "..."}]
}`
    }
  ];

  let structured = { summary: analysis, scenes: [], keyMoments: [] };
  try {
    const raw = await chatCompletion(structuredPrompt, { max_tokens: 1000, temperature: 0.2 });
    const cleaned = raw.replace(/```json|```/g, '').trim();
    structured = JSON.parse(cleaned);
  } catch (e) {
    // Use full analysis as summary if JSON parsing fails
    structured.summary = analysis;
  }

  return { ...structured, fullAnalysis: analysis, framesAnalyzed: frames.length };
}

/**
 * Stream video analysis
 */
export async function* analyzeVideoStream(frames, videoFile, query, conversationHistory = []) {
  const frameContexts = frames.map((f, i) => 
    `Frame ${i + 1} at ${formatTimestamp(f.timestamp)}`
  ).join(', ');

  const messages = [
    {
      role: 'system',
      content: `You are an expert video analyst. Analyze video content from extracted frames.`
    },
    ...conversationHistory.slice(-6),
    {
      role: 'user',
      content: `[VIDEO: ${videoFile.original_name}]\nExtracted ${frames.length} frames at: ${frameContexts}\n\nQuery: ${query || 'Analyze this video comprehensively.'}`
    }
  ];

  yield* streamChatCompletion(messages, { max_tokens: 2000 });
}

/**
 * Analyze audio transcription with LLM.
 */
export async function analyzeTranscript(transcription, audioFile, query, conversationHistory = []) {
  const systemPrompt = `You are an expert at analyzing audio transcriptions. 
Provide insightful analysis including summaries, action items, key topics, and answer user questions.`;

  const context = `[AUDIO TRANSCRIPTION: ${audioFile.original_name}]
Duration: ${transcription.duration ? formatTimestamp(transcription.duration) : 'Unknown'}
Language: ${transcription.language || 'Unknown'}

Full Transcription:
${transcription.text}

${transcription.segments?.length > 0 ? `
Timestamped Segments:
${transcription.segments.map(s => `[${formatTimestamp(s.start)}] ${s.text}`).join('\n')}
` : ''}`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.slice(-6),
    {
      role: 'user',
      content: `${context}\n\nUser Query: ${query || 'Please summarize this audio and extract key insights.'}`
    }
  ];

  return await chatCompletion(messages, { max_tokens: 2000 });
}

/**
 * Stream audio analysis
 */
export async function* analyzeTranscriptStream(transcription, audioFile, query, conversationHistory = []) {
  const messages = [
    {
      role: 'system',
      content: `You are an expert audio content analyzer. Analyze transcriptions and extract insights.`
    },
    ...conversationHistory.slice(-6),
    {
      role: 'user',
      content: `[AUDIO: ${audioFile.original_name}]\nTranscription: ${transcription.text}\n\nQuery: ${query || 'Summarize and analyze.'}`
    }
  ];

  yield* streamChatCompletion(messages, { max_tokens: 2000 });
}

/**
 * Analyze a document (PDF or image of document).
 */
export async function analyzeDocument(mediaFile, query, conversationHistory = []) {
  const systemPrompt = `You are an expert document analyst. Extract and analyze information from documents.
Identify: text content, tables, key data points, structure, and answer specific questions.
Return structured, organized information.`;

  const docContext = `[DOCUMENT: ${mediaFile.original_name}]
Type: ${mediaFile.mime_type}
Size: ${(mediaFile.size / 1024).toFixed(1)}KB
Filename analysis: ${analyzeFilename(mediaFile.original_name)}`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.slice(-6),
    {
      role: 'user',
      content: `${docContext}\n\nUser Query: ${query || 'Extract all important information from this document.'}`
    }
  ];

  return await chatCompletion(messages, { max_tokens: 2000 });
}

/**
 * Stream document analysis
 */
export async function* analyzeDocumentStream(mediaFile, query, conversationHistory = []) {
  const messages = [
    {
      role: 'system',
      content: `You are an expert document analyst. Extract and structure document information.`
    },
    ...conversationHistory.slice(-6),
    {
      role: 'user',
      content: `[DOCUMENT: ${mediaFile.original_name}]\nType: ${mediaFile.mime_type}\n\nQuery: ${query || 'Extract all key information.'}`
    }
  ];

  yield* streamChatCompletion(messages, { max_tokens: 2000 });
}

// Utility: Format seconds to MM:SS or HH:MM:SS
function formatTimestamp(seconds) {
  if (!seconds) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Utility: Extract context clues from filename
function analyzeFilename(filename) {
  const name = filename.toLowerCase();
  const hints = [];
  if (name.includes('invoice')) hints.push('invoice/billing document');
  if (name.includes('report')) hints.push('report');
  if (name.includes('contract')) hints.push('legal contract');
  if (name.includes('resume') || name.includes('cv')) hints.push('resume/CV');
  if (name.includes('chart') || name.includes('graph')) hints.push('chart/graph');
  if (name.includes('table')) hints.push('tabular data');
  if (name.includes('form')) hints.push('form');
  if (name.includes('note')) hints.push('notes');
  return hints.length > 0 ? `Likely a ${hints.join(', ')}` : 'General document';
}

export default {
  analyzeImage, analyzeImageStream,
  compareMedia,
  analyzeVideoFrames, analyzeVideoStream,
  analyzeTranscript, analyzeTranscriptStream,
  analyzeDocument, analyzeDocumentStream,
};