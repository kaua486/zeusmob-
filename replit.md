# ZEUS MOB

Painel de gerenciamento de múltiplos servidores com tema dark cyberpunk/neon — tela de login protegida e dashboard com cards de servidores, estatísticas em tempo real e sidebar de navegação.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/zeus-mob run dev` — run the frontend (reads PORT from env)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS + shadcn/ui + wouter
- Auth: client-side only (hardcoded admin credentials in zustand store)
- Fonts: Rajdhani + Orbitron (Google Fonts)
- Icons: lucide-react

## Where things live

- `artifacts/zeus-mob/src/pages/login.tsx` — login screen
- `artifacts/zeus-mob/src/pages/dashboard.tsx` — main dashboard
- `artifacts/zeus-mob/src/lib/auth.ts` — zustand auth store (hardcoded credentials)
- `artifacts/zeus-mob/src/index.css` — dark cyberpunk theme (neon cyan palette)

## Product

ZEUS MOB é um painel de gerenciamento de servidores inspirado na estética de impérios tecnológicos mitológicos. Acesso protegido por login, mostra servidores conectados com estatísticas de latência, sessão, bytes enviados/recebidos e mais.

## User preferences

- Idioma: Português Brasileiro
- Conta admin: gabrielaalmeida6781@gmail.com / @gabriela 124

## Gotchas

- Auth é puramente client-side (localStorage). Não há backend de autenticação.
- `zustand` deve estar instalado em `@workspace/zeus-mob` (não é uma dependência catalog padrão).
