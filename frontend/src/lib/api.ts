import axios from 'axios';
import type {
  UploadResponse,
  ChatResponse,
  AnalysisResponse,
  AudioAnalysis,
  MediaFile,
  Conversation,
  VideoFrame,
  Message,
} from './types';

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'
).replace(/\/+$/, '');
const API_ORIGIN = new URL(API_BASE).origin;

interface ApiErrorResponse {
  success: false;
  error: string;
}

type UploadApiResponse = UploadResponse | ApiErrorResponse;
type ChatApiResponse = ChatResponse | ApiErrorResponse;
type AnalysisApiResponse = AnalysisResponse | ApiErrorResponse;

interface RawMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  media_refs?: Message['mediaRefs'];
  created_at?: number;
}

interface RawConversation {
  id: string;
  title: string;
  created_at?: number;
  updated_at?: number;
  messages?: RawMessage[];
}

function toAbsoluteUrl(pathOrUrl: string | null | undefined): string | null {
  if (!pathOrUrl) return null;
  try {
    return new URL(pathOrUrl, API_ORIGIN).toString();
  } catch {
    return pathOrUrl;
  }
}

function mapMediaFile(media: MediaFile): MediaFile {
  return {
    ...media,
    url: toAbsoluteUrl(media.url) || '',
    thumbnailUrl: toAbsoluteUrl(media.thumbnailUrl),
  };
}

function mapVideoFrame(frame: VideoFrame): VideoFrame {
  return {
    ...frame,
    url: toAbsoluteUrl(frame.url) || frame.url,
  };
}

function mapMessage(message: RawMessage): Message {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    mediaRefs: message.media_refs || [],
    createdAt: message.created_at ? message.created_at * 1000 : undefined,
  };
}

function mapConversation(conversation: RawConversation): Conversation {
  return {
    id: conversation.id,
    title: conversation.title,
    createdAt: conversation.created_at ? conversation.created_at * 1000 : undefined,
    updatedAt: conversation.updated_at ? conversation.updated_at * 1000 : undefined,
    messages: conversation.messages?.map(mapMessage) || [],
  };
}

function isApiErrorResponse(response: unknown): response is ApiErrorResponse {
  return typeof response === 'object' && response !== null && 'error' in response;
}

const api = axios.create({
  baseURL: API_BASE,
  timeout: 120000,
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    console.error('API ERROR:', error?.response?.data || error.message);
    return Promise.reject(error);
  }
);

// ───────────────────────────────────────────────────────────────
// 🟦 Upload
// ───────────────────────────────────────────────────────────────

export async function uploadFile(
  file: File,
  onProgress?: (pct: number) => void
): Promise<MediaFile> {
  const form = new FormData();
  form.append('file', file);

  const { data } = await api.post<UploadApiResponse>('/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (onProgress && e.total) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    },
  });

  if (!data.success) {
    throw new Error(isApiErrorResponse(data) ? data.error : 'Upload failed');
  }
  return mapMediaFile(data.media);
}

export async function uploadBatch(
  files: File[],
  onProgress?: (pct: number) => void
): Promise<MediaFile[]> {
  const form = new FormData();
  files.forEach((f) => form.append('files', f));

  const { data } = await api.post<{
    success: boolean;
    error?: string;
    files?: MediaFile[];
  }>('/upload/batch', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (onProgress && e.total) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    },
  });

  if (!data.success) throw new Error(data.error || 'Batch upload failed');
  return (data.files || []).map(mapMediaFile);
}

// ───────────────────────────────────────────────────────────────
// 🟦 Chat
// ───────────────────────────────────────────────────────────────

export async function sendMessage(
  message: string,
  conversationId?: string,
  mediaRefs?: Array<{ id: string; type: string; name: string }>
): Promise<ChatResponse> {
  const { data } = await api.post<ChatApiResponse>('/chat', {
    message,
    conversationId,
    mediaRefs,
  });

  if (!data.success) {
    throw new Error(isApiErrorResponse(data) ? data.error : 'Chat request failed');
  }
  return {
    ...data,
    message: mapMessage(data.message as unknown as RawMessage),
  };
}

