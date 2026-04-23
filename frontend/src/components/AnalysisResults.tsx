'use client';

import type { VideoAnalysis, AudioAnalysis } from '@/lib/types';

interface Props {
  type: 'video' | 'audio';
  data: VideoAnalysis | AudioAnalysis | string;
}

function fmt(secs: number) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function AnalysisResults({ type, data }: Props) {
  if (typeof data === 'string') {
    return <p className="text-sm text-surface-700 whitespace-pre-wrap">{data}</p>;
  }

  if (type === 'video') {
    const v = data as VideoAnalysis;
    return (
      <div className="space-y-4 text-sm">
        {v.summary && (
          <div className="p-3 bg-accent/5 border border-accent/20 rounded-lg">
            <p className="font-semibold text-accent-dark mb-1">Summary</p>
            <p className="text-surface-700">{v.summary}</p>
          </div>
        )}
        {v.scenes?.length > 0 && (
          <div>
            <p className="font-semibold text-surface-700 mb-2">Scene Breakdown</p>
            <div className="space-y-1.5">
              {v.scenes.map((s, i) => (
                <div key={i} className="flex gap-2.5 p-2 rounded-lg bg-surface-50 border border-surface-200">
                  <span className="font-mono text-xs text-accent bg-accent/10 px-1.5 py-0.5 rounded flex-shrink-0">
                    {s.timestamp}
                  </span>
                  <span className="text-surface-700">{s.description}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {v.keyMoments?.length > 0 && (
          <div>
            <p className="font-semibold text-surface-700 mb-2">Key Moments</p>
            <div className="space-y-1.5">
              {v.keyMoments.map((m, i) => (
                <div key={i} className="flex gap-2.5 p-2 rounded-lg bg-surface-50 border border-surface-200">
                  <span className="font-mono text-xs text-warning bg-warning/10 px-1.5 py-0.5 rounded flex-shrink-0">
                    {m.timestamp}
                  </span>
                  <span className="text-surface-700">{m.event}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {v.framesAnalyzed > 0 && (
          <p className="text-xs text-surface-400">{v.framesAnalyzed} frames analyzed</p>
        )}
      </div>
    );
  }

  if (type === 'audio') {
    const a = data as AudioAnalysis;
    return (
      <div className="space-y-4 text-sm">
        {a.analysis && (
          <div className="p-3 bg-accent/5 border border-accent/20 rounded-lg">
            <p className="font-semibold text-accent-dark mb-1">Analysis</p>
            <p className="text-surface-700 whitespace-pre-wrap">{a.analysis}</p>
          </div>
        )}
        {a.transcription?.segments?.length > 0 && (
          <div>
            <p className="font-semibold text-surface-700 mb-2">Transcript</p>
            <div className="max-h-48 overflow-y-auto space-y-1 text-xs bg-surface-50 rounded-lg p-2 border border-surface-200">
              {a.transcription.segments.map((seg, i) => (
                <div key={i} className="flex gap-2">
                  <span className="tabular-nums text-surface-400 flex-shrink-0">{fmt(seg.start)}</span>
                  <span className="text-surface-700">{seg.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}