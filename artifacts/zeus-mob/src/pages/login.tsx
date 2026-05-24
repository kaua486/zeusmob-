import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [, setLocation] = useLocation();
  const { login } = useAuth();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (login(email, password)) {
      setLocation("/");
    } else {
      setError("Credenciais inválidas. Tente novamente.");
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background bg-circuit relative overflow-hidden">
      {/* Decorative lightning background glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="relative z-10 w-full max-w-md p-8 rounded-2xl bg-card/80 backdrop-blur-xl border border-primary/30 neon-border">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary flex items-center justify-center mb-4 animate-neon-pulse">
            <Zap className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-orbitron font-bold text-primary neon-text tracking-wider">ZEUS MOB</h1>
          <p className="text-muted-foreground text-sm uppercase tracking-widest mt-2">Multiple Server Manager</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wider text-primary/80 font-orbitron" htmlFor="email">Email de acesso</label>
            <Input 
              id="email"
              type="email" 
              placeholder="admin@cybernetics.net"
              className="bg-background/50 border-primary/30 focus-visible:ring-primary h-12 text-lg"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              data-testid="input-email"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wider text-primary/80 font-orbitron" htmlFor="password">Senha de acesso</label>
            <Input 
              id="password"
              type="password" 
              placeholder="••••••••"
              className="bg-background/50 border-primary/30 focus-visible:ring-primary h-12 text-lg"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              data-testid="input-password"
              required
            />
          </div>

          {error && <p className="text-destructive text-sm text-center font-medium" data-testid="text-error">{error}</p>}

          <Button 
            type="submit" 
            className="w-full h-12 text-lg font-orbitron tracking-wider bg-primary hover:bg-primary/80 text-primary-foreground shadow-[0_0_15px_rgba(0,212,255,0.4)] transition-all"
            data-testid="button-submit"
          >
            INICIAR SESSÃO
          </Button>
        </form>

        <div className="mt-8 text-center text-xs text-muted-foreground tracking-widest font-orbitron">
          &copy; CYBERNETICS EMPIRE
        </div>
      </div>
    </div>
  );
}
