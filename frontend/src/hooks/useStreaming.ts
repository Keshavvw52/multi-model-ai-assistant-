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

  // ✅ ALL hooks must be inside the function
  const esRef = useRef<EventSource | null>(null);
  const fullTextRef = useRef('');
  const resolveRef = useRef<(value: string | null) => void>();
  const rejectRef = useRef<(reason?: any) => void>();

  const cancel = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }

    // reject pending promise (important)
    rejectRef.current?.(new Error('Stream cancelled by user'));

    setState((prev) => ({
      ...prev,
      isStreaming: false,
    }));
  }, []);

  const reset = useCallback(() => {
    cancel();
    fullTextRef.current = '';
    setState({
      isStreaming: false,
      text: '',
      error: null,
      conversationId: null,
    });
  }, [cancel]);

  const startStream = useCallback(
    (message: string, conversationId?: string, mediaIds?: string[]) => {
      return new Promise<string | null>((resolve, reject) => {
        resolveRef.current = resolve;
        rejectRef.current = reject;

        const url = buildStreamUrl(message, conversationId, mediaIds);

        fullTextRef.current = '';
        setState({
          isStreaming: true,
          text: '',
          error: null,
          conversationId: null,
        });

        const es = new EventSource(url);
        esRef.current = es;

        es.addEventListener('start', (e: MessageEvent) => {
          const data = JSON.parse(e.data);
          setState((prev) => ({
            ...prev,
            conversationId: data.conversationId,
          }));
        });

        es.addEventListener('chunk', (e: MessageEvent) => {
          const data = JSON.parse(e.data);

          fullTextRef.current += data.text;

          setState((prev) => ({
            ...prev,
            text: fullTextRef.current,
          }));

          onChunk?.(data.text);
        });

        es.addEventListener('done', (e: MessageEvent) => {
          const data = JSON.parse(e.data);

          resolve(fullTextRef.current);

          onDone?.(data.conversationId, data.messageId);

          es.close();
          esRef.current = null;

          setState((prev) => ({
            ...prev,
            isStreaming: false,
          }));
        });

        es.addEventListener('error', (err) => {
          reject(err);

          es.close();
          esRef.current = null;

          setState((prev) => ({
            ...prev,
            isStreaming: false,
            error: 'Streaming failed',
          }));
        });
      });
    },
    [onChunk, onDone]
  );

  return { ...state, startStream, cancel, reset };
}