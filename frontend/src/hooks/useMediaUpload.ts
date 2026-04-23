'use client';

import { useState, useCallback } from 'react';
import { uploadFile } from '@/lib/api';
import type { MediaFile, UploadState } from '@/lib/types';

export function useMediaUpload() {
  const [uploads, setUploads] = useState<Map<string, UploadState>>(new Map());

  const upload = useCallback(async (file: File): Promise<MediaFile | null> => {
    const key = `${file.name}-${Date.now()}`;

    setUploads(prev => new Map(prev).set(key, {
      file,
      progress: 0,
      status: 'uploading',
    }));

    try {
      const result = await uploadFile(file, (pct) => {
        setUploads(prev => {
          const next = new Map(prev);
          const cur = next.get(key);
          if (cur) next.set(key, { ...cur, progress: pct });
          return next;
        });
      });

      setUploads(prev => {
        const next = new Map(prev);
        next.set(key, { file, progress: 100, status: 'done', result });
        return next;
      });

      // Auto-clean upload state after 5 seconds
      setTimeout(() => {
        setUploads(prev => {
          const next = new Map(prev);
          next.delete(key);
          return next;
        });
      }, 5000);

      return result;
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : 'Upload failed';
      setUploads(prev => {
        const next = new Map(prev);
        next.set(key, { file, progress: 0, status: 'error', error });
        return next;
      });
      return null;
    }
  }, []);

  const clearUpload = useCallback((key: string) => {
    setUploads(prev => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const activeUploads = Array.from(uploads.values()).filter(
    u => u.status === 'uploading' || u.status === 'processing'
  );

  return { upload, uploads, activeUploads, clearUpload };
}