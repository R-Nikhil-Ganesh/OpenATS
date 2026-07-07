// SSE client for real-time processing events
export type SSEEvent = {
  type: 'progress' | 'completed' | 'failed';
  jobId: string;
  applicationId: string;
  progress?: number;
  tier?: string;
  score?: number;
  error?: string;
};

export function createSSEConnection(
  url: string,
  token: string,
  onEvent: (event: SSEEvent) => void,
  onError?: (err: Event) => void
): () => void {
  const es = new EventSource(`${url}?token=${token}`);

  es.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      onEvent(data);
    } catch {}
  };

  es.onerror = (err) => {
    onError?.(err);
  };

  // Return cleanup function
  return () => es.close();
}
