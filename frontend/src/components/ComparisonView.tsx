'use client';

import { useState } from 'react';
import type { MediaFile } from '@/lib/types';
import { compareMedia } from '@/lib/api';

interface ComparisonViewProps {
  files: MediaFile[];
  onClose: () => void;
  onResult: (result: string) => void;
}

export function ComparisonView({ files, onClose, onResult }: ComparisonViewProps) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');

  const runComparison = async () => {
    if (files.length < 2) return;
    setLoading(true);
    try {
      const res = await compareMedia(files.map(f => f.id), query || 'Compare these files in detail.');
      const analysis = typeof res.analysis === 'string' ? res.analysis : JSON.stringify(res.analysis);
      setResult(analysis);
      onResult(analysis);
    } catch (e: unknown) {
      setResult('Comparison failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-200">
          <h2 className="font-semibold text-surface-900">Compare Media</h2>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700 transition-colors">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* File grid */}
          <div className="grid grid-cols-2 gap-3">
            {files.map((f, i) => (
              <div key={f.id} className="rounded-xl overflow-hidden border border-surface-200">
                {f.mediaType === 'image' ? (
                  <img src={f.url} alt={f.originalName} className="w-full h-36 object-cover" />
                ) : f.thumbnailUrl ? (
                  <img src={f.thumbnailUrl} alt={f.originalName} className="w-full h-36 object-cover" />
                ) : (
                  <div className="w-full h-36 bg-surface-100 flex items-center justify-center text-4xl">
                    {f.mediaType === 'video' ? '🎬' : f.mediaType === 'audio' ? '🎵' : '📄'}
                  </div>
                )}
                <div className="p-2 bg-surface-50 border-t border-surface-200">
                  <p className="text-xs font-medium text-surface-700 truncate">File {i + 1}: {f.originalName}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Query */}
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">
              Comparison Question (optional)
            </label>
            <textarea
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="e.g., Compare the visual styles of these two images..."
              rows={2}
              className="w-full rounded-lg border border-surface-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent resize-none"
            />
          </div>

          {/* Result */}
          {result && (
            <div className="p-4 bg-surface-50 border border-surface-200 rounded-xl">
              <p className="text-xs font-semibold text-surface-500 uppercase tracking-wide mb-2">Analysis</p>
              <p className="text-sm text-surface-700 whitespace-pre-wrap">{result}</p>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-surface-200 flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-surface-600 hover:text-surface-800 transition-colors">
            Close
          </button>
          <button
            onClick={runComparison}
            disabled={loading || files.length < 2}
            className="px-5 py-2 bg-accent text-white text-sm rounded-lg hover:bg-accent-dark transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {loading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {loading ? 'Comparing…' : 'Compare'}
          </button>
        </div>
      </div>
    </div>
  );
}