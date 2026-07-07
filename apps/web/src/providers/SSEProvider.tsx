'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createSSEConnection, type SSEEvent, type StatusMap } from '@/lib/sse';
import { API_BASE_URL } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

const SSEContext = createContext<StatusMap>({});

export function useSSEStatus() {
  return useContext(SSEContext);
}

export function SSEProvider({ children }: { children: React.ReactNode }) {
  const [statusMap, setStatusMap] = useState<StatusMap>({});
  const queryClient = useQueryClient();
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;

    const cleanup = createSSEConnection(
      `${API_BASE_URL}/events`,
      token,
      (event: SSEEvent) => {
        setStatusMap((prev) => {
          const next = { ...prev };
          if (event.type === 'progress') {
            next[event.applicationId] = { status: 'scoring', progress: event.progress };
          } else if (event.type === 'completed') {
            next[event.applicationId] = {
              status: 'completed',
              tier: event.tier,
              score: event.score,
              progress: 100,
            };
          } else if (event.type === 'failed') {
            next[event.applicationId] = { status: 'failed', error: event.error };
          }
          return next;
        });

        // Push-based refresh: invalidate everything that could show this
        // application's state. Partial keys match all cached variants
        // (e.g. every tier filter of job-applications) without needing to
        // know which ones are currently mounted.
        queryClient.invalidateQueries({ queryKey: ['job-stats', event.jobId] });
        queryClient.invalidateQueries({ queryKey: ['job-applications-all', event.jobId] });
        queryClient.invalidateQueries({ queryKey: ['job-applications', event.jobId] });
        queryClient.invalidateQueries({ queryKey: ['job-applications-counts', event.jobId] });
        queryClient.invalidateQueries({ queryKey: ['application', event.applicationId] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
        queryClient.invalidateQueries({ queryKey: ['queue-status'] });
      },
      (err) => {
        console.warn('SSE connection error:', err);
      }
    );

    cleanupRef.current = cleanup;
    return () => cleanup();
  }, [queryClient]);

  return <SSEContext.Provider value={statusMap}>{children}</SSEContext.Provider>;
}
