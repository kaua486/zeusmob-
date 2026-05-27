import { IncomingMessage } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { logger } from "../lib/logger.js";

interface WsClient {
  ws: WebSocket;
  role: string;
  deviceId?: string;
}

const clients = new Set<WsClient>();

export function createWsServer(server: import("http").Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: undefined });

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    const url  = new URL(req.url ?? "/", "http://localhost");
    const role = url.searchParams.get("role") ?? "unknown";
    const deviceId = url.searchParams.get("deviceId") ?? undefined;

    const client: WsClient = { ws, role, deviceId };
    clients.add(client);

    logger.info({ role, deviceId }, "WS client connected");

    // Send a status pong
    const welcome = JSON.stringify({ type: "welcome", role, deviceId });
    ws.send(welcome);

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as { type: string; deviceId?: string };

        if (msg.type === "start_stream") {
          logger.info({ deviceId: msg.deviceId }, "Stream start requested");
          // In production, signal the Android client to start sending frames.
          // For now, ack the request.
          ws.send(JSON.stringify({ type: "stream_ack", status: "started", deviceId: msg.deviceId }));
        }

        if (msg.type === "stop_stream") {
          logger.info({ deviceId: msg.deviceId }, "Stream stop requested");
          ws.send(JSON.stringify({ type: "stream_ack", status: "stopped", deviceId: msg.deviceId }));
        }

        if (msg.type === "frame" && msg.deviceId) {
          // Android device pushing a JPEG frame — relay to watchers
          for (const c of clients) {
            if (c.role === "watch" && c.deviceId === msg.deviceId && c.ws.readyState === WebSocket.OPEN) {
              c.ws.send(raw);
            }
          }
        }
      } catch {
        // binary frame (JPEG) from device — relay to watchers for this device
        if (deviceId && role === "device") {
          for (const c of clients) {
            if (c.role === "watch" && c.deviceId === deviceId && c.ws.readyState === WebSocket.OPEN) {
              c.ws.send(raw);
            }
          }
        }
      }
    });

    ws.on("close", () => {
      clients.delete(client);
      logger.info({ role, deviceId }, "WS client disconnected");
    });

    ws.on("error", (err) => {
      logger.error({ err, role, deviceId }, "WS error");
    });
  });

  // Broadcast stats every 2 seconds to all watchers
  setInterval(() => {
    const statsMsg = JSON.stringify({
      type: "stats",
      fps: 0,
      latencyMs: 0,
      batteryPct: 0,
    });
    for (const c of clients) {
      if (c.role === "watch" && c.ws.readyState === WebSocket.OPEN) {
        c.ws.send(statsMsg);
      }
    }
  }, 2000);

  return wss;
}
