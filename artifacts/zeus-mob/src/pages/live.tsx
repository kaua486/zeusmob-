import { useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useAuth } from "@/lib/auth";
import { useDeviceWebSocket } from "@/hooks/use-websocket";
import {
  Settings, Type, Camera, LayoutGrid, Eye,
  MousePointer, Square, Lock, Keyboard,
  Shield, Volume2, VolumeX, Monitor, Play, StopCircle,
  ChevronLeft, ChevronDown, Wifi, Battery, Smartphone,
  RefreshCw, Maximize2, RotateCcw,
} from "lucide-react";

/* ─── Device mock (same as dashboard) ─── */
interface Device {
  id: string; name: string; battery: number; version: string;
}
const DEVICES: Record<string, Device> = {
  d1: { id: "d1", name: "Samsung Galaxy A54",   battery: 78, version: "v4.5.4" },
  d2: { id: "d2", name: "Motorola Edge 30",      battery: 42, version: "v4.5.4" },
  d3: { id: "d3", name: "Xiaomi Redmi Note 12",  battery: 10, version: "v4.5.3" },
};

/* ─── Live Sidebar Icon ─── */
function LiveSideIcon({
  icon: Icon, label, active, onClick,
}: {
  icon: React.ElementType; label: string;
  active?: boolean; onClick?: () => void;
}) {
  return (
    <button
      title={label}
      onClick={onClick}
      className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all
        ${active
          ? "text-primary bg-primary/15 shadow-[0_0_8px_rgba(0,212,255,0.25)]"
          : "text-muted-foreground/50 hover:text-primary hover:bg-primary/10"
        }`}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}

/* ─── Battery icon colored ─── */
function BatteryIcon({ pct }: { pct: number }) {
  const color = pct > 30 ? "text-[#00ff9d]" : pct > 15 ? "text-yellow-400" : "text-red-400";
  return (
    <span className={`flex items-center gap-0.5 text-[10px] font-mono font-bold ${color}`}>
      <Battery className="w-3 h-3" />
      {pct}%
    </span>
  );
}

/* ─── Main Live Screen ─── */
export default function LiveScreen() {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const params = useParams<{ deviceId: string }>();
  const deviceId = params.deviceId ?? "d1";
  const device = DEVICES[deviceId] ?? { id: deviceId, name: "Dispositivo", battery: 0, version: "v0.0.0" };

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [activeMode, setActiveMode] = useState<"live"|"silent"|"remote"|"play">("live");
  const [activeTool, setActiveTool] = useState<string>("eye");

  const { status, frameUrl, stats, startStream, stopStream, streaming } = useDeviceWebSocket(deviceId);

  /* Draw frame on canvas when it arrives */
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

  const wsConnected = status === "connected";
  const wsConnecting = status === "connecting";

  const LIVE_TOOLS = [
    { id: "settings", icon: Settings, label: "Configurações" },
    { id: "text",     icon: Type,     label: "Texto" },
    { id: "camera",   icon: Camera,   label: "Câmera" },
    { id: "grid",     icon: LayoutGrid,label: "Grid" },
    { id: "eye",      icon: Eye,      label: "Visualizar" },
    { id: "cursor",   icon: MousePointer, label: "Cursor Remoto" },
    { id: "screen",   icon: Square,   label: "Tela" },
    { id: "lock",     icon: Lock,     label: "Bloquear" },
    { id: "lock2",    icon: Lock,     label: "Segurança" },
    { id: "keyboard", icon: Keyboard, label: "Teclado" },
    { id: "shield",   icon: Shield,   label: "Proteção" },
    { id: "volume",   icon: Volume2,  label: "Volume" },
    { id: "mute",     icon: VolumeX,  label: "Mudo" },
    { id: "rotate",   icon: RotateCcw,label: "Rotacionar" },
    { id: "monitor",  icon: Monitor,  label: "Monitor" },
  ];

  return (
    <div className="flex h-screen w-full bg-[#080c14] text-foreground overflow-hidden">

      {/* ── Left Sidebar ── */}
      <aside className="w-[52px] flex-shrink-0 bg-[#0a0e1a] border-r border-primary/10 flex flex-col items-center gap-0.5 py-2 z-20 overflow-y-auto">
        {LIVE_TOOLS.map(t => (
          <LiveSideIcon
            key={t.id}
            icon={t.icon}
            label={t.label}
            active={activeTool === t.id}
            onClick={() => setActiveTool(t.id)}
          />
        ))}
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 flex flex-col overflow-hidden">

        {/* ── Top Bar ── */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-primary/10 bg-[#0a0e1a]/90 backdrop-blur flex-shrink-0 flex-wrap gap-y-1.5">

          {/* Title + device */}
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${wsConnected ? "bg-[#00ff9d] shadow-[0_0_6px_rgba(0,255,157,0.8)]" : wsConnecting ? "bg-yellow-400 animate-pulse" : "bg-red-500/60"}`} />
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

          {/* PLAY / STOP STREAM button */}
          {!streaming ? (
            <button
              onClick={startStream}
              className="flex items-center gap-1.5 h-8 px-4 rounded-lg border border-primary/60 bg-primary/10 text-primary text-xs font-orbitron font-bold tracking-wider hover:bg-primary/20 transition-all"
              style={{ boxShadow: "0 0 12px rgba(0,212,255,0.2), inset 0 0 8px rgba(0,212,255,0.05)" }}>
              <Play className="w-3.5 h-3.5" />
              PLAY STREAM
            </button>
          ) : (
            <button
              onClick={stopStream}
              className="flex items-center gap-1.5 h-8 px-4 rounded-lg border border-red-500/60 bg-red-500/10 text-red-400 text-xs font-orbitron font-bold tracking-wider hover:bg-red-500/20 transition-all">
              <StopCircle className="w-3.5 h-3.5" />
              STOP STREAM
            </button>
          )}

          {/* Stats */}
          <div className="flex items-center gap-3 ml-1">
            {/* FPS */}
            <span className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground/60">
              <Play className="w-2.5 h-2.5 text-primary/40" />
              <span className="text-foreground/70 font-bold">{stats.fps}</span>
              <span className="text-muted-foreground/40">FPS</span>
            </span>

            {/* Latency */}
            <span className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground/60">
              <Wifi className="w-2.5 h-2.5 text-primary/40" />
              <span className={`font-bold ${stats.latencyMs < 50 ? "text-[#00ff9d]" : stats.latencyMs < 150 ? "text-yellow-400" : "text-red-400"}`}>
                {stats.latencyMs}ms
              </span>
            </span>

            {/* Battery */}
            <BatteryIcon pct={device.battery} />

            {/* WS status */}
            <span className="flex items-center gap-1 text-[10px] font-orbitron">
              <span className={`w-1.5 h-1.5 rounded-full ${wsConnected ? "bg-[#00ff9d] shadow-[0_0_4px_rgba(0,255,157,0.8)]" : "bg-red-500/60"}`} />
              <span className={wsConnected ? "text-[#00ff9d]/70" : "text-red-500/50"}>WS</span>
            </span>
          </div>

          <div className="flex-1" />

          {/* Mode buttons */}
          <div className="flex items-center gap-1">
            {(["live","silent","remote","play"] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setActiveMode(mode)}
                className={`h-7 px-2.5 rounded text-[9px] font-orbitron tracking-wider uppercase transition-all
                  ${activeMode === mode
                    ? "bg-primary/20 border border-primary/50 text-primary"
                    : "text-muted-foreground/40 hover:text-primary/60 border border-transparent"
                  }`}>
                {mode}
              </button>
            ))}
          </div>
        </div>

        {/* ── Stream Area ── */}
        <div className="flex-1 relative overflow-hidden bg-[#050810]">

          {/* Canvas (shown when streaming with frames) */}
          {streaming && frameUrl && (
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full object-contain"
              style={{ imageRendering: "pixelated" }}
            />
          )}

          {/* Waiting state (shown when not streaming or no frames yet) */}
          {(!streaming || !frameUrl) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-6">
              {/* Phone icon */}
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl border border-primary/20 bg-primary/5 flex items-center justify-center"
                  style={{ boxShadow: "0 0 30px rgba(0,212,255,0.08)" }}>
                  <Smartphone className="w-10 h-10 text-primary/40"
                    style={{ filter: "drop-shadow(0 0 8px rgba(0,212,255,0.4))" }} />
                </div>
                {/* Pulsing rings */}
                {[0,1,2].map(i => (
                  <div key={i}
                    className="absolute rounded-2xl border border-primary/10 animate-ping"
                    style={{
                      inset: `-${(i+1)*10}px`,
                      animationDelay: `${i*400}ms`,
                      animationDuration: "2s",
                    }} />
                ))}
              </div>

              <div className="text-center space-y-2">
                <p className="font-orbitron text-sm font-bold text-primary tracking-[0.3em] uppercase"
                  style={{ textShadow: "0 0 12px rgba(0,212,255,0.6)" }}>
                  AGUARDANDO STREAM
                </p>
                <p className="text-xs text-muted-foreground/50 flex items-center gap-1.5 justify-center">
                  Pressione
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-primary/30 bg-primary/10 text-primary text-[9px] font-orbitron">
                    <Play className="w-2.5 h-2.5" />PLAY
                  </span>
                  para iniciar
                </p>
              </div>

              {/* INICIAR STREAM button */}
              <button
                onClick={startStream}
                className="flex items-center gap-2 h-11 px-8 rounded-xl border border-primary/50 bg-primary/10 text-primary text-sm font-orbitron font-bold tracking-wider hover:bg-primary/20 transition-all"
                style={{ boxShadow: "0 0 20px rgba(0,212,255,0.15), inset 0 0 10px rgba(0,212,255,0.05)" }}>
                <Play className="w-4 h-4" />
                INICIAR STREAM
              </button>

              {/* WS connecting indicator */}
              {wsConnecting && (
                <p className="text-[10px] text-yellow-400/60 font-mono animate-pulse">
                  Conectando ao WebSocket...
                </p>
              )}
              {!wsConnected && !wsConnecting && (
                <p className="text-[10px] text-red-400/60 font-mono">
                  WebSocket desconectado — tentando reconectar...
                </p>
              )}
            </div>
          )}

          {/* Streaming indicator overlay */}
          {streaming && (
            <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded bg-black/60 backdrop-blur border border-red-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_6px_rgba(239,68,68,0.8)]" />
              <span className="text-[9px] font-orbitron text-red-400 tracking-widest">AO VIVO</span>
            </div>
          )}

          {/* Fullscreen + refresh buttons */}
          <div className="absolute top-2 right-2 flex items-center gap-1">
            <button
              onClick={() => { if (streaming) { stopStream(); setTimeout(startStream, 300); } }}
              title="Reiniciar stream"
              className="w-7 h-7 rounded bg-black/50 backdrop-blur border border-primary/20 text-muted-foreground/60 hover:text-primary flex items-center justify-center transition-all">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button
              title="Tela cheia"
              className="w-7 h-7 rounded bg-black/50 backdrop-blur border border-primary/20 text-muted-foreground/60 hover:text-primary flex items-center justify-center transition-all">
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* ── Bottom Navigation ── */}
        <div className="flex items-center px-3 py-2 border-t border-primary/10 bg-[#0a0e1a]/80 flex-shrink-0">
          <button
            onClick={() => setLocation("/")}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-primary/20 text-primary/60 hover:text-primary hover:border-primary/40 hover:bg-primary/10 text-xs font-orbitron tracking-wider transition-all">
            <ChevronLeft className="w-3.5 h-3.5" />
            VOLTAR
          </button>

          <div className="flex-1 flex items-center justify-center gap-2">
            <span className="text-[10px] text-muted-foreground/40 font-mono truncate max-w-[200px]">
              {device.name}
            </span>
            <span className="text-muted-foreground/20 text-[10px]">·</span>
            <span className="text-[10px] text-primary/40 font-mono">{device.version}</span>
          </div>

          <div className="w-20" />
        </div>
      </main>
    </div>
  );
}
