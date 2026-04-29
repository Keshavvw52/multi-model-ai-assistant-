// ─── Media ─────────────────────────────────────────────────────────────────

export type MediaType = 'image' | 'video' | 'audio' | 'document';

export interface MediaFile {
  id: string;
  originalName: string;
  mediaType: MediaType;
  mimeType: string;
  size: number;
  url: string;
  thumbnailUrl: string | null;
  metadata?: {
    width?: number;
    height?: number;
    duration?: number;
    fps?: number;
    format?: string;
    hasAudio?: boolean;
    videoCodec?: string;
    audioCodec?: string;
  };
  analysis?: string;
  createdAt?: number;
}

export interface VideoFrame {
  index: number;
  timestamp: number;
  filename: string;
  url: string;
}

// ─── Chat ───────────────────────────────────────────────────────────────────

export interface MediaRef {
  id: string;
  type: MediaType;
  name: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  mediaRefs?: MediaRef[];
  createdAt?: number;
  isStreaming?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt?: number;
  updatedAt?: number;
  messages?: Message[];
}

// ─── Analysis ───────────────────────────────────────────────────────────────

export interface VideoAnalysis {
  summary: string;
  scenes: Array<{ timestamp: string; description: string }>;
  keyMoments: Array<{ timestamp: string; event: string }>;
  fullAnalysis: string;
  framesAnalyzed: number;
}

export interface AudioAnalysis {
  transcription: {
    text: string;
    segments: Array<{ start: number; end: number; text: string }>;
    language: string;
    duration: number;
  };
  analysis: string;
}

// ─── API Responses ──────────────────────────────────────────────────────────

export interface UploadResponse {
  success: boolean;
  media: MediaFile;
}

export interface ChatResponse {
  success: boolean;
  conversationId: string;
  message: Message;
}

export interface AnalysisResponse {
  success: boolean;
  analysis: string | VideoAnalysis | AudioAnalysis;
  mediaId: string;
}

// ─── Upload State ────────────────────────────────────────────────────────────

export interface UploadState {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'processing' | 'done' | 'error';
  error?: string;
  result?: MediaFile;
}