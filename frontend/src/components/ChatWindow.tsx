'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import type { MediaFile, Message } from '@/lib/types';
import { ChatMessage } from './ChatMessage';
import { MediaPreview } from './MediaPreview';
import { useMediaUpload } from '@/hooks/useMediaUpload';

interface ChatWindowProps {
  messages: Message[];
  mediaFiles: Map<string, MediaFile>;
  attachedMedia: MediaFile[];
  isLoading: boolean;
  onSend: (text: string, media?: MediaFile[]) => void;
  onMediaUploaded: (media: MediaFile) => void;
  onDetachMedia: (id: string) => void;
}

export function ChatWindow({
  messages,
  mediaFiles,
  attachedMedia,
  isLoading,
  onSend,
  onMediaUploaded,
  onDetachMedia,
}: ChatWindowProps) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { upload, activeUploads } = useMediaUpload();

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [input]);

  const handleSend = () => {
    const text = input.trim();
    if (!text && attachedMedia.length === 0) return;
    onSend(text || 'Analyze this media.', attachedMedia);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // File drop on input area
  const onDrop = useCallback(async (accepted: File[]) => {
    for (const file of accepted) {
      const result = await upload(file);
      if (result) onMediaUploaded(result);
    }
  }, [upload, onMediaUploaded]);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    noClick: true,
    noKeyboard: true,
  });

  // Clipboard paste support
  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    const imageItem = items.find(item => item.type.startsWith('image/'));
    if (imageItem) {
      const file = imageItem.getAsFile();
      if (file) {
        const renamed = new File([file], `paste-${Date.now()}.png`, { type: file.type });
        const result = await upload(renamed);
        if (result) onMediaUploaded(result);
      }
    }
  }, [upload, onMediaUploaded]);

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-full" {...getRootProps()}>
      <input {...getInputProps()} />

      {/* Drag overlay */}
      {isDragActive && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-accent/10 border-2 border-dashed border-accent rounded-2xl pointer-events-none animate-fade-in">
          <div className="text-5xl mb-3">📂</div>
          <p className="text-lg font-semibold text-accent">Drop to upload</p>
          <p className="text-sm text-accent/70">Images, videos, audio, PDFs</p>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-16 select-none">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-accent to-accent-dark flex items-center justify-center text-4xl text-white mb-5 shadow-lg shadow-accent/20">
              ✦
            </div>
            <h2 className="text-xl font-semibold text-surface-800 mb-2">Multi-Modal AI Assistant</h2>
            <p className="text-sm text-surface-500 max-w-xs leading-relaxed">
              Upload images, videos, audio, or documents and have an intelligent conversation about them.
            </p>
            <div className="grid grid-cols-2 gap-3 mt-8 max-w-xs w-full">
              {[
                { icon: '🖼', label: 'Analyze Images', sub: 'Ask questions about visuals' },
                { icon: '🎬', label: 'Process Videos', sub: 'Scenes & key moments' },
                { icon: '🎵', label: 'Transcribe Audio', sub: 'Timestamped text' },
                { icon: '📄', label: 'Parse Documents', sub: 'Extract data & tables' },
              ].map(item => (
                <div key={item.label} className="p-3 rounded-xl border border-surface-200 bg-white text-left hover:border-accent/40 hover:shadow-sm transition-all">
                  <span className="text-xl">{item.icon}</span>
                  <p className="text-xs font-semibold text-surface-700 mt-1.5">{item.label}</p>
                  <p className="text-[11px] text-surface-400">{item.sub}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          messages.map(msg => (
            <ChatMessage key={msg.id} message={msg} mediaFiles={mediaFiles} />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Upload progress */}
      {activeUploads.length > 0 && (
        <div className="px-4 pb-2 space-y-2">
          {activeUploads.map((u, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2 bg-surface-50 rounded-xl border border-surface-200">
              <span className="text-xs text-surface-600 truncate flex-1">{u.file.name}</span>
              <div className="w-24 h-1 bg-surface-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-all"
                  style={{ width: `${u.progress}%` }}
                />
              </div>
              <span className="text-xs text-surface-400 tabular-nums">{u.progress}%</span>
            </div>
          ))}
        </div>
      )}

      {/* Attached media chips */}
      {attachedMedia.length > 0 && (
        <div className="px-4 pb-2 flex flex-wrap gap-2">
          {attachedMedia.map(m => (
            <div key={m.id} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-accent/10 border border-accent/20 rounded-full">
              {m.thumbnailUrl && (
                <img src={m.thumbnailUrl} alt={m.originalName} className="w-5 h-5 rounded-full object-cover" />
              )}
              <span className="text-xs text-accent-dark font-medium truncate max-w-[100px]">{m.originalName}</span>
              <button
                onClick={() => onDetachMedia(m.id)}
                className="w-4 h-4 rounded-full bg-accent/20 text-accent-dark hover:bg-accent/30 flex items-center justify-center text-[10px] transition-colors"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input bar */}
      <div className="px-4 pb-4">
        <div className={`flex items-end gap-2 rounded-2xl border bg-white shadow-sm transition-all ${
          isDragActive ? 'border-accent shadow-accent/20' : 'border-surface-300 focus-within:border-accent focus-within:shadow-accent/10'
        }`}>
          {/* Upload button */}
          <button
            type="button"
            onClick={open}
            title="Upload file"
            className="flex-shrink-0 w-9 h-9 mb-2 ml-2 rounded-xl flex items-center justify-center text-surface-400 hover:text-accent hover:bg-accent/10 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder="Ask anything… or drop a file to upload (Ctrl+V to paste screenshot)"
            rows={1}
            className="flex-1 py-3 text-sm text-surface-800 placeholder-surface-400 bg-transparent resize-none focus:outline-none min-h-[44px] max-h-[160px]"
            disabled={isLoading}
          />

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={isLoading || (!input.trim() && attachedMedia.length === 0)}
            className="flex-shrink-0 w-9 h-9 mb-2 mr-2 rounded-xl bg-accent text-white flex items-center justify-center hover:bg-accent-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            )}
          </button>
        </div>
        <p className="text-center text-[11px] text-surface-400 mt-2">
          Enter to send · Shift+Enter for new line · Ctrl+V to paste screenshot
        </p>
      </div>
    </div>
  );
}