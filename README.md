# AquaTV

Digital signage customizado para a AquaFlora AgroShop. O objetivo e operar uma stack propria, com upload de midias, playlists, agendamento contextual e, em fase futura, app Android TV com auto-update de APK.

## Estado atual - 2026-04-28

Hoje o projeto esta funcional como MVP local no PC do escritorio:

- API Express + Prisma + SQLite.
- Dashboard Next.js com telas `/media`, `/playlists`, `/schedule`, `/devices`, `/releases` e `/player`.
- Login local do dashboard com cookie assinado e senha de admin.
- Upload de imagens/videos para `storage/media`.
- Playlist default configuravel.
- Resolucao de playlist atual por schedule ou fallback default.
- Limpeza automatica diaria de midias sem uso apos `MEDIA_RETENTION_DAYS`.
- Player web simulado em `/player`, com loop de midias, registro de device e heartbeat.
- Painel de devices com status, metricas recebidas e botao de force-sync.
- Pagina de detalhe de device com heartbeats/logs recentes.
- Painel de APKs em `/releases`, com upload, MD5 calculado pela API, download e promocao de latest por canal.
- Nucleo TypeScript do futuro app Android em `apps/player`, com cliente API, manifesto de cache e planner de sync.
- Scripts Windows para rodar em producao local e registrar inicio automatico no logon.
- Scripts Windows para backup local do SQLite e da pasta `storage/`.

Hostinger deixou de ser o caminho primario imediato. A decisao atual e rodar no PC local do escritorio, porque o equipamento tem folga (i9 9900K) e reduz dependencias de deploy neste MVP. Hostinger fica como opcao futura se precisar acesso externo ou operacao fora da rede local.

## Arquitetura atual

```text
Diego no browser
  -> http://localhost:7740 ou http://IP-DO-PC:7740
     Next.js dashboard
       -> http://localhost:7741/api
          Express API + Prisma + SQLite
          storage/media

TV / player
  -> por enquanto: /player no browser
  -> proxima fase: app Android TV na STV-3000 Plus
```

## Stack atual

- Monorepo: pnpm workspaces + turborepo.
- Dashboard: Next.js 15, TypeScript, CSS global.
- API: Node, Express, Prisma, SQLite, Multer, SSE.
- Storage: pasta local `storage/`.
- Runtime local: Windows + Task Scheduler.
- Android TV: planejado, ainda nao implementado.

## Quickstart local

Pre-requisitos:

- Node.js 20+
- pnpm 10+

Instalar dependencias:

```bash
pnpm install
```

Desenvolvimento:

```bash
pnpm dev
```

Producao local no Windows:

```powershell
.\scripts\windows\start-aquatv.ps1
```

Registrar para iniciar quando o Windows fizer logon:

```powershell
.\scripts\windows\register-startup-task.ps1
```

Backup manual:

```powershell
.\scripts\windows\backup-aquatv.ps1
```

Registrar backup diario as 03:00:

```powershell
.\scripts\windows\register-backup-task.ps1
```

Liberar acesso pela rede local (PowerShell como Administrador):

```powershell
.\scripts\windows\configure-firewall.ps1
```

URLs:

- Dashboard: `http://localhost:7740`
- Login: `http://localhost:7740/login`
- API health: `http://localhost:7741/health`
- Resumo: `http://localhost:7740/dashboard`
- Midias: `http://localhost:7740/media`
- Playlists: `http://localhost:7740/playlists`
- Agenda: `http://localhost:7740/schedule`
- Devices: `http://localhost:7740/devices`
- APKs: `http://localhost:7740/releases`
- Player web: `http://localhost:7740/player`

Para acessar de outro aparelho na mesma rede, usar o IP do PC do escritorio no lugar de `localhost` e liberar as portas `7740` e `7741` no firewall do Windows.

Em desenvolvimento, se `DASHBOARD_ADMIN_PASSWORD` nao estiver configurado, a senha local e `aquatv-local`. Para operar na loja, configurar `DASHBOARD_ADMIN_PASSWORD` em `apps/dashboard/.env.local`.

## Comandos uteis

```bash
pnpm lint
pnpm typecheck
pnpm build
```

## Estrutura

```text
aquatv/
  apps/
    api/             Express API, Prisma, storage routes
    dashboard/       Next.js dashboard e player web simulado
    player/          futuro app Android TV
  packages/
    types/
    api-client/
  scripts/windows/   start local, Task Scheduler e backup
  docs/              documentacao do projeto
```

## O que foi validado hoje

- `pnpm typecheck`, `pnpm lint` e `pnpm build` passaram durante a implementacao.
- `GET /health` respondeu 200.
- Upload smoke criou uma imagem em `storage/media`.
- Playlist smoke criou playlist, adicionou midia e marcou como default.
- `GET /api/schedules/current` retornou a playlist default com item.
- Player web registrou device e heartbeat apareceu em `/api/devices`.
- Login local protegeu `/releases` e liberou acesso apos senha.
- Smoke de APK validou upload, `GET /api/app/latest`, download e dashboard `/releases`.
- Smoke de backup criou ZIP em `backups/`.

## Proximos passos se retomar depois

1. Testar o start limpo: reiniciar o PC, confirmar se a task sobe API e dashboard sozinha.
2. Abrir no browser do proprio PC: `http://localhost:7740/media`.
3. Abrir de outro aparelho na rede usando `http://IP-DO-PC:7740`.
4. Se nao abrir pela rede, rodar `.\scripts\windows\configure-firewall.ps1` em PowerShell como Administrador.
5. Se a pagina aparecer sem estilo, matar processos antigos nas portas 7740/7741 e rodar `.\scripts\windows\start-aquatv.ps1` de novo.
6. Configurar `DASHBOARD_ADMIN_PASSWORD` real no PC do escritorio.
7. Comecar o app Android TV real, usando o `/player` web como referencia de comportamento.

## Documentacao

| Arquivo                  | Conteudo                                        |
| ------------------------ | ----------------------------------------------- |
| `AGENTS.md`              | Contexto rapido para agentes Codex              |
| `docs/02-ARQUITETURA.md` | Arquitetura e fluxos                            |
| `docs/03-STACK.md`       | Stack e decisoes tecnicas                       |
| `docs/05-ROADMAP.md`     | Roadmap atualizado                              |
| `docs/07-DEPLOY.md`      | Deploy local Windows e plano Hostinger futuro   |
| `docs/08-DATA-MODEL.md`  | Modelo de dados planejado e implementacao atual |
| `docs/09-API.md`         | API REST/SSE                                    |
| `docs/11-DECISOES.md`    | ADRs                                            |

## Autor

Pedro Braga - [pedrobraga855@gmail.com](mailto:pedrobraga855@gmail.com)
