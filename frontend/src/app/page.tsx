'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type { MediaFile } from '@/lib/types';
import { useChat } from '@/hooks/useChat';
import { ChatWindow } from '@/components/ChatWindow';
import { MediaGallery } from '@/components/MediaGallery';
import { exportConversation } from '@/lib/api';
import Plasma from '@/components/Plasma';



export default function Home() {
  const [comparisonResult, setComparisonResult] = useState<string | null>(null);
  const {
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
    cancelStream,
  } = useChat();
  const [allMedia, setAllMedia] = useState<MediaFile[]>([]);
  const mediaMap = useRef<Map<string, MediaFile>>(new Map());
  const [sidebarTab, setSidebarTab] = useState<'media' | 'history'>('media');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    refreshConversations();
  }, [refreshConversations]);

  const handleMediaUploaded = useCallback((media: MediaFile) => {
    setAllMedia((prev) => [media, ...prev]);
    mediaMap.current.set(media.id, media);
    attachMedia(media);
  }, [attachMedia]);

  const handleMediaDeleted = useCallback((id: string) => {
    setAllMedia((prev) => prev.filter((m) => m.id !== id));
    mediaMap.current.delete(id);
  }, []);

  const handleGallerySelect = useCallback((media: MediaFile) => {
    attachMedia(media);
  }, [attachMedia]);

const handleComparisonResult = useCallback((result: string) => {
  setComparisonResult(result); // store separately
}, []);

  const handleExport = useCallback(async () => {
    if (!conversationId) return;
    try {
      const blob = await exportConversation(conversationId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `conversation-${conversationId.slice(0, 8)}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export failed:', e);
    }
  }, [conversationId]);

  return (
    <div className="relative h-screen overflow-hidden bg-surface-950">
      <div className="absolute inset-0">
        <Plasma
          color={undefined}
          speed={0.6}
          direction="forward"
          scale={1.1}
          opacity={1}
          mouseInteractive={true}
        />
      </div>

      <div className="relative z-10 flex h-screen overflow-hidden">
        <aside className={`flex flex-col border-r border-white/10 bg-black/28 shadow-xl shadow-black/30 transition-all duration-300 flex-shrink-0 ${
          sidebarOpen ? 'w-72' : 'w-0 overflow-hidden'
        }`}>
          <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent to-accent-dark flex items-center justify-center text-white text-sm font-bold">
                ✦
              </div>
              <span className="font-semibold text-white text-sm">MultiModal AI</span>
            </div>
            <button
              onClick={newConversation}
              title="New conversation"
              className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors text-sm"
            >
              ✏
            </button>
          </div>

          <div className="flex border-b border-white/10 px-3 pt-2">
            {(['media', 'history'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setSidebarTab(tab)}
                className={`flex-1 pb-2 text-xs font-medium capitalize transition-colors border-b-2 -mb-px ${
                  sidebarTab === tab
                    ? 'border-accent text-white'
                    : 'border-transparent text-white/60 hover:text-white'
                }`}
              >
                {tab === 'media' ? '📁 Media' : '💬 History'}
              </button>
            ))}
          </div>

          {sidebarTab === 'media' && (
            <>
              <div className="px-3 pt-3 pb-1">
                <p className="text-[11px] font-semibold text-white/45 uppercase tracking-wider px-1">
                  Session Media ({allMedia.length})
                </p>
              </div>
              <MediaGallery
                files={allMedia}
                onSelect={handleGallerySelect}
                onDeleted={handleMediaDeleted}
                onComparisonResult={handleComparisonResult}
              />
            </>
          )}

          {sidebarTab === 'history' && (
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {conversations.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-white/55">No conversations yet</p>
                </div>
              ) : (
                conversations.map((conv) => (
                  <div
                    key={conv.id}
                    className={`group flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
                      conv.id === conversationId
                        ? 'bg-white/12 text-white'
                        : 'hover:bg-white/8 text-white/80'
                    }`}
                    onClick={() => loadConversation(conv.id)}
                  >
                    <span className="text-sm flex-1 truncate">{conv.title}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeConversation(conv.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded flex items-center justify-center text-white/50 hover:text-red-300 transition-all text-[11px]"
                    >
                      ✕
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </aside>

        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <header className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-black/18 flex-shrink-0">
            <button
              onClick={() => setSidebarOpen((s) => !s)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white/75 hover:bg-white/10 transition-colors"
              title="Toggle sidebar"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <div className="flex-1 min-w-0">
              {conversationId ? (
                <p className="text-sm font-medium text-white truncate">
                  {conversations.find((c) => c.id === conversationId)?.title || 'Conversation'}
                </p>
              ) : (
                <p className="text-sm text-white/65">New Conversation</p>
              )}
            </div>

            <div className="flex items-center gap-2">
              {isStreaming && (
                <button
                  onClick={cancelStream}
                  className="px-3 py-1.5 text-xs text-red-200 border border-red-300/30 rounded-lg hover:bg-red-400/10 transition-colors"
                >
                  ⏹ Stop
                </button>
              )}

              {conversationId && (
                <button
                  onClick={handleExport}
                  title="Export as Markdown"
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white/75 hover:bg-white/10 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </button>
              )}

              {conversationId && (
                <button
                  onClick={newConversation}
                  title="New conversation"
                  className="px-3 py-1.5 text-xs bg-white text-surface-900 rounded-lg hover:bg-white/90 transition-colors font-medium"
                >
                  + New
                </button>
              )}
            </div>
          </header>

        <main className="flex-1 overflow-hidden relative bg-transparent flex flex-col">
  
  {/* Chat */}
  <div className="flex-1 overflow-hidden">
    <ChatWindow
      messages={messages}
      mediaFiles={mediaMap.current}
      attachedMedia={attachedMedia}
      isLoading={isLoading}
      onSend={sendMessage}
      onMediaUploaded={handleMediaUploaded}
      onDetachMedia={detachMedia}
    />
  </div>

  {/* Comparison Result UI */}
  {comparisonResult && (
    <div className="border-t border-white/10 bg-black/40 p-4 max-h-[200px] overflow-auto">
      <h2 className="text-sm font-semibold text-white mb-2">
        🔍 Comparison Result
      </h2>
      <pre className="text-xs text-white/80 whitespace-pre-wrap">
        {comparisonResult}
      </pre>
    </div>
  )}

</main>
        </div>
      </div>
    </div>
  );
}
