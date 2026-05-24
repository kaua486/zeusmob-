import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Users, Zap, Bell, Layers, Ban, Dog, Settings, LogOut, Folder, FolderOpen, Trash2, Search, Plus, Play, Pause, Box } from "lucide-react";
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
      {/* Sidebar */}
      <aside className="w-[80px] md:w-[240px] flex-shrink-0 bg-sidebar border-r border-primary/20 flex flex-col justify-between z-20">
        <div className="flex flex-col gap-2 p-4">
          <SidebarIcon icon={Users} label="Usuários" active />
          <SidebarIcon icon={Zap} label="Conexões" />
          <SidebarIcon icon={Bell} label="Notificações" />
          <SidebarIcon icon={Layers} label="Camadas" />
          <SidebarIcon icon={Ban} label="Bloqueios" />
          <SidebarIcon icon={Dog} label="Guardião" />
          <SidebarIcon icon={Settings} label="Configurações" />
        </div>
        
        <div className="p-4 flex flex-col gap-4">
          <SidebarIcon icon={LogOut} label="Sair" onClick={() => logout()} variant="destructive" />
          <div className="text-center">
             <span className="text-[10px] font-orbitron text-muted-foreground uppercase tracking-widest hidden md:inline-block">ZEUS MOB<br/>BY CYBERNETICS</span>
             <span className="text-[10px] font-orbitron text-muted-foreground uppercase tracking-widest md:hidden">ZM</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        {/* Background glow effects */}
        <div className="absolute inset-0 bg-circuit opacity-40 pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[150px] pointer-events-none" />
        
        {/* Header */}
        <header className="h-[80px] border-b border-primary/20 bg-card/80 backdrop-blur-md flex items-center justify-between px-6 z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full border border-primary flex items-center justify-center bg-primary/10 neon-border animate-pulse">
              {/* Lion/Zeus logo proxy */}
              <Zap className="text-primary w-6 h-6" />
            </div>
            <div>
              <h1 className="font-orbitron text-xl font-bold text-primary tracking-widest neon-text">ZEUS MOB</h1>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Multiple server manager</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="text-primary hover:bg-primary/20 hover:text-primary"><Folder className="w-5 h-5" /></Button>
            <Button variant="ghost" size="icon" className="text-primary hover:bg-primary/20 hover:text-primary"><FolderOpen className="w-5 h-5" /></Button>
            <Button variant="ghost" size="icon" className="text-primary hover:bg-destructive/20 hover:text-destructive"><Trash2 className="w-5 h-5" /></Button>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 z-10 space-y-6">
          
          {/* Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Online" value="2" icon={Zap} />
            <StatCard label="Conexões" value="12" icon={Users} />
            <StatCard label="Total Sent" value="45.2 KB" icon={Layers} />
            <StatCard label="Total recebido" value="1.2 MB" icon={Box} />
          </div>

          {/* Controls */}
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-card/50 p-4 rounded-xl border border-primary/20 backdrop-blur-sm">
            <div className="relative w-full md:w-[400px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
              <Input 
                placeholder="Buscar por nome, IP ou end..." 
                className="pl-10 bg-background/50 border-primary/30 focus-visible:ring-primary h-10 w-full"
                data-testid="input-search"
              />
            </div>

            <div className="flex items-center gap-4 w-full md:w-auto">
              <Select defaultValue="recent">
                <SelectTrigger className="w-[180px] bg-background/50 border-primary/30 h-10 text-primary">
                  <SelectValue placeholder="Ordenar" />
                </SelectTrigger>
                <SelectContent className="bg-card border-primary/30">
                  <SelectItem value="recent">Ordenar: recentes</SelectItem>
                  <SelectItem value="oldest">Ordenar: antigos</SelectItem>
                  <SelectItem value="name">Ordenar: nome</SelectItem>
                </SelectContent>
              </Select>

              <Button className="bg-primary hover:bg-primary/80 text-primary-foreground font-orbitron tracking-widest shadow-[0_0_10px_rgba(0,212,255,0.4)] whitespace-nowrap" data-testid="button-add-server">
                <Plus className="w-4 h-4 mr-2" />
                ADICIONAR SERVIDOR
              </Button>
            </div>
          </div>

          {/* Servers Grid */}
          <div className="grid grid-cols-1 gap-6">
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

        {/* Footer */}
        <footer className="absolute bottom-0 right-0 p-2 px-4 bg-background/80 backdrop-blur border-t border-l border-primary/20 text-[10px] font-orbitron text-primary/70 tracking-widest z-20 rounded-tl-lg">
          @ZEUSMOB_DEV_PORT | ZEUSMOB | JSON
        </footer>
      </main>
    </div>
  );
}

