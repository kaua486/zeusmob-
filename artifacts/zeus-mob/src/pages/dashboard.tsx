import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import {
  Users, Zap, Bell, Layers, Ban, Dog, Settings, LogOut,
  Search, Plus, Play, Pause, Box, Clock, Timer,
  ArrowUpCircle, ArrowDownCircle, Activity, Mail, Key,
  Upload, Download, Pencil, Trash2, FileText, Link2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Dashboard() {
  const { isAuthenticated, logout } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isAuthenticated) setLocation("/login");
  }, [isAuthenticated, setLocation]);

  if (!isAuthenticated) return null;

  return (
    <div className="flex h-screen w-full bg-[#0b0f1a] text-foreground overflow-hidden font-sans">

      {/* ── Sidebar ── */}
      <aside className="w-[46px] flex-shrink-0 bg-[#0d1220] border-r border-primary/15 flex flex-col justify-between z-20">
        {/* Logo topo */}
        <div className="flex flex-col items-center gap-0.5 pt-1.5">
          <div className="w-8 h-8 rounded-md border border-primary/60 flex items-center justify-center bg-primary/10 mb-2 neon-border">
            <Zap className="w-4 h-4 text-primary" />
          </div>
          <SidebarIcon icon={Users}    label="Usuários"        active />
          <SidebarIcon icon={Zap}      label="Conexões" />
          <SidebarIcon icon={Bell}     label="Notificações" />
          <SidebarIcon icon={Layers}   label="Camadas" />
          <SidebarIcon icon={Ban}      label="Bloqueios" />
          <SidebarIcon icon={Dog}      label="Guardião" />
        </div>

        <div className="flex flex-col items-center gap-1 pb-2">
          <SidebarIcon icon={Settings} label="Configurações" />
          <SidebarIcon icon={LogOut}   label="Sair" onClick={() => logout()} variant="destructive" />
          <p className="text-[6px] font-orbitron text-primary/30 uppercase tracking-widest text-center leading-tight mt-1">
            ZEUS<br/>MOB
          </p>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 flex flex-col overflow-hidden">

        {/* Small top bar — title only */}
        <div className="flex items-center gap-2 px-4 py-1.5 border-b border-primary/10 bg-[#0d1220]/80 backdrop-blur-sm flex-shrink-0">
          <div className="w-7 h-7 rounded border border-primary/60 bg-primary/10 flex items-center justify-center neon-border shrink-0">
            <Zap className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="font-orbitron text-sm font-bold text-primary tracking-widest neon-text">ZEUS MOB</span>
          <span className="text-[10px] text-muted-foreground tracking-wider hidden sm:inline">Multiple server manager</span>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="p-3 space-y-2.5 min-w-0">

            {/* ── Stats row ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <StatCard icon={Activity}        label="Online"         value="2"       />
              <StatCard icon={Link2}           label="Conexões"       value="12"      />
              <StatCard icon={ArrowUpCircle}   label="Total Sent"     value="335,72 KB" />
              <StatCard icon={ArrowDownCircle} label="Total recebido" value="5,62 MB"  />
            </div>

            {/* ── Controls bar ── */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[160px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, IP ou er"
                  className="pl-7 h-8 text-xs bg-[#0d1220] border-primary/20 focus-visible:ring-primary placeholder:text-muted-foreground/50 w-full"
                  data-testid="input-search"
                />
              </div>

              <Select defaultValue="recent">
                <SelectTrigger className="h-8 text-xs bg-[#0d1220] border-primary/20 text-foreground/80 w-[150px]" data-testid="select-order">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0d1220] border-primary/20 text-xs">
                  <SelectItem value="recent">Ordenar: recentes</SelectItem>
                  <SelectItem value="oldest">Ordenar: antigos</SelectItem>
                  <SelectItem value="name">Ordenar: nome</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex-1" />

              <Button variant="outline" size="sm" className="h-8 text-xs border-primary/30 text-primary/80 hover:bg-primary/10 gap-1.5" data-testid="button-import">
                <Download className="w-3 h-3" />Importar
              </Button>
              <Button variant="outline" size="sm" className="h-8 text-xs border-primary/30 text-primary/80 hover:bg-primary/10 gap-1.5" data-testid="button-export">
                <Upload className="w-3 h-3" />Exportar
              </Button>
              <Button size="sm" className="h-8 text-xs bg-primary hover:bg-primary/80 text-[#0b0f1a] font-orbitron font-bold tracking-wider gap-1.5 shadow-[0_0_12px_rgba(0,212,255,0.35)]" data-testid="button-add-server">
                <Plus className="w-3.5 h-3.5" />Adicionar servidor
              </Button>
            </div>

            {/* ── Server cards ── */}
            <div className="space-y-2">
              <ServerCard
                abbr="ZA"
                name="ZEUS_INSTANCE_A1"
                ip="82.153.205.57"
                status="CONNECTED"
                email="zeusmob.json@cloud.net"
                tag="ZEUS"
                added="03/05/2026, 17:25:11"
                stats={{ start: "15/05/2026, 08:19:14", duration: "00:19:12", connections: "1", sent: "0 Bytes", received: "0 Bytes", latency: "214 ms" }}
              />
              <ServerCard
                abbr="AB"
                name="APOLLO_NODE_B4"
                ip="45.221.190.12"
                status="CONNECTED"
                email="apollo.admin@cybernetics.net"
                tag="APOLLO"
                added="04/05/2026, 09:12:44"
                stats={{ start: "15/05/2026, 10:05:22", duration: "02:44:01", connections: "11", sent: "45.2 KB", received: "1.2 MB", latency: "18 ms" }}
              />
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="absolute bottom-0 right-0 px-3 py-1 bg-[#0b0f1a]/90 border-t border-l border-primary/10 text-[9px] font-orbitron text-primary/40 tracking-widest z-20 rounded-tl-sm">
          @ZEUSMOB_DEV_PORT | ZEUSMOB | JSON
        </div>
      </main>
    </div>
  );
}

