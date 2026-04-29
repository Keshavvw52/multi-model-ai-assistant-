'use client';

import { useRef, useState } from 'react';
import type { MediaFile } from '@/lib/types';

interface Segment {
  start: number;
  end: number;
  text: string;
}

interface AudioPlayerProps {
  media: MediaFile;
  segments?: Segment[];
  transcript?: string;
}

function fmt(secs: number) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function AudioPlayer({ media, segments, transcript }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [activeSegment, setActiveSegment] = useState<number>(-1);

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); }
    else { audioRef.current.play(); }
    setPlaying(!playing);
  };

  const seekTo = (t: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = t;
      audioRef.current.play();
      setPlaying(true);
    }
  };

  const onTimeUpdate = () => {
    if (!audioRef.current) return;
    const t = audioRef.current.currentTime;
    setCurrent(t);
    if (segments) {
      const idx = segments.findIndex(s => t >= s.start && t <= s.end);
      setActiveSegment(idx);
    }
  };

  const pct = duration > 0 ? (current / duration) * 100 : 0;

  return (
    <div className="rounded-xl overflow-hidden border border-surface-200 bg-surface-50">
      <audio
        ref={audioRef}
        src={media.url}
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onEnded={() => setPlaying(false)}
        className="hidden"
      />

      {/* Controls */}
      <div className="flex items-center gap-3 p-3 bg-white">
        <button
          onClick={toggle}
          className="w-10 h-10 rounded-full bg-accent flex items-center justify-center text-white flex-shrink-0 hover:bg-accent-dark transition-colors"
        >
          {playing ? (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
            </svg>
          ) : (
            <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <polygon points="5,3 19,12 5,21"/>
            </svg>
          )}
        </button>

        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-surface-800 truncate mb-1">{media.originalName}</p>
          <div
            className="h-1.5 bg-surface-200 rounded-full cursor-pointer"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const ratio = (e.clientX - rect.left) / rect.width;
              seekTo(ratio * duration);
            }}
          >
            <div
              className="h-full bg-accent rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <span className="text-xs text-surface-500 tabular-nums flex-shrink-0">
          {fmt(current)} / {fmt(duration)}
        </span>
      </div>

      {/* Transcript */}
      {(segments?.length || transcript) && (
        <div className="max-h-48 overflow-y-auto p-3 border-t border-surface-200 space-y-1">
          <p className="text-xs font-semibold text-surface-500 uppercase tracking-wide mb-2">Transcript</p>
          {segments?.length ? (
            segments.map((seg, i) => (
              <button
                key={i}
                onClick={() => seekTo(seg.start)}
                className={`w-full text-left flex gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${
                  activeSegment === i
                    ? 'bg-accent/10 text-accent-dark'
                    : 'text-surface-700 hover:bg-surface-100'
                }`}
              >
                <span className="tabular-nums text-surface-400 flex-shrink-0">{fmt(seg.start)}</span>
                <span>{seg.text}</span>
              </button>
            ))
          ) : (
            <p className="text-xs text-surface-600 leading-relaxed">{transcript}</p>
          )}
        </div>
      )}
    </div>
  );
}