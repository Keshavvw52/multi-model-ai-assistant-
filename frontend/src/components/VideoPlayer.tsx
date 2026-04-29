'use client';

import { useRef, useState, useEffect } from 'react';
import type { MediaFile, VideoFrame } from '@/lib/types';
import { getVideoFrames } from '@/lib/api';

interface VideoPlayerProps {
  media: MediaFile;
}

function fmt(secs: number) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function VideoPlayer({ media }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [frames, setFrames] = useState<VideoFrame[]>([]);

  useEffect(() => {
    getVideoFrames(media.id).then(setFrames).catch(() => {});
  }, [media.id]);

  const toggle = () => {
    if (!videoRef.current) return;
    if (playing) videoRef.current.pause();
    else videoRef.current.play();
    setPlaying(!playing);
  };

  const seekTo = (t: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = t;
    }
  };

  const pct = duration > 0 ? (current / duration) * 100 : 0;

  return (
    <div className="rounded-xl overflow-hidden border border-surface-200 bg-black">
      {/* Video */}
      <div className="relative aspect-video bg-black">
        <video
          ref={videoRef}
          src={media.url}
          className="w-full h-full object-contain"
          onTimeUpdate={() => setCurrent(videoRef.current?.currentTime || 0)}
          onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
          onEnded={() => setPlaying(false)}
          onClick={toggle}
        />
        {!playing && (
          <button
            onClick={toggle}
            className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/20 transition-colors"
          >
            <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
              <svg className="w-7 h-7 text-surface-900 ml-1" fill="currentColor" viewBox="0 0 24 24">
                <polygon points="5,3 19,12 5,21"/>
              </svg>
            </div>
          </button>
        )}
      </div>

      {/* Seek bar */}
      <div className="bg-surface-900 px-3 py-2">
        <div
          className="h-1 bg-surface-600 rounded-full cursor-pointer mb-2"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            seekTo(((e.clientX - rect.left) / rect.width) * duration);
          }}
        >
          <div className="h-full bg-accent rounded-full" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex items-center justify-between text-xs text-surface-400">
          <span>{fmt(current)}</span>
          <button onClick={toggle} className="text-white hover:text-accent transition-colors px-2">
            {playing ? '⏸ Pause' : '▶ Play'}
          </button>
          <span>{fmt(duration)}</span>
        </div>
      </div>

      {/* Frame timeline */}
      {frames.length > 0 && (
        <div className="bg-surface-950 p-2">
          <p className="text-xs text-surface-500 mb-1.5 px-1">Key Frames</p>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {frames.map((frame) => (
              <button
                key={frame.index}
                onClick={() => seekTo(frame.timestamp)}
                title={`Jump to ${fmt(frame.timestamp)}`}
                className={`flex-shrink-0 relative group rounded overflow-hidden ${
                  Math.abs(current - frame.timestamp) < 3 ? 'ring-2 ring-accent' : ''
                }`}
              >
                <img
                  src={frame.url}
                  alt={`Frame at ${fmt(frame.timestamp)}`}
                  className="w-16 h-10 object-cover"
                  loading="lazy"
                />
                <span className="absolute bottom-0 left-0 right-0 text-center text-white text-[10px] bg-black/60 py-0.5">
                  {fmt(frame.timestamp)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}