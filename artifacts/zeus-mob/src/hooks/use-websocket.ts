import { useEffect, useRef, useState, useCallback } from "react";

export type WsStatus = "connecting" | "connected" | "disconnected";

export interface StreamStats {
  fps: number;
  latencyMs: number;
  batteryPct: number;
}

export interface UseDeviceWebSocket {
  status: WsStatus;
  frameUrl: string | null;
  stats: StreamStats;
  startStream: () => void;
  stopStream: () => void;
  streaming: boolean;
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function buildWsUrl(role: string, deviceId?: string): string {
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  const host = window.location.host;
  const path = `${BASE}/api/ws`;
  const params = new URLSearchParams({ role });
  if (deviceId) params.set("deviceId", deviceId);
  return `${proto}://${host}${path}?${params}`;
}

export function useDeviceWebSocket(deviceId: string): UseDeviceWebSocket {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frameUrlRef = useRef<string | null>(null);

  const [status, setStatus] = useState<WsStatus>("disconnected");
  const [streaming, setStreaming] = useState(false);
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const [stats, setStats] = useState<StreamStats>({ fps: 0, latencyMs: 0, batteryPct: 0 });

  const fpsCounterRef = useRef({ count: 0, last: Date.now() });

  const connect = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState < 2) return;

    setStatus("connecting");
    let url: string;
    try {
      url = buildWsUrl("watch", deviceId);
    } catch {
      setStatus("disconnected");
      return;
    }

    const ws = new WebSocket(url);
    wsRef.current = ws;
    ws.binaryType = "arraybuffer";

    ws.onopen = () => setStatus("connected");

    ws.onmessage = (ev) => {
      if (typeof ev.data === "string") {
        try {
          const msg = JSON.parse(ev.data) as Record<string, unknown>;
          if (msg.type === "stats") {
            setStats({
              fps: Number(msg.fps ?? 0),
              latencyMs: Number(msg.latencyMs ?? 0),
              batteryPct: Number(msg.batteryPct ?? 0),
            });
          }
        } catch {/* ignore */}
        return;
      }

      // Binary = JPEG frame
      const now = Date.now();
      const ctr = fpsCounterRef.current;
      ctr.count++;
      const elapsed = now - ctr.last;
      if (elapsed >= 1000) {
        setStats(s => ({ ...s, fps: Math.round(ctr.count * 1000 / elapsed) }));
        ctr.count = 0;
        ctr.last = now;
      }

      const blob = new Blob([ev.data], { type: "image/jpeg" });
      const url = URL.createObjectURL(blob);
      if (frameUrlRef.current) URL.revokeObjectURL(frameUrlRef.current);
      frameUrlRef.current = url;
      setFrameUrl(url);
    };

    ws.onerror = () => setStatus("disconnected");

    ws.onclose = () => {
      setStatus("disconnected");
      reconnectRef.current = setTimeout(connect, 3000);
    };
  }, [deviceId]);

  useEffect(() => {
    connect();
    return () => {
      reconnectRef.current && clearTimeout(reconnectRef.current);
      wsRef.current?.close();
      if (frameUrlRef.current) URL.revokeObjectURL(frameUrlRef.current);
    };
  }, [connect]);

  const startStream = useCallback(() => {
    setStreaming(true);
    wsRef.current?.send(JSON.stringify({ type: "start_stream", deviceId }));
  }, [deviceId]);

  const stopStream = useCallback(() => {
    setStreaming(false);
    setFrameUrl(null);
    setStats({ fps: 0, latencyMs: 0, batteryPct: 0 });
    wsRef.current?.send(JSON.stringify({ type: "stop_stream", deviceId }));
  }, [deviceId]);

  return { status, frameUrl, stats, startStream, stopStream, streaming };
}

/* ── Global Dashboard WS (status only) ── */
export type DashWsStatus = "active" | "inactive";

export function useDashboardWs(): DashWsStatus {
  const [active, setActive] = useState<DashWsStatus>("inactive");
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function connect() {
      let url: string;
      try {
        url = buildWsUrl("status");
      } catch {
        return;
      }
      const ws = new WebSocket(url);
      wsRef.current = ws;
      ws.onopen = () => setActive("active");
      ws.onerror = () => setActive("inactive");
      ws.onclose = () => {
        setActive("inactive");
        retryRef.current = setTimeout(connect, 4000);
      };
    }
    connect();
    return () => {
      retryRef.current && clearTimeout(retryRef.current);
      wsRef.current?.close();
    };
  }, []);

  return active;
}