export function buildStreamUrl(
  message: string,
  conversationId?: string,
  mediaIds?: string[]
): string {
  const params = new URLSearchParams({ message });

  if (conversationId) params.set('conversationId', conversationId);
  if (mediaIds?.length) params.set('mediaIds', mediaIds.join(','));

  return `${API_BASE}/chat/stream?${params.toString()}`;
}

// ───────────────────────────────────────────────────────────────
// 🟦 Analysis
// ───────────────────────────────────────────────────────────────

export async function analyzeImage(
  mediaId: string,
  query: string,
  conversationId?: string
): Promise<AnalysisResponse> {
  const { data } = await api.post<AnalysisApiResponse>('/analyze/image', {
    mediaId,
    query,
    conversationId,
  });

  if (!data.success) {
    throw new Error(isApiErrorResponse(data) ? data.error : 'Image analysis failed');
  }
  return data;
}

export async function analyzeVideo(
  mediaId: string,
  query?: string,
  conversationId?: string
): Promise<AnalysisResponse> {
  const { data } = await api.post<AnalysisApiResponse>(
    '/analyze/video',
    { mediaId, query, conversationId },
    { timeout: 300000 }
  );

  if (!data.success) {
    throw new Error(isApiErrorResponse(data) ? data.error : 'Video analysis failed');
  }
  return data;
}

export async function analyzeAudio(
  mediaId: string,
  query?: string,
  conversationId?: string
): Promise<AnalysisResponse> {
  const { data } = await api.post<
    | {
        success: true;
        transcription: AudioAnalysis['transcription'];
        analysis: string;
        mediaId: string;
      }
    | ApiErrorResponse
  >('/analyze/audio', {
    mediaId,
    query,
    conversationId,
  });

  if (!data.success) {
    throw new Error(isApiErrorResponse(data) ? data.error : 'Audio analysis failed');
  }
  return {
    success: true,
    mediaId: data.mediaId,
    analysis: {
      transcription: data.transcription,
      analysis: data.analysis,
    },
  };
}

export async function analyzeDocument(
  mediaId: string,
  query?: string,
  conversationId?: string
): Promise<AnalysisResponse> {
  const { data } = await api.post<AnalysisApiResponse>('/analyze/document', {
    mediaId,
    query,
    conversationId,
  });

  if (!data.success) {
    throw new Error(isApiErrorResponse(data) ? data.error : 'Document analysis failed');
  }
  return data;
}

export async function compareMedia(
  mediaIds: string[],
  query: string,
  conversationId?: string
): Promise<AnalysisResponse> {
  const { data } = await api.post<AnalysisApiResponse>('/compare', {
    mediaIds,
    query,
    conversationId,
  });

  if (!data.success) {
    throw new Error(isApiErrorResponse(data) ? data.error : 'Comparison failed');
  }
  return data;
}

// ───────────────────────────────────────────────────────────────
// 🟦 Media
// ───────────────────────────────────────────────────────────────

export async function getVideoFrames(mediaId: string): Promise<VideoFrame[]> {
  const { data } = await api.get(`/media/${mediaId}/frames`);
  return (data.frames || []).map(mapVideoFrame);
}

export async function deleteMedia(mediaId: string): Promise<void> {
  await api.delete(`/media/${mediaId}`);
}

// ───────────────────────────────────────────────────────────────
// 🟦 Conversations
// ───────────────────────────────────────────────────────────────

export async function listConversations(): Promise<Conversation[]> {
  const { data } = await api.get<{ conversations?: RawConversation[] }>('/conversations');
  return (data.conversations || []).map(mapConversation);
}

export async function getConversation(id: string): Promise<Conversation> {
  const { data } = await api.get<{ conversation: RawConversation }>(`/conversations/${id}`);
  return mapConversation(data.conversation);
}

export async function deleteConversation(id: string): Promise<void> {
  await api.delete(`/conversations/${id}`);
}

export async function exportConversation(id: string): Promise<Blob> {
  const { data } = await api.post(
    `/export/${id}`,
    { format: 'markdown' },
    { responseType: 'blob' }
  );
  return data;
}
