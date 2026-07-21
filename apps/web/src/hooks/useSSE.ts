import { useEffect } from "react";
import { getAccessToken } from "@/lib/auth";

const API_BASE_URL =
  import.meta.env.VITE_PUBLIC_API_URL ||
  import.meta.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:3001";

export interface SSEMessage {
  applicationId: string;
  jobId: string;
  type: "progress" | "completed" | "failed";
  progress?: number;
  tier?: "A" | "B" | "C" | "unscored";
  score?: number;
  error?: string;
}

type Listener = (msg: SSEMessage) => void;
const listeners = new Set<Listener>();
let eventSource: EventSource | null = null;
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

function connectSSE() {
  if (typeof window === "undefined" || eventSource) return;

  const token = getAccessToken();
  if (!token) {
    // If no token is available, retry in 2 seconds
    reconnectTimeout = setTimeout(connectSSE, 2000);
    return;
  }

  const url = `${API_BASE_URL}/events?token=${encodeURIComponent(token)}`;
  eventSource = new EventSource(url);

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === "connected") return;
      listeners.forEach((l) => l(data));
    } catch (err) {
      console.error("[SSE] Failed to parse SSE data:", err);
    }
  };

  eventSource.onerror = () => {
    console.warn("[SSE] Connection lost. Reconnecting...");
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    if (reconnectTimeout) clearTimeout(reconnectTimeout);
    reconnectTimeout = setTimeout(connectSSE, 5000);
  };
}

export function useSSE(onMessage?: Listener) {
  useEffect(() => {
    if (!eventSource && !reconnectTimeout) {
      connectSSE();
    }

    if (onMessage) {
      listeners.add(onMessage);
    }

    return () => {
      if (onMessage) {
        listeners.delete(onMessage);
      }
    };
  }, [onMessage]);
}

// Helper to manually trigger connection (e.g. after login)
export function forceConnectSSE() {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  connectSSE();
}
export type { Listener };
