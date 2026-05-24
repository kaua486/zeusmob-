import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import {
  Users, Zap, Bell, Layers, Ban, Dog, Settings, LogOut,
  Folder, FolderOpen, Trash2, Search, Plus, Play, Pause,
  Box, Clock, Timer, ArrowUpCircle, ArrowDownCircle, Activity, Mail, Key
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Dashboard() {
  const { isAuthenticated, logout } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isAuthenticated) {
      setLocation("/login");
    }
  }, [isAuthenticated, setLocation]);

  if (!isAuthenticated) return null;

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">

      {/* ── Sidebar ── */}
      <aside className="w-[56px] flex-shrink-0 bg-[hsl(var(--card))] border-r border-primary/20 flex flex-col justify-between z-20">
        {/* Logo topo */}
        <div className="flex flex-col items-center gap-1 pt-2">
          <div className="w-10 h-10 rounded-full border border-primary/60 flex items-center justify-center bg-primary/10 mb-2 neon-border">
            <Zap className="w-5 h-5 text-primary" />
          </div>
          <SidebarIcon icon={Users}    label="Usuários"        active />
          <SidebarIcon icon={Zap}      label="Conexões" />
          <SidebarIcon icon={Bell}     label="Notificações" />
          <SidebarIcon icon={Layers}   label="Camadas" />
          <SidebarIcon icon={Ban}      label="Bloqueios" />
          <SidebarIcon icon={Dog}      label="Guardião" />
          <SidebarIcon icon={Settings} label="Configurações" />
        </div>

        <div className="flex flex-col items-center gap-2 pb-3">
          <SidebarIcon icon={LogOut} label="Sair" onClick={() => logout()} variant="destructive" />
          <p className="text-[7px] font-orbitron text-primary/40 uppercase tracking-widest text-center leading-tight px-1">
            ZEUS<br/>MOB
          </p>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        <div className="absolute inset-0 bg-circuit opacity-30 pointer-events-none" />

        {/* Header */}
        <header className="h-[52px] border-b border-primary/20 bg-card/80 backdrop-blur-md flex items-center justify-between px-4 z-10 flex-shrink-0">
          <div className="flex items-center gap-3">
            {/* Logo raio azul */}
            <div className="w-9 h-9 rounded-full border border-primary/70 flex items-center justify-center bg-primary/10 neon-border">
              <Zap className="text-primary w-5 h-5" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-orbitron text-base font-bold text-primary tracking-widest neon-text">ZEUS MOB</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider hidden sm:inline">— Multiple server manager</span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7 text-primary hover:bg-primary/20" data-testid="button-folder"><Folder className="w-4 h-4" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-primary hover:bg-primary/20" data-testid="button-folder-open"><FolderOpen className="w-4 h-4" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/20" data-testid="button-trash-header"><Trash2 className="w-4 h-4" /></Button>
          </div>
        </header>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto z-10">
          <div className="p-3 space-y-3">

            {/* Stats row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <StatCard label="Online"         value="2"       icon={Zap}           />
              <StatCard label="Conexões"       value="12"      icon={Users}         />
              <StatCard label="Total Sent"     value="45.2 KB" icon={ArrowUpCircle} />
              <StatCard label="Total recebido" value="1.2 MB"  icon={ArrowDownCircle} />
            </div>

            {/* Controls bar */}
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative flex-1 min-w-[160px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-primary/60" />
                <Input
                  placeholder="Buscar por nome, IP ou end..."
                  className="pl-8 h-8 text-xs bg-background/50 border-primary/30 focus-visible:ring-primary"
                  data-testid="input-search"
                />
              </div>
              <Select defaultValue="recent">
                <SelectTrigger className="w-[160px] h-8 text-xs bg-background/50 border-primary/30 text-primary" data-testid="select-order">
                  <SelectValue placeholder="Ordenar" />
                </SelectTrigger>
                <SelectContent className="bg-card border-primary/30 text-xs">
                  <SelectItem value="recent">Ordenar: recentes</SelectItem>
                  <SelectItem value="oldest">Ordenar: antigos</SelectItem>
                  <SelectItem value="name">Ordenar: nome</SelectItem>
                </SelectContent>
              </Select>
              <Button
                className="h-8 text-xs px-3 bg-primary hover:bg-primary/80 text-primary-foreground font-orbitron tracking-widest shadow-[0_0_10px_rgba(0,212,255,0.35)] whitespace-nowrap"
                data-testid="button-add-server"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Adicionar servidor
              </Button>
            </div>

            {/* Server cards */}
            <div className="space-y-2">
              <ServerCard
                name="ZEUS_INSTANCE_A1"
                ip="82.153.205.57"
                status="CONNECTED"
                email="zeusmob.json@cloud.net"
                tag="ZEUS"
                added="03/05/2026, 17:25:11"
                stats={{
                  start: "15/05/2026, 08:19:14",
                  duration: "00:19:12",
                  connections: "1",
                  sent: "0 Bytes",
                  received: "0 Bytes",
                  latency: "214 ms"
                }}
              />
              <ServerCard
                name="APOLLO_NODE_B4"
                ip="45.221.190.12"
                status="CONNECTED"
                email="apollo.admin@cybernetics.net"
                tag="APOLLO"
                added="04/05/2026, 09:12:44"
                stats={{
                  start: "15/05/2026, 10:05:22",
                  duration: "02:44:01",
                  connections: "11",
                  sent: "45.2 KB",
                  received: "1.2 MB",
                  latency: "18 ms"
                }}
              />
            </div>

          </div>
        </div>

        {/* Footer */}
        <footer className="absolute bottom-0 right-0 px-3 py-1 bg-background/80 border-t border-l border-primary/20 text-[9px] font-orbitron text-primary/50 tracking-widest z-20 rounded-tl-md">
          @ZEUSMOB_DEV_PORT | ZEUSMOB | JSON
        </footer>
      </main>
    </div>
  );
}

