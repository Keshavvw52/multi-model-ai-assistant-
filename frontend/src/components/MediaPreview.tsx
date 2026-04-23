'use client';

import { useState } from 'react';
import type { MediaFile } from '@/lib/types';
import { VideoPlayer } from './VideoPlayer';
import { AudioPlayer } from './AudioPlayer';

interface MediaPreviewProps {
  media: MediaFile;
  compact?: boolean;
}

const ICONS: Record<string, string> = {
  image: '🖼',
  video: '🎬',
  audio: '🎵',
  document: '📄',
};

export function MediaPreview({ media, compact = false }: MediaPreviewProps) {
  const [expanded, setExpanded] = useState(false);

  if (compact) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-surface-100 border border-surface-200 text-xs">
        <span>{ICONS[media.mediaType]}</span>
        <span className="text-surface-700 truncate max-w-[120px]">{media.originalName}</span>
        <span className="text-surface-400">({(media.size / 1024).toFixed(0)}KB)</span>
      </div>
    );
  }

  if (media.mediaType === 'image') {
    return (
      <div className="rounded-xl overflow-hidden border border-surface-200 max-w-sm">
        <img
          src={media.url}
          alt={media.originalName}
          className="w-full object-cover max-h-64 cursor-pointer hover:opacity-95 transition-opacity"
          onClick={() => window.open(media.url, '_blank')}
          loading="lazy"
        />
        <div className="px-3 py-1.5 bg-surface-50 border-t border-surface-200">
          <p className="text-xs text-surface-500 truncate">{media.originalName}</p>
          {media.metadata?.width && (
            <p className="text-xs text-surface-400">
              {media.metadata.width}×{media.metadata.height}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (media.mediaType === 'video') {
    return (
      <div className="max-w-md">
        {expanded ? (
          <VideoPlayer media={media} />
        ) : (
          <button
            onClick={() => setExpanded(true)}
            className="relative rounded-xl overflow-hidden border border-surface-200 w-full aspect-video bg-surface-900 flex items-center justify-center hover:opacity-90 transition-opacity"
          >
            {media.thumbnailUrl ? (
              <img src={media.thumbnailUrl} alt={media.originalName} className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <span className="text-4xl">🎬</span>
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                <svg className="w-6 h-6 text-surface-900 ml-1" fill="currentColor" viewBox="0 0 24 24">
                  <polygon points="5,3 19,12 5,21"/>
                </svg>
              </div>
            </div>
            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-white text-xs">
              <span className="bg-black/60 px-2 py-0.5 rounded-full truncate">{media.originalName}</span>
              {media.metadata?.duration && (
                <span className="bg-black/60 px-2 py-0.5 rounded-full flex-shrink-0">
                  {Math.floor(media.metadata.duration / 60)}:{String(Math.floor(media.metadata.duration % 60)).padStart(2, '0')}
                </span>
              )}
            </div>
          </button>
        )}
      </div>
    );
  }

  if (media.mediaType === 'audio') {
    return (
      <div className="max-w-md">
        <AudioPlayer media={media} />
      </div>
    );
  }

  // Document
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-surface-200 bg-surface-50 max-w-xs">
      <div className="w-10 h-10 rounded-lg bg-surface-200 flex items-center justify-center text-xl flex-shrink-0">
        📄
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-surface-800 truncate">{media.originalName}</p>
        <p className="text-xs text-surface-500">{(media.size / 1024).toFixed(0)} KB</p>
      </div>
      <a
        href={media.url}
        target="_blank"
        rel="noopener noreferrer"
        className="ml-auto text-accent text-xs hover:underline flex-shrink-0"
      >
        Open
      </a>
    </div>
  );
}