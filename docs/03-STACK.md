# 03 — Stack

## Atualizacao 2026-04-27 - stack implementada

O plano inicial abaixo citava Hostinger, MySQL, Tailwind, NextAuth e app Android como base imediata. A implementacao real do MVP local ficou mais simples:

| Camada      | Implementado agora                       | Observacao                                             |
| ----------- | ---------------------------------------- | ------------------------------------------------------ |
| Monorepo    | pnpm workspaces + turborepo              | Mantido do plano original                              |
| Dashboard   | Next.js 15 + TypeScript + CSS global     | Tailwind/NextAuth nao entraram; auth local por senha   |
| API         | Express + Prisma + SQLite + Multer + SSE | MySQL pausado porque o runtime primario virou PC local |
| Storage     | pasta local `storage/`                   | Ignorada no git                                        |
| Start local | PowerShell + Windows Task Scheduler      | Roda ao ligar/logar no Windows                         |
| Backup      | PowerShell + ZIP local                   | Copia SQLite e `storage/` com retencao simples         |
| Android TV  | ainda nao implementado                   | Proxima etapa, usando `/player` como referencia        |

Trade-off aceito: SQLite e menos "infra de producao" que MySQL, mas para um unico PC, uma loja e baixa concorrencia ele reduz instalacao, backup e manutencao. Se depois migrar para Hostinger, Prisma deixa a migracao para MySQL viavel com ajuste de schema/migration.

## Princípios da escolha

1. **Custo zero incremental** — Hostinger já pago, tudo mais open source
2. **Familiaridade do Pedro** — stack TS/React/Node que ele já domina
3. **Maturidade** — nada alpha/beta em caminho crítico
4. **Portfólio-friendly** — tecnologias modernas demonstráveis

## Monorepo

### pnpm workspaces + turborepo

