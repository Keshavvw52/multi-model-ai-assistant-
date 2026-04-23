'use client';

import { useState, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Message, MediaFile, Conversation } from '@/lib/types';
import { useStreaming } from '@/hooks/useStreaming';
import { getConversation, listConversations, deleteConversation } from '@/lib/api';

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [attachedMedia, setAttachedMedia] = useState<MediaFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Temp assistant message id during streaming
  const streamingMsgId = useRef<string | null>(null);

  const refreshConversations = useCallback(async () => {
    try {
      const list = await listConversations();
      setConversations(list);
    } catch (e) {
      console.error('Failed to load conversations:', e);
    }
  }, []);

  const { startStream, isStreaming, cancel } = useStreaming(
    // onChunk: update the streaming message in-place
    (text) => {
      if (!streamingMsgId.current) return;
      setMessages(prev =>
        prev.map(m =>
          m.id === streamingMsgId.current ? { ...m, content: text } : m
        )
      );
    },
    // onDone: finalize
    (convId, msgId) => {
      if (streamingMsgId.current) {
        setMessages(prev =>
          prev.map(m =>
            m.id === streamingMsgId.current
              ? { ...m, id: msgId, isStreaming: false }
              : m
          )
        );
      }
      streamingMsgId.current = null;
      setConversationId(convId);
      setIsLoading(false);
      refreshConversations();
    }
  );

  const sendMessage = useCallback(async (
    text: string,
    media?: MediaFile[]
  ) => {
    const mediaToUse = media || attachedMedia;

    // Add user message immediately
    const userMsg: Message = {
      id: uuidv4(),
      role: 'user',
      content: text,
      mediaRefs: mediaToUse.map(m => ({ id: m.id, type: m.mediaType, name: m.originalName })),
      createdAt: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);

    // Placeholder streaming message
    const tempId = uuidv4();
    streamingMsgId.current = tempId;
    const assistantMsg: Message = {
      id: tempId,
      role: 'assistant',
      content: '',
      isStreaming: true,
      createdAt: Date.now(),
    };
    setMessages(prev => [...prev, assistantMsg]);
    setIsLoading(true);
    setAttachedMedia([]);

    try {
      const result = await startStream(
        text,
        conversationId,
        mediaToUse.map(m => m.id)
      );

      if (result === null && streamingMsgId.current) {
        setMessages(prev =>
          prev.map(m =>
            m.id === streamingMsgId.current
              ? { ...m, content: 'Request failed. Please try again.', isStreaming: false }
              : m
          )
        );
        streamingMsgId.current = null;
        setIsLoading(false);
      }
    } catch (e) {
      console.error('Failed to send message:', e);
      if (streamingMsgId.current) {
        setMessages(prev =>
          prev.map(m =>
            m.id === streamingMsgId.current
              ? { ...m, content: 'Request failed. Please try again.', isStreaming: false }
              : m
          )
        );
      }
      streamingMsgId.current = null;
      setIsLoading(false);
    }
  }, [attachedMedia, conversationId, startStream]);

  const attachMedia = useCallback((media: MediaFile) => {
    setAttachedMedia(prev => {
      if (prev.find(m => m.id === media.id)) return prev;
      return [...prev, media];
    });
  }, []);

  const detachMedia = useCallback((mediaId: string) => {
    setAttachedMedia(prev => prev.filter(m => m.id !== mediaId));
  }, []);

  const loadConversation = useCallback(async (id: string) => {
    try {
      const conv = await getConversation(id);
      setConversationId(id);
      setMessages(conv.messages || []);
    } catch (e) {
      console.error('Failed to load conversation:', e);
    }
  }, []);

  const newConversation = useCallback(() => {
    cancel();
    setMessages([]);
    setConversationId(undefined);
    setAttachedMedia([]);
    streamingMsgId.current = null;
    setIsLoading(false);
  }, [cancel]);

  const removeConversation = useCallback(async (id: string) => {
    try {
      await deleteConversation(id);
      if (id === conversationId) newConversation();
      refreshConversations();
    } catch (e) {
      console.error('Failed to delete conversation:', e);
    }
  }, [conversationId, newConversation, refreshConversations]);

  return {
    messages,
    conversationId,
    conversations,
    attachedMedia,
    isLoading,
    isStreaming,
    sendMessage,
    attachMedia,
    detachMedia,
    loadConversation,
    newConversation,
    refreshConversations,
    removeConversation,
    cancelStream: cancel,
  };
}
