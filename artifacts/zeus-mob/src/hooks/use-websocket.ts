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
  stopStream:  () => void;
  streaming:   boolean;
  sendCommand: (cmd: string, params?: Record<string, unknown>) => void;
}

export interface LiveDevice {
  deviceId: string;
  ip: string;
  app: string;
  online: boolean;
  lastSeen: number;
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function buildWsUrl(role: string, deviceId?: string): string {
  const proto  = window.location.protocol === "https:" ? "wss" : "ws";
  const host   = window.location.host;
  const path   = `${BASE}/api/ws`;
  const params = new URLSearchParams({ role });
  if (deviceId) params.set("deviceId", deviceId);
  return `${proto}://${host}${path}?${params}`;
}

export function useDeviceWebSocket(deviceId: string): UseDeviceWebSocket {
  const wsRef        = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frameUrlRef  = useRef<string | null>(null);
  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPingRef  = useRef<number>(Date.now());

  const [status,    setStatus]    = useState<WsStatus>("disconnected");
  const [streaming, setStreaming] = useState(false);
  const [frameUrl,  setFrameUrl]  = useState<string | null>(null);
  const [stats,     setStats]     = useState<StreamStats>({ fps: 0, latencyMs: 0, batteryPct: 0 });

  const fpsCounterRef = useRef({ count: 0, last: Date.now() });

  const connect = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState < 2) return;

    setStatus("connecting");
    let url: string;
    try { url = buildWsUrl("watch", deviceId); }
    catch { setStatus("disconnected"); return; }

    const ws = new WebSocket(url);
    wsRef.current  = ws;
    ws.binaryType  = "arraybuffer";

    ws.onopen = () => {
      setStatus("connected");
      console.log("[ZeusMob] WebSocket conectado ao dispositivo:", deviceId);

      // Latency ping every 2 s
      pingTimerRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          lastPingRef.current = Date.now();
          ws.send(JSON.stringify({ type: "ping", deviceId }));
        }
      }, 2000);
    };

    ws.onmessage = (ev) => {
      // ── Binary = JPEG frame ──────────────────────────────────────
      if (ev.data instanceof ArrayBuffer || ev.data instanceof Blob) {
        console.log("[ZeusMob] Stream status: Recebendo pacotes...", ev.data instanceof ArrayBuffer ? ev.data.byteLength : "Blob");

        const now = Date.now();
        const ctr = fpsCounterRef.current;
        ctr.count++;
        const elapsed = now - ctr.last;
        if (elapsed >= 1000) {
          setStats(s => ({ ...s, fps: Math.round(ctr.count * 1000 / elapsed) }));
          ctr.count = 0;
          ctr.last  = now;
        }

        const data = ev.data instanceof ArrayBuffer ? ev.data : ev.data;
        const blob = new Blob([data], { type: "image/jpeg" });
        const url  = URL.createObjectURL(blob);
        if (frameUrlRef.current) URL.revokeObjectURL(frameUrlRef.current);
        frameUrlRef.current = url;
        setFrameUrl(url);
        return;
      }

      // ── JSON text message ────────────────────────────────────────
      if (typeof ev.data === "string") {
        try {
          const msg = JSON.parse(ev.data) as Record<string, unknown>;
          const t   = msg.type as string | undefined;

          if (t === "pong") {
            const latency = Date.now() - lastPingRef.current;
            setStats(s => ({ ...s, latencyMs: latency }));
            return;
          }

          if (t === "stats") {
            setStats({
              fps:        Number(msg.fps ?? 0),
              latencyMs:  Number(msg.latencyMs ?? 0),
              batteryPct: Number(msg.batteryPct ?? 0),
            });
            return;
          }

          if (t === "stream_ack") {
            const st = msg.status as string;
            console.log("[ZeusMob] Stream ACK:", st);
            if (st === "started") setStreaming(true);
            if (st === "stopped") { setStreaming(false); setFrameUrl(null); }
            return;
          }
        } catch {/* ignore */}
      }
    };

    ws.onerror = (e) => {
      console.warn("[ZeusMob] WS error", e);
      setStatus("disconnected");
    };

    ws.onclose = () => {
      setStatus("disconnected");
      if (pingTimerRef.current) clearInterval(pingTimerRef.current);
      reconnectRef.current = setTimeout(connect, 3000);
    };
  }, [deviceId]);

  useEffect(() => {
    connect();
    return () => {
      reconnectRef.current && clearTimeout(reconnectRef.current);
      pingTimerRef.current && clearInterval(pingTimerRef.current);
      wsRef.current?.close();
      if (frameUrlRef.current) URL.revokeObjectURL(frameUrlRef.current);
    };
  }, [connect]);

  const startStream = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn("[ZeusMob] startStream: WS not connected");
      return;
    }
    console.log("[ZeusMob] Enviando start_stream para deviceId:", deviceId);
    setStreaming(true);
    wsRef.current.send(JSON.stringify({ type: "start_stream", deviceId }));
  }, [deviceId]);

  const stopStream = useCallback(() => {
    setStreaming(false);
    setFrameUrl(null);
    setStats({ fps: 0, latencyMs: 0, batteryPct: 0 });
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "stop_stream", deviceId }));
    }
  }, [deviceId]);

  const sendCommand = useCallback((cmd: string, params?: Record<string, unknown>) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn("[ZeusMob] sendCommand: WS not connected, cmd=", cmd);
      return;
    }
    console.log("[ZeusMob] Enviando comando:", cmd, params);
    wsRef.current.send(JSON.stringify({ type: "command", cmd, deviceId, ...params }));
  }, [deviceId]);

  return { status, frameUrl, stats, startStream, stopStream, streaming, sendCommand };
}

/* ── Global Dashboard WS ────────────────────────────────────────── */
export type DashWsStatus = "active" | "inactive";

export function useDashboardWs(): DashWsStatus {
  const [active, setActive]  = useState<DashWsStatus>("inactive");
  const wsRef    = useRef<WebSocket | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function connect() {
      let url: string;
      try { url = buildWsUrl("status"); } catch { return; }
      const ws = new WebSocket(url);
      wsRef.current = ws;
      ws.onopen  = () => setActive("active");
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

/* ── Device List ───────────────────────────────────────────────── */
export function useDeviceList(): LiveDevice[] {
  const [devices, setDevices] = useState<LiveDevice[]>([]);
  const wsRef    = useRef<WebSocket | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function connect() {
      let url: string;
      try { url = buildWsUrl("dashboard"); } catch { return; }
      const ws = new WebSocket(url);
      wsRef.current = ws;
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data as string) as Record<string, unknown>;
          if (msg.type === "device_list") setDevices((msg.devices as LiveDevice[]) ?? []);
        } catch {/* ignore */}
      };
      ws.onerror = () => {};
      ws.onclose = () => { retryRef.current = setTimeout(connect, 4000); };
    }
    connect();
    return () => {
      retryRef.current && clearTimeout(retryRef.current);
      wsRef.current?.close();
    };
  }, []);

  return devices;
}
