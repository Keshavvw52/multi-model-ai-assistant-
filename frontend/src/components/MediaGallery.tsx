'use client';

import { useState } from 'react';
import type { MediaFile } from '@/lib/types';
import { deleteMedia } from '@/lib/api';
import { ComparisonView } from './ComparisonView';

interface MediaGalleryProps {
  files: MediaFile[];
  onSelect: (media: MediaFile) => void;
  onDeleted: (id: string) => void;
  onComparisonResult: (result: string) => void;
}

const TYPE_ICON: Record<string, string> = {
  image: '🖼',
  video: '🎬',
  audio: '🎵',
  document: '📄',
};

const TYPE_COLOR: Record<string, string> = {
  image:    'bg-blue-50 text-blue-600 border-blue-200',
  video:    'bg-purple-50 text-purple-600 border-purple-200',
  audio:    'bg-green-50 text-green-600 border-green-200',
  document: 'bg-amber-50 text-amber-600 border-amber-200',
};

export function MediaGallery({ files, onSelect, onDeleted, onComparisonResult }: MediaGalleryProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showCompare, setShowCompare] = useState(false);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteMedia(id);
    onDeleted(id);
    setSelected(prev => { const n = new Set(prev); n.delete(id); return n; });
  };

  const selectedFiles = files.filter(f => selected.has(f.id));

  if (files.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-surface-100 flex items-center justify-center text-2xl mb-3">📁</div>
        <p className="text-sm font-medium text-surface-500">No media yet</p>
        <p className="text-xs text-surface-400 mt-1">Upload files to get started</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {selected.size >= 2 && (
          <button
            onClick={() => setShowCompare(true)}
            className="w-full px-3 py-2 bg-accent text-white text-xs rounded-lg font-medium hover:bg-accent-dark transition-colors flex items-center justify-center gap-1.5 mb-3"
          >
            ⚖️ Compare {selected.size} files
          </button>
        )}

        {files.map(f => (
          <div
            key={f.id}
            className={`group relative rounded-xl border transition-all cursor-pointer ${
              selected.has(f.id)
                ? 'border-accent bg-accent/5 shadow-sm'
                : 'border-surface-200 bg-white hover:border-surface-300 hover:shadow-sm'
            }`}
            onClick={() => onSelect(f)}
          >
            <div className="flex items-center gap-2.5 p-2.5">
              {/* Thumbnail / icon */}
              <div className="w-10 h-10 rounded-lg overflow-hidden bg-surface-100 flex-shrink-0">
                {f.thumbnailUrl ? (
                  <img src={f.thumbnailUrl} alt={f.originalName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-lg">
                    {TYPE_ICON[f.mediaType]}
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-surface-800 truncate">{f.originalName}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${TYPE_COLOR[f.mediaType]}`}>
                    {f.mediaType}
                  </span>
                  <span className="text-[10px] text-surface-400">
                    {(f.size / 1024).toFixed(0)}KB
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => { e.stopPropagation(); toggle(f.id); }}
                  title="Select for comparison"
                  className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs transition-colors ${
                    selected.has(f.id)
                      ? 'bg-accent border-accent text-white'
                      : 'border-surface-300 text-surface-500 hover:border-accent hover:text-accent'
                  }`}
                >
                  ✓
                </button>
                <button
                  onClick={(e) => handleDelete(f.id, e)}
                  title="Delete"
                  className="w-6 h-6 rounded-full border border-surface-300 text-surface-500 hover:border-danger hover:text-danger flex items-center justify-center text-xs transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showCompare && selectedFiles.length >= 2 && (
        <ComparisonView
          files={selectedFiles}
          onClose={() => setShowCompare(false)}
          onResult={(r) => { onComparisonResult(r); setShowCompare(false); }}
        />
      )}
    </>
  );
}