function SidebarIcon({ icon: Icon, label, active, onClick, variant = "primary" }: any) {
  return (
    <button 
      onClick={onClick}
      className={`group relative flex items-center justify-center md:justify-start w-full p-3 rounded-lg transition-all duration-300
        ${active ? 'bg-primary/20 border border-primary/50 shadow-[0_0_10px_rgba(0,212,255,0.2)]' : 'hover:bg-primary/10 border border-transparent'}
      `}
      data-testid={`sidebar-nav-${label.toLowerCase()}`}
    >
      <Icon className={`w-6 h-6 ${variant === 'destructive' ? 'text-destructive' : 'text-primary group-hover:drop-shadow-[0_0_8px_rgba(0,212,255,0.8)]'} transition-all`} />
      <span className={`hidden md:block ml-4 text-sm font-medium tracking-wide
        ${variant === 'destructive' ? 'text-destructive' : 'text-primary/80 group-hover:text-primary'}
      `}>
        {label}
      </span>
      {/* Tooltip for mobile */}
      <span className="md:hidden absolute left-full ml-4 px-2 py-1 bg-card border border-primary/30 rounded text-xs text-primary opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
        {label}
      </span>
    </button>
  );
}

function StatCard({ label, value, icon: Icon }: any) {
  return (
    <div className="bg-card/60 backdrop-blur border border-primary/20 rounded-xl p-4 flex items-center justify-between group hover:border-primary/50 transition-all hover:shadow-[0_0_15px_rgba(0,212,255,0.1)]">
      <div>
        <p className="text-muted-foreground text-sm uppercase tracking-wider font-orbitron">{label}</p>
        <p className="text-2xl font-bold text-primary mt-1">{value}</p>
      </div>
      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20 group-hover:border-primary/50 group-hover:shadow-[0_0_10px_rgba(0,212,255,0.3)] transition-all">
        <Icon className="w-6 h-6 text-primary" />
      </div>
    </div>
  );
}

function ServerCard({ name, ip, status, email, tag, added, stats }: any) {
  return (
    <div className="bg-card/40 backdrop-blur-sm border border-primary/30 rounded-xl p-6 relative overflow-hidden group hover:border-primary/70 transition-all duration-500 hover:shadow-neon">
      {/* Decorative inner glow */}
      <div className="absolute -top-20 -right-20 w-40 h-40 bg-primary/10 rounded-full blur-[50px] group-hover:bg-primary/20 transition-all" />
      
      <div className="flex flex-col lg:flex-row justify-between gap-6 relative z-10">
        {/* Left column: Identity */}
        <div className="flex gap-4 items-start">
          <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/50 flex items-center justify-center shrink-0">
            <Zap className="w-7 h-7 text-primary animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-primary font-orbitron tracking-wider">{name}</h2>
              <span className="px-2 py-0.5 rounded-full border border-primary/50 bg-primary/10 text-primary text-xs flex items-center gap-1.5 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00ff9d] shadow-[0_0_5px_#00ff9d] animate-pulse" />
                {status}
              </span>
            </div>
            <p className="text-lg text-foreground/90 font-mono mt-1">{ip}</p>
            
            <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><Users className="w-4 h-4" /> {email}</span>
              <span className="flex items-center gap-1"><Box className="w-4 h-4" /> {tag}</span>
              <span className="flex items-center gap-1"><Folder className="w-4 h-4" /> {added}</span>
            </div>
          </div>
        </div>

        {/* Right column: Actions */}
        <div className="flex items-start gap-2">
          <Button variant="outline" size="icon" className="border-primary/30 text-primary hover:bg-primary/20 hover:border-primary hover:shadow-[0_0_10px_rgba(0,212,255,0.3)]"><Play className="w-4 h-4" /></Button>
          <Button variant="outline" size="icon" className="border-primary/30 text-primary hover:bg-primary/20 hover:border-primary hover:shadow-[0_0_10px_rgba(0,212,255,0.3)]"><Pause className="w-4 h-4" /></Button>
          <Button variant="outline" size="icon" className="border-primary/30 text-primary hover:bg-primary/20 hover:border-primary hover:shadow-[0_0_10px_rgba(0,212,255,0.3)]"><Box className="w-4 h-4" /></Button>
          <Button variant="outline" size="icon" className="border-destructive/30 text-destructive hover:bg-destructive/20 hover:border-destructive hover:shadow-[0_0_10px_rgba(255,0,0,0.3)]"><Trash2 className="w-4 h-4" /></Button>
        </div>
      </div>

      {/* Stats Divider */}
      <div className="w-full h-px bg-gradient-to-r from-primary/0 via-primary/30 to-primary/0 my-6" />

      {/* Bottom column: Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 relative z-10">
        <div className="flex flex-col">
          <span className="text-xs uppercase text-muted-foreground tracking-wider mb-1">Start Time</span>
          <span className="text-primary font-medium">{stats.start}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-xs uppercase text-muted-foreground tracking-wider mb-1">Session Duration</span>
          <span className="text-primary font-medium">{stats.duration}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-xs uppercase text-muted-foreground tracking-wider mb-1">Connections</span>
          <span className="text-primary font-medium">{stats.connections}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-xs uppercase text-muted-foreground tracking-wider mb-1">Total Sent</span>
          <span className="text-primary font-medium">{stats.sent}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-xs uppercase text-muted-foreground tracking-wider mb-1">Total Received</span>
          <span className="text-primary font-medium">{stats.received}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-xs uppercase text-muted-foreground tracking-wider mb-1">Latency</span>
          <span className="text-[#00ff9d] font-medium drop-shadow-[0_0_5px_rgba(0,255,157,0.5)]">{stats.latency}</span>
        </div>
      </div>
    </div>
  );
}
