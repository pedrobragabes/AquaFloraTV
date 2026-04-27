# AquaTV

Digital signage customizado para a AquaFlora AgroShop. O objetivo e operar uma stack propria, com upload de midias, playlists, agendamento contextual e, em fase futura, app Android TV com auto-update de APK.

## Estado atual - 2026-04-27

Hoje o projeto esta funcional como MVP local no PC do escritorio:

- API Express + Prisma + SQLite.
- Dashboard Next.js com telas `/media`, `/playlists`, `/devices` e `/player`.
- Upload de imagens/videos para `storage/media`.
- Playlist default configuravel.
- Resolucao de playlist atual por schedule ou fallback default.
- Player web simulado em `/player`, com loop de midias, registro de device e heartbeat.
- Painel de devices com status, metricas recebidas e botao de force-sync.
- Scripts Windows para rodar em producao local e registrar inicio automatico no logon.

Hostinger deixou de ser o caminho primario imediato. A decisao atual e rodar no PC local do escritorio, porque o equipamento tem folga (i9 9900K) e reduz dependencias de deploy neste MVP. Hostinger fica como opcao futura se precisar acesso externo ou operacao fora da rede local.

## Arquitetura atual

```text
Diego no browser
  -> http://localhost:3000 ou http://IP-DO-PC:3000
     Next.js dashboard
       -> http://localhost:3001/api
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

URLs:

- Dashboard: `http://localhost:3000`
- API health: `http://localhost:3001/health`
- Midias: `http://localhost:3000/media`
- Playlists: `http://localhost:3000/playlists`
- Devices: `http://localhost:3000/devices`
- Player web: `http://localhost:3000/player`

Para acessar de outro aparelho na mesma rede, usar o IP do PC do escritorio no lugar de `localhost` e liberar as portas `3000` e `3001` no firewall do Windows.

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
  scripts/windows/   start local e Task Scheduler
  docs/              documentacao do projeto
```

## O que foi validado hoje

- `pnpm typecheck`, `pnpm lint` e `pnpm build` passaram durante a implementacao.
- `GET /health` respondeu 200.
- Upload smoke criou uma imagem em `storage/media`.
- Playlist smoke criou playlist, adicionou midia e marcou como default.
- `GET /api/schedules/current` retornou a playlist default com item.
- Player web registrou device e heartbeat apareceu em `/api/devices`.

## Proximos passos se retomar depois

1. Testar o start limpo: reiniciar o PC, confirmar se a task sobe API e dashboard sozinha.
2. Abrir no browser do proprio PC: `http://localhost:3000/media`.
3. Abrir de outro aparelho na rede usando `http://IP-DO-PC:3000`.
4. Se a pagina aparecer sem estilo, matar processos antigos nas portas 3000/3001 e rodar `.\scripts\windows\start-aquatv.ps1` de novo.
5. Implementar a tela `/schedule` para Diego montar regras por dia/hora.
6. Comecar o app Android TV real, usando o `/player` web como referencia de comportamento.

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
