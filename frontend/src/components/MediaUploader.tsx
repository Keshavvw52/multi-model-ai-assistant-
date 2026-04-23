'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import type { MediaFile } from '@/lib/types';
import { useMediaUpload } from '@/hooks/useMediaUpload';

interface MediaUploaderProps {
  onUploaded: (media: MediaFile) => void;
  children?: React.ReactNode;
}

const ACCEPT = {
  'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'],
  'video/*': ['.mp4', '.webm', '.mov', '.avi'],
  'audio/*': ['.mp3', '.wav', '.m4a', '.ogg', '.flac'],
  'application/pdf': ['.pdf'],
};

export function MediaUploader({ onUploaded, children }: MediaUploaderProps) {
  const { upload, activeUploads } = useMediaUpload();
  const [dragOver, setDragOver] = useState(false);

  const onDrop = useCallback(async (accepted: File[]) => {
    setDragOver(false);
    for (const file of accepted) {
      const result = await upload(file);
      if (result) onUploaded(result);
    }
  }, [upload, onUploaded]);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: ACCEPT,
    noClick: true,
    noKeyboard: true,
    onDragEnter: () => setDragOver(true),
    onDragLeave: () => setDragOver(false),
  });

  return (
    <div {...getRootProps()} className="relative">
      <input {...getInputProps()} />

      {/* Drag overlay */}
      {isDragActive && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-accent/10 border-2 border-dashed border-accent rounded-2xl backdrop-blur-sm animate-fade-in pointer-events-none">
          <div className="text-4xl mb-3">📂</div>
          <p className="font-semibold text-accent text-lg">Drop files here</p>
          <p className="text-sm text-accent/70">Images, videos, audio, documents</p>
        </div>
      )}

      {/* Upload progress toasts */}
      {activeUploads.length > 0 && (
        <div className="absolute bottom-20 right-4 z-40 space-y-2">
          {activeUploads.map((u, i) => (
            <div key={i} className="bg-white rounded-xl shadow-lg border border-surface-200 p-3 w-64 animate-slide-up">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-medium text-surface-700 truncate">{u.file.name}</p>
                <span className="text-xs text-surface-500">{u.progress}%</span>
              </div>
              <div className="h-1.5 bg-surface-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-all duration-300"
                  style={{ width: `${u.progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* The actual content (input area) */}
      <div className="relative">{children}</div>
    </div>
  );
}