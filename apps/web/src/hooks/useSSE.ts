'use client';

import { useSSEStatus } from '@/providers/SSEProvider';

export function useSSE() {
  const statusMap = useSSEStatus();
  return { statusMap };
}