/* ── Sidebar icon button ── */
function SidebarIcon({ icon: Icon, label, active, onClick, variant = "primary" }: {
  icon: React.ElementType; label: string; active?: boolean; onClick?: () => void; variant?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`group relative flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-200
        ${active ? "bg-primary/20 border border-primary/50 shadow-[0_0_8px_rgba(0,212,255,0.2)]" : "hover:bg-primary/10 border border-transparent"}
      `}
      data-testid={`sidebar-nav-${label.toLowerCase()}`}
    >
      <Icon className={`w-4 h-4 transition-all
        ${variant === "destructive" ? "text-destructive" : "text-primary group-hover:drop-shadow-[0_0_6px_rgba(0,212,255,0.8)]"}
      `} />
      <span className="absolute left-full ml-2 px-2 py-0.5 bg-card border border-primary/30 rounded text-[10px] text-primary opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-lg">
        {label}
      </span>
    </button>
  );
}

/* ── Stat card ── */
function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) {
  return (
    <div className="bg-card/60 backdrop-blur border border-primary/20 rounded-lg px-3 py-2 flex items-center justify-between gap-2 hover:border-primary/50 transition-all hover:shadow-[0_0_10px_rgba(0,212,255,0.08)]">
      <div>
        <p className="text-[9px] font-orbitron text-muted-foreground uppercase tracking-widest">{label}</p>
        <p className="text-lg font-bold text-primary leading-tight">[{value}]</p>
      </div>
      <Icon className="w-4 h-4 text-primary/50 shrink-0" />
    </div>
  );
}

/* ── Server card — horizontal, fixed min-width for mobile scroll ── */
function ServerCard({ name, ip, status, email, tag, added, stats }: {
  name: string; ip: string; status: string; email: string; tag: string; added: string;
  stats: { start: string; duration: string; connections: string; sent: string; received: string; latency: string };
}) {
  return (
    <div className="bg-card/40 backdrop-blur border border-primary/25 rounded-lg overflow-hidden hover:border-primary/60 transition-all hover:shadow-[0_0_14px_rgba(0,212,255,0.12)]">
      {/* Scrollable row — keeps horizontal on mobile */}
      <div className="overflow-x-auto">
        <div className="min-w-[900px]">

          {/* ── Top row: identity + actions ── */}
          <div className="flex items-center gap-3 px-3 py-2.5 border-b border-primary/15">
            {/* Icon */}
            <div className="w-9 h-9 rounded-full border border-primary/50 bg-primary/10 flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4 text-primary" />
            </div>

            {/* Name + IP */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="font-orbitron text-sm font-bold text-primary tracking-wider">{name}</span>
              <span className="text-xs text-foreground/70 font-mono">{ip}</span>
            </div>

            {/* Status badge */}
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-primary/40 bg-primary/10 text-[10px] font-orbitron text-primary shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00ff9d] shadow-[0_0_4px_#00ff9d] animate-pulse" />
              {status}
            </span>

            {/* Meta info */}
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{email}</span>
              <span className="flex items-center gap-1"><Key className="w-3 h-3" />{tag}</span>
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />added {added}</span>
              <span className="text-primary/40 cursor-pointer hover:text-primary">···</span>
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Action buttons */}
            <div className="flex items-center gap-1 shrink-0">
              <ActionBtn icon={Play}   testId={`btn-play-${name}`} />
              <ActionBtn icon={Pause}  testId={`btn-pause-${name}`} />
              <ActionBtn icon={Box}    testId={`btn-box-${name}`} />
              <ActionBtn icon={Trash2} testId={`btn-del-${name}`} danger />
            </div>
          </div>

          {/* ── Bottom row: stats sub-cards ── */}
          <div className="flex items-stretch divide-x divide-primary/10 px-0">
            <StatBlock icon={Clock}           label="Start Time"        value={stats.start}       />
            <StatBlock icon={Timer}           label="Session Duration"  value={stats.duration}    />
            <StatBlock icon={Users}           label="Connections"       value={stats.connections} />
            <StatBlock icon={ArrowUpCircle}   label="Total Sent"        value={stats.sent}        />
            <StatBlock icon={ArrowDownCircle} label="Total Received"    value={stats.received}    />
            <StatBlock icon={Activity}        label="Latency"           value={stats.latency}     green />
          </div>

        </div>
      </div>
    </div>
  );
}

function ActionBtn({ icon: Icon, testId, danger }: { icon: React.ElementType; testId: string; danger?: boolean }) {
  return (
    <button
      data-testid={testId}
      className={`w-7 h-7 rounded border flex items-center justify-center transition-all
        ${danger
          ? "border-destructive/30 text-destructive hover:bg-destructive/20 hover:border-destructive"
          : "border-primary/30 text-primary hover:bg-primary/20 hover:border-primary hover:shadow-[0_0_6px_rgba(0,212,255,0.3)]"
        }`}
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  );
}

function StatBlock({ icon: Icon, label, value, green }: { icon: React.ElementType; label: string; value: string; green?: boolean }) {
  return (
    <div className="flex-1 flex items-center gap-1.5 px-3 py-2 min-w-[120px]">
      <Icon className={`w-3 h-3 shrink-0 ${green ? "text-[#00ff9d]" : "text-primary/50"}`} />
      <div>
        <p className="text-[8px] uppercase text-muted-foreground tracking-widest leading-none mb-0.5">{label}</p>
        <p className={`text-xs font-medium leading-none ${green ? "text-[#00ff9d] drop-shadow-[0_0_4px_rgba(0,255,157,0.5)]" : "text-primary"}`}>{value}</p>
      </div>
    </div>
  );
}
