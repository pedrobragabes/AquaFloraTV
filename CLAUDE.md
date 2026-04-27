# AquaTV — Contexto para Claude Code

Este arquivo é lido automaticamente por agentes Claude ao abrir o projeto. Mantém a visão consolidada pra sessões rápidas; detalhes ficam em `docs/`.

## O que é

Digital signage customizado para a loja **Aquaflora Grow Shop** (aquário). Usa uma stack própria com **agendamento contextual por dia/hora** e **auto-update da APK**.

## Quem é quem

- **Pedro** (dev): dono da implementação. Hospeda na própria conta Hostinger Business. Fala português.
- **Diego** (cliente/chefe): dono da loja. Faz upload de mídia, monta playlists. Sem pressa — prioridade é fazer certo.

## Arquitetura em uma frase

Dashboard Next.js + API Node/Express no **Hostinger Business** (`app.aquafloragroshop.com.br`) ↔ TV Box **Aquário STV-3000 Plus** (Android TV 11) rodando Expo bare, via HTTPS público.

```
Diego (browser)  ─►  app.aquafloragroshop.com.br (Hostinger)
                        │   Next.js dashboard + Express API + MySQL
                        ▼
                    Storage (vídeos + APKs)
                        │
                        ▼  HTTPS pública
                    TV Box STV-3000 Plus (loja)
                        Expo bare, cache local, playback loop portrait
```

Sem Tailscale. Sem Proxmox. Tudo público via HTTPS.

## Stack

- **Monorepo**: pnpm workspaces + turborepo
- **Dashboard**: Next.js 15, TypeScript, Tailwind, NextAuth (Google), SWR, dnd-kit, ffmpeg.wasm
- **API**: Node + Express + Prisma + MySQL + Multer + SSE
- **Android**: Expo bare (Android TV 11 target), expo-video (fallback react-native-video), expo-file-system, expo-background-fetch
- **Infra**: Hostinger Business (50GB, 6GB já usados por outros sites — 44GB livres), EAS Build, GitHub Actions

Detalhes: `docs/03-STACK.md`.

## Estado atual

**Planejamento concluído em 2026-04-23.** Nenhum código escrito ainda. Próximo passo: Fase 0 (setup do monorepo + Hostinger Node.js app + subdomínio).

Roadmap completo: `docs/05-ROADMAP.md`.

## Decisões importantes (resumo)

- **Hostinger** (não Proxmox) — já pago, SLA profissional, elimina dependência da casa do Pedro
- **MySQL** (não Postgres) — default da Hostinger, Prisma suporta tranquilo
- **Portrait no app** (não pré-rotação server-side) — abordagem já validada via código Expo
- **Poll + SSE híbrido** — baseline 5min + push instantâneo via SSE
- **App como launcher** (kiosk mode) — boot direto, auto-restart grátis via OS
- **ffmpeg.wasm no browser** — Hostinger não roda ffmpeg server-side

ADRs completos: `docs/11-DECISOES.md`.

## Features core

1. **Upload + playlist manual** (baseline do MVP)
2. **Agendamento contextual** — grade semanal visual, banners temporários, pré-agendamento sazonal (DIFERENCIAL)
3. **Auto-update da APK** — app baixa nova versão sozinho, Pedro nunca mais sobe escada com pendrive (DIFERENCIAL)
4. **Métricas ricas de device** — uptime, espaço livre, mídia atual, histórico

Detalhes: `docs/04-FEATURES.md`.

## Device em produção

**Aquário STV-3000 Plus**, Android TV 11, patch de segurança 2021-10, launcher vendor "Aquário V5.5.5". Uma plataforma anterior já rodou nele — Android TV 11 + portrait + sideload via pendrive confirmados funcionando. Setup específico: `docs/06-DEVICE-SETUP.md`.

## Riscos abertos

1. `expo-video` pode bugar nesse device — plano B `react-native-video` (testar dia 1 Fase 2)
2. OTA do vendor pode resetar configs — desativar nos primeiros minutos de setup
3. Hostinger Node.js Selector tem limitações não exploradas — validar antes de Fase 1

## Como agentes Claude devem operar neste projeto

- **Sempre em português** (exceto código)
- **Honestidade > validação** — Pedro quer crítica construtiva, não concordância
- **Sem pressa artificial** — chefe não tem pressa, privilegiar decisões bem pensadas sobre velocidade
- Quando criar código: TypeScript estrito, sem `any`, sem comentários óbvios
- Quando sugerir dependência nova: justificar por que, qual a alternativa, qual o trade-off
- Nunca criar arquivos `.md` sem Pedro pedir explicitamente (exceção: atualizar os que já existem aqui)