```
aquatv/
├── apps/
│   ├── dashboard/     # Next.js 15
│   ├── api/           # Express
│   └── player/        # Expo bare
├── packages/
│   ├── types/         # Tipos compartilhados
│   └── api-client/    # Cliente fetch tipado
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

**Por que pnpm**: link simbólico (sem duplicação de `node_modules`), workspaces nativo, mais rápido que npm/yarn.

**Por que turbo**: caching de build entre packages, paralelização, integração com Vercel (mesmo não usando).

**Alternativa descartada**: Nx (muita cerimônia pra 3 apps).

## Dashboard — Next.js 15

| Lib                   | Função                    | Por quê                                             |
| --------------------- | ------------------------- | --------------------------------------------------- |
| Next.js 15            | Framework web             | App Router + Server Actions maduros                 |
| TypeScript            | Tipagem                   | Cobre tudo                                          |
| Tailwind CSS          | Styling                   | Produtividade, design system implícito              |
| NextAuth v5 (Auth.js) | Auth Google               | Integração trivial com App Router                   |
| SWR                   | Data fetching             | Revalidação fácil, cache local                      |
| dnd-kit               | Drag and drop             | Playlist reorder + agendador visual                 |
| `ffmpeg.wasm`         | Processamento client-side | Thumbnail + validação sem precisar de ffmpeg server |
| react-hook-form       | Formulários               | Padrão de mercado                                   |
| zod                   | Validação                 | Runtime types, pareia com Prisma                    |

**Descartados**:

- Chakra/MUI: pesado pra caso de uso simples
- Redux: overkill pra estado local
- tRPC: feature legal mas acrescenta camada; REST cobre tudo aqui

## API — Node + Express

| Lib                | Função             | Por quê                               |
| ------------------ | ------------------ | ------------------------------------- |
| Express 4          | Framework HTTP     | Conhecido, simples, Hostinger suporta |
| Prisma             | ORM                | Type-safe, migration system, DX top   |
| mysql2             | Driver MySQL       | Driver oficial, Prisma usa            |
| Multer             | Upload multipart   | Padrão Express pra uploads            |
| jsonwebtoken       | JWT do device      | Token do player assinado              |
| zod                | Validação de input | Mesmo da dashboard, compartilhável    |
| winston            | Logs               | Estruturado, útil pra debug           |
| express-rate-limit | Rate limit         | Proteção mínima em upload             |

**Escolhido Express sobre alternatives**:

- Fastify: mais rápido mas ecossistema menor
- Hono: moderno mas experimental pra prod
- Next.js API Routes: acoplaria dashboard e API (separação explícita é melhor)

**SSE em vez de WebSocket**:

- Push é one-way
- SSE = HTTP, passa por qualquer proxy
- Reconnect built-in
- Lib: `express` serve text/event-stream nativamente, não precisa de `ws`/`socket.io`

## Player Android — Expo bare

| Lib                          | Função         | Por quê                                   |
| ---------------------------- | -------------- | ----------------------------------------- |
| Expo SDK 50+ (bare workflow) | Framework RN   | Autoupdate, file system, background fetch |
| React Native 0.73+           | Base           | Obviously                                 |
| expo-video                   | Playback       | Novo API Expo, melhor que expo-av         |
| expo-file-system             | Storage local  | Cache de vídeos + APK                     |
| expo-background-fetch        | Sync periódica | Poll a cada 5min mesmo app em background  |
| expo-screen-orientation      | Lock portrait  | Forçar orientação vertical                |
| expo-crypto                  | MD5 validation | Checar integridade do download            |
| expo-updates                 | OTA de JS      | Update hot de código JS sem rebuild APK   |

**Bare workflow (não managed)** porque:

- Precisamos mexer no `AndroidManifest.xml` (LEANBACK, HOME intent, permissions)
- Permite integrar código nativo customizado se necessário
- Auto-update via `PackageInstaller` nativo exige acesso ao manifest

**Plano B pro `expo-video`**: se bugar no STV-3000 Plus, trocar por `react-native-video` (mais antigo, mais testado em TV).

**SSE no React Native**: `react-native-sse` (lib simples, funciona).

## Infra

### Hospedagem: Hostinger Business

- **50GB disco** (6GB usados por outros 10 sites Pedro → **44GB livres**)
- Node.js Selector (até 5 apps Node concorrentes)
- MySQL incluído
- SSL/HTTPS automático
- Bandwidth ilimitado (no plano Business)
- Subdomain wildcard (pra `app.aquafloragroshop.com.br`)

**Limitação conhecida**: Node.js Selector não permite binários arbitrários (ffmpeg fora). Mitigamos com `ffmpeg.wasm` no browser.

### CI/CD: GitHub Actions

- PR → lint + typecheck + test
- Merge em `main` → deploy automático
- Deploy da API via SSH rsync pra Hostinger
- Build da APK via EAS Build
- Publish de nova APK via script que atualiza `AppRelease` no DB

### Build Android: EAS Build

- Free tier: ~30 builds/mês — suficiente
- Build cloud, sem precisar de Android Studio local
- Fallback: `eas build --local` se estourar cota

### DNS

- Domínio base: `aquafloragroshop.com.br` (já do Pedro)
- Subdomain: `app.aquafloragroshop.com.br` → Hostinger
- Gerenciado via Hostinger DNS (ou Cloudflare se preferir)

## Shared packages

### `@aquatv/types`

Tipos compartilhados entre dashboard, api e player:

- `Media`, `Playlist`, `PlaylistItem`, `Schedule`
- `Device`, `DeviceHeartbeat`, `DeviceLog`
- `AppRelease`
- Request/response shapes da API

Gerado parcialmente a partir do `schema.prisma` via `prisma generate`.

### `@aquatv/api-client`

Wrapper fetch tipado pra consumir a API:

- Re-exporta tipos do `@aquatv/types`
- Client único usável no Next.js e no Expo
- Handling de auth (JWT ou session)
- Retry logic + timeout

## Testing (fase posterior)

- **Dashboard**: Vitest + React Testing Library
- **API**: Vitest + supertest
- **Player**: Detox (E2E Android) — só na Fase 4
- **Shared**: Vitest

## Versionamento

- SemVer em cada app: `dashboard@1.0.0`, `api@1.0.0`, `player@1.0.0`
- Monorepo sem versionamento global (não é lib publicada)
- Commits em Conventional Commits (`feat:`, `fix:`, etc) — facilita changelog

## Resumo em uma tabela

| Camada       | Tech         | Alternativa descartada | Razão                  |
| ------------ | ------------ | ---------------------- | ---------------------- |
| Monorepo     | pnpm + turbo | Nx                     | Simplicidade           |
| Dashboard    | Next.js 15   | Remix                  | Familiaridade          |
| Styling      | Tailwind     | CSS Modules            | Velocidade             |
| Auth         | NextAuth v5  | Custom JWT             | Google OAuth trivial   |
| API          | Express      | Fastify                | Ecossistema            |
| ORM          | Prisma       | TypeORM                | DX                     |
| DB           | MySQL        | Postgres               | Hostinger default      |
| Mobile       | Expo bare    | RN CLI puro            | Tooling Expo           |
| Video player | expo-video   | react-native-video     | Moderno (com fallback) |
| Sync push    | SSE          | WebSocket              | Simpler, one-way basta |
| Host         | Hostinger    | Proxmox/Vercel         | Já pago + SLA          |
| Build APK    | EAS          | Android Studio local   | Zero setup             |
