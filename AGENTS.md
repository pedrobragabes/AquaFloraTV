# AquaTV - Contexto para Codex

Este arquivo e lido automaticamente por agentes Codex ao abrir o projeto. Ele deve refletir o estado real do repositorio; detalhes ficam em `docs/`.

## O que e

Digital signage customizado para a loja **Aquaflora Grow Shop** com stack propria para upload de midia, playlists, agendamento contextual e, depois, auto-update da APK.

## Quem e quem

- **Pedro**: dono da implementacao. Fala portugues.
- **Diego**: cliente/chefe, dono da loja. Faz upload de midia e monta playlists. Sem pressa; prioridade e fazer certo.

## Arquitetura atual em uma frase

Dashboard Next.js + API Node/Express + Prisma/SQLite rodando no **PC local do escritorio**, com storage em disco local e player web simulado; app Android TV real fica para a proxima etapa.

```text
Diego (browser)
  -> PC do escritorio
     Next.js dashboard :3000
     Express API       :3001
     SQLite dev.db + storage/media
  -> TV Box STV-3000 Plus futuramente via app Android TV
```

Hostinger nao e mais o caminho primario imediato. Fica como plano futuro/alternativo se precisar HTTPS publico ou acesso fora da rede local.

## Stack atual

- **Monorepo**: pnpm workspaces + turborepo.
- **Dashboard**: Next.js 15, TypeScript, CSS global.
- **API**: Node + Express + Prisma + SQLite + Multer + SSE.
- **Storage**: pasta local `storage/`.
- **Runtime**: Windows, com script PowerShell e Task Scheduler.
- **Android**: planejado em Expo bare para Android TV 11.

## Estado atual - 2026-04-28

Codigo implementado hoje:

- API Express com health, middlewares, CORS, rate-limit, storage estatico e error handler.
- Prisma SQLite com migration inicial e seed.
- CRUD base de midias, playlists, schedules, devices e app releases.
- Upload de imagem/video em `/api/media/upload`.
- Upload de APK em `/api/app/releases/upload`, download em `/api/app/download/:version` e promocao de latest por canal.
- Playlist default via `GlobalConfig`.
- Resolucao de playlist atual por schedule ou fallback default.
- Auth local do dashboard com cookie assinado e `DASHBOARD_ADMIN_PASSWORD`.
- Dashboard `/dashboard`, `/media`, `/playlists`, `/schedule`, `/devices`, `/devices/:id`, `/releases`.
- Player web `/player` com loop, registro de device e heartbeat.
- `apps/player` ja tem nucleo TypeScript do player Android: cliente API, manifesto de cache e planner de sync; camada Expo/Android ainda pendente.
- Limpeza automatica diaria de midias sem uso apos `MEDIA_RETENTION_DAYS`.
- Scripts:
  - `scripts/windows/start-aquatv.ps1`
  - `scripts/windows/register-startup-task.ps1`
  - `scripts/windows/backup-aquatv.ps1`
  - `scripts/windows/register-backup-task.ps1`
  - `scripts/windows/configure-firewall.ps1`

Validacoes ja feitas durante a sessao:

- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`
- smoke de upload
- smoke de playlist default
- smoke de player registrando device

## Decisoes importantes atualizadas

- **PC local do escritorio + SQLite agora e o primario do MVP**. Simples, barato, roda ao ligar Windows.
- **Hostinger + MySQL esta pausado**. Ainda pode virar deploy publico depois.
- **Portrait continua sendo responsabilidade do app Android futuro**.
- **Poll + SSE hibrido continua valido**.
- **App como launcher/kiosk continua meta para a TV Box**.

## Proximos passos se a sessao cair

1. Rodar `git status --short` para ver o que ficou pendente.
2. Verificar se API e dashboard sobem:
   - `.\scripts\windows\start-aquatv.ps1`
   - abrir `http://localhost:3000/media`
   - abrir `http://localhost:3001/health`
3. Se a UI aparecer sem CSS, encerrar processos antigos nas portas 3000/3001 e iniciar de novo pelo script Windows.
4. Conferir acesso pela rede local usando o IP do PC do escritorio; se bloquear, rodar `scripts/windows/configure-firewall.ps1` como admin.
5. Registrar/testar backup diario com `scripts/windows/register-backup-task.ps1`.
6. Configurar `DASHBOARD_ADMIN_PASSWORD` real no PC do escritorio.
7. Proxima feature de device: app Android TV real, reaproveitando o comportamento do `/player`.

## Como agentes Codex devem operar neste projeto

- Sempre em portugues, exceto codigo.
- Honestidade > validacao; Pedro quer critica construtiva.
- Sem pressa artificial; Diego nao tem urgencia.
- TypeScript estrito, sem `any`.
- Comentarios so quando ajudam a entender logica nao obvia.
- Ao sugerir dependencia nova, justificar alternativa e trade-off.
- Nao criar arquivos `.md` sem Pedro pedir explicitamente. Atualizar docs existentes esta permitido quando a tarefa pedir documentacao.
