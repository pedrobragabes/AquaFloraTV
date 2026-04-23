# AquaTV

Digital signage customizado para lojas físicas. Dashboard web + API + app Android pra TV Box, tudo controlado remotamente.

Construído pra **AquaFlora AgroShop** como substituto self-hosted do Flux Digital, com features que faltam no SaaS original.

---

## Por que existe

A loja usa uma TV vertical no balcão pra passar reels, promoções e artes do dia. Hoje o conteúdo roda via Flux Digital (R$35/mês). O AquaTV substitui esse serviço com:

- **Agendamento contextual**: "quarta 9h-18h = promo ração", banner "HOJE TEM X", agendamento sazonal
- **Auto-update OTA**: app se atualiza sozinho — chega de subir escada com pendrive
- **Métricas reais do device**: uptime, espaço livre, mídia atual, sync histórico
- **Independência**: sem SaaS, sem vendor lock-in, sob domínio próprio

## Arquitetura

```
┌────────────────────┐
│  Diego (browser)   │
└─────────┬──────────┘
          │ HTTPS
          ▼
┌──────────────────────────────────────┐
│  app.aquafloragroshop.com.br         │
│  ┌─────────────┐  ┌────────────────┐ │
│  │ Next.js     │  │ Express API    │ │
│  │ Dashboard   │  │ + Prisma       │ │
│  └─────────────┘  └────┬───────────┘ │
│  Hostinger Business    │             │
└────────────────────┬───┘             │
                     │ MySQL + disco   │
                     ▼                 │
               ┌──────────┐            │
               │ Storage  │            │
               │ (vídeos) │            │
               └──────────┘            │
                                       │ HTTPS
                                       ▼
                    ┌──────────────────────┐
                    │ TV Box STV-3000 Plus │
                    │ Expo bare (Android   │
                    │ TV 11) — loop loja   │
                    └──────────────────────┘
```

## Stack

**Dashboard**: Next.js 15 · TypeScript · Tailwind · NextAuth · SWR · dnd-kit
**API**: Node + Express · Prisma · MySQL · Multer · SSE
**Android**: Expo bare · expo-video · expo-file-system
**Infra**: Hostinger Business · EAS Build · GitHub Actions
**Monorepo**: pnpm workspaces + turborepo

Detalhes: [`docs/03-STACK.md`](docs/03-STACK.md)

## Estrutura do monorepo (atual)

```
aquatv/
├── apps/
│   ├── dashboard/       # Next.js 15
│   ├── api/             # Express
│   └── player/          # Expo bare (Android TV)
├── packages/
│   ├── types/           # @aquatv/types
│   └── api-client/      # @aquatv/api-client
├── docs/                # esta documentação
└── turbo.json
```

## Quickstart (Fase 0)

Pré-requisito: Node.js 20+ e pnpm 10+.

```bash
pnpm install
pnpm dev
```

Serviços locais:
- Dashboard: `http://localhost:3000`
- API: `http://localhost:3001`
- Health da API: `http://localhost:3001/health`

Comandos úteis:

```bash
pnpm lint
pnpm typecheck
pnpm build
```

## Política de Armazenamento (MVP)

- Limite de upload por arquivo: **300MB**
- Alertas de ocupação: **70% (warn)** e **85% (crítico)**
- Limpeza automática de mídia sem uso: padrão **45 dias** (configurável entre 30-60)
- Cache do player: **somente playlist ativa + fallback**
- Device STV-3000 Plus: tratar orçamento de disco como **16GB total**

## Documentação

| Arquivo | Conteúdo |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | Contexto pra agentes Claude Code |
| [`docs/01-CONTEXTO.md`](docs/01-CONTEXTO.md) | Negócio, pessoas, motivação |
| [`docs/02-ARQUITETURA.md`](docs/02-ARQUITETURA.md) | Diagramas, fluxos, sincronização |
| [`docs/03-STACK.md`](docs/03-STACK.md) | Tech stack e justificativas |
| [`docs/04-FEATURES.md`](docs/04-FEATURES.md) | Lista completa de features |
| [`docs/05-ROADMAP.md`](docs/05-ROADMAP.md) | 5 fases com tasks detalhadas |
| [`docs/06-DEVICE-SETUP.md`](docs/06-DEVICE-SETUP.md) | STV-3000 Plus passo a passo |
| [`docs/07-DEPLOY.md`](docs/07-DEPLOY.md) | Deploy Hostinger + APK distribution |
| [`docs/08-DATA-MODEL.md`](docs/08-DATA-MODEL.md) | Schema Prisma |
| [`docs/09-API.md`](docs/09-API.md) | Endpoints REST + SSE |
| [`docs/10-FLUX-ANALISE.md`](docs/10-FLUX-ANALISE.md) | O que aprendemos com o Flux Digital |
| [`docs/11-DECISOES.md`](docs/11-DECISOES.md) | ADRs (Architecture Decision Records) |
| [`docs/12-APRENDIZADO.md`](docs/12-APRENDIZADO.md) | Skills desenvolvidas neste projeto |

## Status

🚧 **Fase 0 iniciada.** Scaffold inicial do monorepo concluído localmente.

## Autor

Pedro Braga — [pedrobraga855@gmail.com](mailto:pedrobraga855@gmail.com)