/* ── Sidebar button ── */
function SidebarIcon({ icon: Icon, label, active, onClick, variant = "primary" }: {
  icon: React.ElementType; label: string; active?: boolean; onClick?: () => void; variant?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`group relative flex items-center justify-center w-8 h-8 rounded-md transition-all duration-150
        ${active ? "bg-primary/20 border border-primary/40" : "hover:bg-primary/10 border border-transparent"}`}
      data-testid={`sidebar-${label.toLowerCase()}`}
    >
      <Icon className={`w-3.5 h-3.5 transition-all
        ${variant === "destructive" ? "text-destructive" : "text-primary/70 group-hover:text-primary group-hover:drop-shadow-[0_0_5px_rgba(0,212,255,0.7)]"}`}
      />
      <span className="absolute left-full ml-2 px-2 py-0.5 bg-[#0d1220] border border-primary/25 rounded text-[10px] text-primary opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-lg">
        {label}
      </span>
    </button>
  );
}

/* ── Stat card ── */
function StatCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="bg-[#0d1220] border border-primary/15 rounded-lg px-4 py-3 hover:border-primary/35 transition-all">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
        <Icon className="w-3 h-3" />
        <span className="text-[10px] tracking-wide">{label}</span>
      </div>
      <p className="text-primary text-base font-bold leading-none">{value}</p>
    </div>
  );
}

