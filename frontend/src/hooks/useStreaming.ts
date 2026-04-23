'use client';

import { useState, useCallback, useRef } from 'react';
import { buildStreamUrl } from '@/lib/api';

interface StreamingState {
  isStreaming: boolean;
  text: string;
  error: string | null;
  conversationId: string | null;
}

interface UseStreamingReturn extends StreamingState {
  startStream: (
    message: string,
    conversationId?: string,
    mediaIds?: string[]
  ) => Promise<string | null>;
  cancel: () => void;
  reset: () => void;
}

export function useStreaming(
  onChunk?: (text: string) => void,
  onDone?: (conversationId: string, messageId: string) => void
): UseStreamingReturn {
  const [state, setState] = useState<StreamingState>({
    isStreaming: false,
    text: '',
    error: null,
    conversationId: null,
  });

  const esRef = useRef<EventSource | null>(null);
  const fullTextRef = useRef('');

  const cancel = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
    setState(prev => ({ ...prev, isStreaming: false }));
  }, []);

  const reset = useCallback(() => {
    cancel();
    fullTextRef.current = '';
    setState({ isStreaming: false, text: '', error: null, conversationId: null });
  }, [cancel]);

  const startStream = useCallback(async (
    message: string,
    conversationId?: string,
    mediaIds?: string[]
  ): Promise<string | null> => {
    // Cancel any existing stream
    cancel();
    fullTextRef.current = '';
    setState({ isStreaming: true, text: '', error: null, conversationId: conversationId || null });

    return new Promise((resolve) => {
      const url = buildStreamUrl(message, conversationId, mediaIds);
      const es = new EventSource(url);
      esRef.current = es;

      es.addEventListener('start', (e) => {
        try {
          const data = JSON.parse(e.data);
          setState(prev => ({ ...prev, conversationId: data.conversationId }));
        } catch {}
      });

      es.addEventListener('chunk', (e) => {
        try {
          const data = JSON.parse(e.data);
          fullTextRef.current += data.text;
          setState(prev => ({ ...prev, text: fullTextRef.current }));
          onChunk?.(fullTextRef.current);
        } catch {}
      });

      es.addEventListener('done', (e) => {
        try {
          const data = JSON.parse(e.data);
          es.close();
          esRef.current = null;
          setState(prev => ({ ...prev, isStreaming: false }));
          onDone?.(data.conversationId, data.messageId);
          resolve(fullTextRef.current);
        } catch {
          resolve(fullTextRef.current);
        }
      });

      es.addEventListener('error', (e) => {
        try {
          const data = JSON.parse((e as MessageEvent).data);
          setState(prev => ({ ...prev, isStreaming: false, error: data.error }));
        } catch {
          setState(prev => ({ ...prev, isStreaming: false, error: 'Streaming error occurred' }));
        }
        es.close();
        esRef.current = null;
        resolve(null);
      });

      es.onerror = () => {
        if (es.readyState === EventSource.CLOSED) {
          setState(prev => ({ ...prev, isStreaming: false }));
          resolve(fullTextRef.current || null);
        }
      };
    });
  }, [cancel, onChunk, onDone]);

  return { ...state, startStream, cancel, reset };
}