'use client';

import { useEffect, useRef, useState } from 'react';
import { createSSEConnection, SSEEvent } from '@/lib/sse';
import { getAccessToken } from '@/lib/auth';

type AppStatus = {
  status: 'queued' | 'extracting' | 'extracted' | 'scoring' | 'completed' | 'failed';
  progress?: number;
  tier?: string;
  score?: number;
  error?: string;
};

type StatusMap = Record<string, AppStatus>;

const SSE_URL = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1'}/events`;

export function useSSE() {
  const [statusMap, setStatusMap] = useState<StatusMap>({});
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;

    const cleanup = createSSEConnection(
      SSE_URL,
      token,
      (event: SSEEvent) => {
        setStatusMap((prev) => {
          const next = { ...prev };
          if (event.type === 'progress') {
            next[event.applicationId] = {
              status: 'scoring',
              progress: event.progress,
            };
          } else if (event.type === 'completed') {
            next[event.applicationId] = {
              status: 'completed',
              tier: event.tier,
              score: event.score,
              progress: 100,
            };
          } else if (event.type === 'failed') {
            next[event.applicationId] = {
              status: 'failed',
              error: event.error,
            };
          }
          return next;
        });
      },
      (err) => {
        console.warn('SSE connection error:', err);
      }
    );

    cleanupRef.current = cleanup;

    return () => {
      cleanup();
    };
  }, []);

  return { statusMap };
}