/* ── Server card ── */
function ServerCard({ abbr, name, ip, status, email, tag, added, stats }: {
  abbr: string; name: string; ip: string; status: string;
  email: string; tag: string; added: string;
  stats: { start: string; duration: string; connections: string; sent: string; received: string; latency: string };
}) {
  return (
    <div className="bg-[#0d1220] border border-primary/20 rounded-lg overflow-hidden hover:border-primary/45 transition-all hover:shadow-[0_0_14px_rgba(0,212,255,0.08)]">
      {/* Horizontal scroll wrapper */}
      <div className="overflow-x-auto">
        <div className="min-w-[950px]">

          {/* Row 1: identity */}
          <div className="flex items-center gap-3 px-3 py-2.5 border-b border-white/5">
            {/* Square abbreviation icon */}
            <div className="w-9 h-9 rounded-md border border-primary/50 bg-primary/10 flex items-center justify-center shrink-0">
              <span className="font-orbitron text-[11px] font-bold text-primary">{abbr}</span>
            </div>

            {/* Name */}
            <span className="font-orbitron text-sm font-bold text-primary tracking-wider shrink-0">{name}</span>

            {/* IP */}
            <span className="text-xs text-foreground/60 font-mono shrink-0">{ip}</span>

            {/* Status */}
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-sm border border-primary/30 bg-primary/8 text-[10px] font-orbitron text-primary shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00ff9d] shadow-[0_0_4px_#00ff9d] animate-pulse" />
              {status}
            </span>

            <div className="flex-1" />

            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0">
              <ActionBtn icon={Play}   tip="Play"   id={`play-${name}`} />
              <ActionBtn icon={Pause}  tip="Pause"  id={`pause-${name}`} />
              <ActionBtn icon={Box}    tip="Box"    id={`box-${name}`} />
              <ActionBtn icon={Pencil} tip="Editar" id={`edit-${name}`} />
              <ActionBtn icon={Trash2} tip="Excluir" id={`del-${name}`} danger />
            </div>
          </div>

          {/* Row 2: meta info */}
          <div className="flex items-center gap-4 px-3 py-1.5 border-b border-white/5 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1.5"><Mail className="w-2.5 h-2.5" />{email}</span>
            <span className="flex items-center gap-1.5"><Key className="w-2.5 h-2.5" />{tag}</span>
            <span className="flex items-center gap-1.5"><Clock className="w-2.5 h-2.5" />added {added}</span>
            <span className="flex items-center gap-1.5"><FileText className="w-2.5 h-2.5" />—</span>
          </div>

          {/* Row 3: stats */}
          <div className="flex items-stretch divide-x divide-white/5">
            <StatBlock icon={Clock}           label="Start Time"       value={stats.start}       />
            <StatBlock icon={Timer}           label="Session Duration" value={stats.duration}    />
            <StatBlock icon={Users}           label="Connections"      value={stats.connections} />
            <StatBlock icon={ArrowUpCircle}   label="Total Sent"       value={stats.sent}        />
            <StatBlock icon={ArrowDownCircle} label="Total Received"   value={stats.received}    />
            <StatBlock icon={Activity}        label="Latency"          value={stats.latency}     green />
          </div>

        </div>
      </div>
    </div>
  );
}

function ActionBtn({ icon: Icon, tip, id, danger }: { icon: React.ElementType; tip: string; id: string; danger?: boolean }) {
  return (
    <button
      title={tip}
      data-testid={`btn-${id}`}
      className={`w-7 h-7 rounded border flex items-center justify-center transition-all
        ${danger
          ? "border-destructive/25 text-destructive/70 hover:bg-destructive/15 hover:border-destructive/50 hover:text-destructive"
          : "border-primary/20 text-primary/60 hover:bg-primary/15 hover:border-primary/50 hover:text-primary hover:shadow-[0_0_6px_rgba(0,212,255,0.25)]"
        }`}
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  );
}

function StatBlock({ icon: Icon, label, value, green }: { icon: React.ElementType; label: string; value: string; green?: boolean }) {
  return (
    <div className="flex-1 flex items-start gap-1.5 px-3 py-2 min-w-[130px]">
      <Icon className={`w-3 h-3 shrink-0 mt-0.5 ${green ? "text-[#00ff9d]" : "text-muted-foreground/50"}`} />
      <div>
        <p className="text-[8px] uppercase text-muted-foreground/60 tracking-widest leading-none mb-1">{label}</p>
        <p className={`text-[11px] font-semibold leading-none ${green ? "text-[#00ff9d] drop-shadow-[0_0_4px_rgba(0,255,157,0.5)]" : "text-primary"}`}>{value}</p>
      </div>
    </div>
  );
}
