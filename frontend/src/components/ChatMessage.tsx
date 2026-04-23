'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { Message } from '@/lib/types';
import { MediaPreview } from './MediaPreview';
import { StreamingText } from './StreamingText';
import type { MediaFile } from '@/lib/types';

interface ChatMessageProps {
  message: Message;
  mediaFiles: Map<string, MediaFile>;
}

export function ChatMessage({ message, mediaFiles }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isStreaming = message.isStreaming;

  return (
    <div className={`flex gap-3 animate-slide-up ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold mt-0.5 ${
        isUser
          ? 'bg-accent text-white'
          : 'bg-gradient-to-br from-surface-700 to-surface-900 text-white'
      }`}>
        {isUser ? 'U' : '✦'}
      </div>

      <div className={`flex flex-col gap-2 max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}>
        {/* Media attachments */}
        {message.mediaRefs && message.mediaRefs.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {message.mediaRefs.map(ref => {
              const file = mediaFiles.get(ref.id);
              return file ? (
                <MediaPreview key={ref.id} media={file} />
              ) : (
                <div key={ref.id} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-surface-100 border border-surface-200 text-xs text-surface-600">
                  📎 {ref.name}
                </div>
              );
            })}
          </div>
        )}

        {/* Message bubble */}
        {(message.content || isStreaming) && (
          <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            isUser
              ? 'bg-accent text-white rounded-tr-sm'
              : 'bg-white border border-surface-200 text-surface-800 rounded-tl-sm shadow-sm'
          }`}>
            {isUser ? (
              <p className="whitespace-pre-wrap break-words">{message.content}</p>
            ) : isStreaming ? (
              <StreamingText text={message.content} isStreaming={true} />
            ) : (
              <div className="prose prose-sm max-w-none prose-surface">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code({ node, className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || '');
                      const inline = !match;
                      return inline ? (
                        <code
                          className="bg-surface-100 text-accent-dark px-1 py-0.5 rounded text-xs font-mono"
                          {...props}
                        >
                          {children}
                        </code>
                      ) : (
                        <SyntaxHighlighter
                          style={oneDark}
                          language={match[1]}
                          PreTag="div"
                          className="rounded-lg text-xs !mt-2 !mb-2"
                        >
                          {String(children).replace(/\n$/, '')}
                        </SyntaxHighlighter>
                      );
                    },
                    table({ children }) {
                      return (
                        <div className="overflow-x-auto rounded-lg border border-surface-200 my-2">
                          <table className="min-w-full divide-y divide-surface-200 text-xs">
                            {children}
                          </table>
                        </div>
                      );
                    },
                    th({ children }) {
                      return (
                        <th className="px-3 py-2 bg-surface-50 font-semibold text-surface-700 text-left">
                          {children}
                        </th>
                      );
                    },
                    td({ children }) {
                      return (
                        <td className="px-3 py-2 border-t border-surface-100 text-surface-600">
                          {children}
                        </td>
                      );
                    },
                    blockquote({ children }) {
                      return (
                        <blockquote className="border-l-2 border-accent pl-3 text-surface-600 italic my-2">
                          {children}
                        </blockquote>
                      );
                    },
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              </div>
            )}

            {/* Streaming dots */}
            {isStreaming && !message.content && (
              <div className="flex gap-1 items-center h-5">
                {[0, 1, 2].map(i => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 bg-surface-400 rounded-full animate-pulse-soft"
                    style={{ animationDelay: `${i * 0.2}s` }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Timestamp */}
        {message.createdAt && !isStreaming && (
          <span className="text-[10px] text-surface-400 px-1">
            {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
    </div>
  );
}