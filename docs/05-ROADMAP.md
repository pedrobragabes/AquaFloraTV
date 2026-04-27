# 05 — Roadmap

## Estado real em 2026-04-27

O roadmap original abaixo foi planejado para Hostinger + MySQL + Android cedo. A execucao mudou para um MVP local no PC do escritorio, com SQLite e player web simulado primeiro.

Concluido hoje:

- Monorepo funcional com pnpm/turbo.
- API Express com Prisma SQLite, migration inicial e seed.
- Upload/listagem/remocao de midias.
- CRUD base de playlists, items e playlist default.
- CRUD base de schedules e resolucao de playlist atual.
- Registro de devices, heartbeat, current-playlist, logs e SSE/force-sync.
- Dashboard `/media`, `/playlists`, `/devices`.
- Player web `/player` para simular a TV.
- Scripts Windows para start local e Task Scheduler.
- `.gitignore` cobrindo logs, storage, SQLite DB e tsbuildinfo.

Ainda pendente para considerar MVP operacional na loja:

- Teste de boot real no PC do escritorio com Task Scheduler.
- Liberar acesso pela rede local e firewall do Windows.
- Tela `/schedule` para Diego configurar dia/hora sem API manual.
- Backup simples do SQLite e da pasta `storage/`.
- App Android TV real na STV-3000 Plus.

Se a sessao cair ou acabar token, retomar por aqui:

1. `git status --short`.
2. `.\scripts\windows\start-aquatv.ps1`.
3. Abrir `http://localhost:3000/media`, `http://localhost:3000/playlists`, `http://localhost:3000/devices` e `http://localhost:3000/player`.
4. Se a UI estiver sem estilo, encerrar processos antigos das portas 3000/3001 e iniciar de novo.
5. Priorizar `/schedule` antes do Android, porque hoje playlist manual ja existe mas agendamento visual ainda nao.

## Resumo

**5 fases, 19-27 dias de trabalho efetivo, 2-3 meses calendário** em ritmo de 2-4h/dia (side project tranquilo, chefe sem pressa).

| Fase   | Escopo         | Estimativa | Dependências |
| ------ | -------------- | ---------- | ------------ |
| Fase 0 | Setup          | 1-2d       | —            |
| Fase 1 | API + DB       | 3-4d       | Fase 0       |
| Fase 2 | Android player | 7-10d      | Fase 1       |
| Fase 3 | Dashboard      | 5-7d       | Fase 1       |
| Fase 4 | Polimento      | 3-4d       | Fase 2 + 3   |

Fases 2 e 3 podem rodar em paralelo (API já pronta), mas sozinho é mais limpo sequencial.

---

## Fase 0 — Setup (1-2 dias)

**Objetivo**: ter o terreno pronto antes de escrever feature. Nada funcional ainda.

### Tasks

- [ ] Criar repositório GitHub privado `aquatv` (monorepo)
- [x] Inicializar pnpm workspaces + turborepo
- [x] Criar apps placeholder: `apps/dashboard`, `apps/api`, `apps/player`
- [x] Criar packages: `packages/types`, `packages/api-client`
- [x] Configurar TypeScript base (tsconfig raiz + por app)
- [x] Configurar ESLint + Prettier raiz
- [x] Configurar Husky + lint-staged (pre-commit)
- [x] Conventional Commits (commitlint)
- [x] `.env.example` em cada app
- [x] README raiz com quickstart
- [x] GitHub Actions: CI com lint + typecheck (sem deploy ainda)
- [ ] Configurar subdomain `app.aquafloragroshop.com.br` no painel Hostinger
- [ ] Criar Node.js app na Hostinger vazio, responder "hello world" em GET /
- [ ] Criar MySQL database + user + grant na Hostinger
- [ ] Testar deploy manual via SSH (apenas ver se funciona)

### Critério de aceite

- `pnpm install` funciona na raiz
- `pnpm dev` sobe dashboard + api localmente
- Acesso a `app.aquafloragroshop.com.br` retorna hello world
- CI verde em PR de teste

---

## Fase 1 — API + DB (3-4 dias)

**Objetivo**: backend funcional com todos os endpoints core, testável via HTTP client (Bruno/Insomnia).

### Tasks

- [ ] Configurar Prisma com MySQL connection string
- [ ] Criar schema completo (`docs/08-DATA-MODEL.md`)
- [ ] Primeira migration
- [ ] Seed de dados mínimos (admin user, default playlist)
- [ ] Setup Express + TypeScript
- [ ] Middleware base: CORS, rate-limit, error handler, logger
- [ ] JWT middleware pro device auth
- [ ] NextAuth bridge (ou Google OAuth manual pro admin)
- [ ] Endpoints Media:
  - [ ] `GET /api/media` — lista paginada
  - [ ] `POST /api/media/upload` — multipart, Multer → /storage
  - [ ] Validar limite de upload por arquivo (300MB)
  - [ ] `DELETE /api/media/:id`
- [ ] Endpoints Playlist:
  - [ ] `GET /api/playlists`
  - [ ] `POST /api/playlists`
  - [ ] `PUT /api/playlists/:id`
  - [ ] `DELETE /api/playlists/:id`
- [ ] Endpoints Schedule:
  - [ ] `GET /api/schedules`
  - [ ] `POST /api/schedules`
  - [ ] `PUT /api/schedules/:id`
  - [ ] `DELETE /api/schedules/:id`
- [ ] Endpoints Device:
  - [ ] `POST /api/devices` — registrar novo device
  - [ ] `POST /api/devices/:id/heartbeat`
  - [ ] `GET /api/devices/:id/current-playlist` — avalia schedule
  - [ ] `GET /api/devices/:id/stream` — SSE
  - [ ] `POST /api/devices/:id/force-sync` — emite evento SSE
- [ ] Endpoints App:
  - [ ] `GET /api/app/latest`
  - [ ] `GET /api/app/download/:version`
  - [ ] `POST /api/app/releases` (admin)
- [ ] Servir `/storage/*` estático
- [ ] Configurar thresholds de armazenamento via env (warn 70%, crítico 85%)
- [ ] Job de limpeza automática de mídia sem uso (default 45 dias, configurável 30-60)
- [ ] Deploy automatizado (GitHub Actions → Hostinger SSH rsync)

### Critério de aceite

- Todos endpoints respondem corretamente via HTTP client
- Upload de arquivo de teste funciona e arquivo é servido de `/storage`
- Migration aplicada em produção
- SSE pode ser testado via `curl -N`
- Token JWT valida/invalida conforme esperado

---

## Fase 2 — Android player (7-10 dias)

**Objetivo**: APK instalado na STV-3000 Plus baixando e tocando conteúdo real da API em produção.

### Tasks

- [ ] Criar Expo bare app (`npx create-expo-app --template bare-minimum`)
- [ ] Configurar target Android TV (manifest: LEANBACK, banner, HOME intent)
- [ ] Configurar orientation portrait lock (manifest + expo-screen-orientation)
- [ ] **Dia 1 validation**: `expo-video` playing MP4 vertical na STV-3000 Plus
  - Se falhar: trocar por `react-native-video`
- [ ] Setup navegação (mesmo que seja uma tela só)
- [ ] Screen: `PlayerScreen` com video em loop
- [ ] Cliente HTTP via `@aquatv/api-client`
- [ ] Load device token do `expo-secure-store`
- [ ] Fetch current playlist ao abrir
- [ ] Download de mídia via `expo-file-system` (com progress)
- [ ] Validação MD5 via `expo-crypto`
- [ ] Cache: JSON local com estado de downloads + playlist ativa + fallback
- [ ] Estratégia de eviction local baseada em ocupação (alerta 70%, crítico 85%)
- [ ] Playback loop: quando acabar vídeo, toca próximo; fim da lista, volta ao início
- [ ] Background fetch a cada 5 min (`expo-background-fetch`)
- [ ] SSE client via `react-native-sse` conectando a `/api/devices/:id/stream`
- [ ] Heartbeat a cada 30s (POST com métricas)
- [ ] Auto-update logic:
  - [ ] Ao boot: check `/api/app/latest`
  - [ ] Se nova versão: baixa APK
  - [ ] Valida MD5
  - [ ] Instala via `PackageInstaller` (módulo nativo ou lib)
- [ ] Auto-start: HOME intent filter OU BOOT_COMPLETED receiver
- [ ] Handle de errors graciosos (sem crash em falha de rede)
- [ ] Build APK via EAS Build
- [ ] Install na STV-3000 via pendrive (1ª vez)
- [ ] Rodar 48h contínuo sem crash (smoke test)

### Critério de aceite

- TV Box pega playlist da API em prod, baixa, toca em loop
- Heartbeat aparece no dashboard (pode ser via DB query ainda, sem UI)
- Forçando nova APK no endpoint `/api/app/latest`, device baixa + instala sozinho
- Desligando internet da loja, TV continua tocando do cache
- Religando internet, TV detecta mudanças em < 5 min

### Riscos específicos da Fase 2

- `expo-video` bugar em Android TV 11 antigo → plano B `react-native-video`
- `PackageInstaller` exigir permissão especial → documentar procedimento de setup
- Vendor OTA resetar configs → desativar OTA no setup inicial
- Portrait lock não funcionar corretamente → testar ADB `wm rotation` como fallback

---

## Fase 3 — Dashboard (5-7 dias)

**Objetivo**: Diego consegue operar tudo pelo browser sem CLI.

### Tasks

- [ ] Setup Next.js 15 App Router
- [ ] Setup NextAuth v5 (Google provider, allowlist emails)
- [ ] Layout base: sidebar + topbar + content
- [ ] Páginas:
  - [ ] `/login` — redirect NextAuth
  - [ ] `/dashboard` — overview (device status, última sync)
  - [ ] `/media` — grid de mídias com upload
  - [ ] `/playlists` — lista + editor
  - [ ] `/playlists/:id` — editor com dnd-kit
  - [ ] `/schedule` — grade semanal visual
  - [ ] `/devices` — lista de TV Boxes
  - [ ] `/devices/:id` — detalhe com métricas + histórico
  - [ ] `/releases` — gestão de APKs
- [ ] Componente Upload:
  - [ ] Drag-drop zone
  - [ ] Preview inline antes de enviar
  - [ ] `ffmpeg.wasm` pra validar codec + thumbnail
  - [ ] POST pra `/api/media/upload` com progress
- [ ] Componente PlaylistEditor:
  - [ ] Lista ordenável de items (dnd-kit)
  - [ ] Add mídia via modal de busca
  - [ ] Remove/duplicate item
- [ ] Componente ScheduleGrid:
  - [ ] Grade 7 dias × 24 horas
  - [ ] Arrastar playlist pros slots
  - [ ] Modal de configuração (recorrente, prioridade, datas)
  - [ ] Preview "está tocando agora: Playlist X"
- [ ] Componente DeviceCard:
  - [ ] Status online/offline (polling ou SSE)
  - [ ] Métricas: uptime, disco, app version
  - [ ] Alertas visuais de armazenamento (70% / 85%)
  - [ ] Mídia atual
  - [ ] Botão "Sincronizar agora"
  - [ ] Chart uptime últimos 7d
- [ ] Componente ReleaseManager:
  - [ ] Upload de APK
  - [ ] Lista de versões
  - [ ] Toggle "latest"
  - [ ] Release notes
- [ ] Dark mode (padrão)
- [ ] Deploy automatizado (GitHub Actions)

### Critério de aceite

- Diego loga, faz upload, monta playlist, agenda, sync chega no device em ≤ 5 min
- Diego vê device online em tempo real
- Pedro sobe nova APK pelo dashboard e device baixa sozinho

---

## Fase 4 — Polimento (3-4 dias)

**Objetivo**: produto pronto pra substituir o Flux em produção com confiança.

### Tasks

- [ ] Chart histórico de uptime (recharts)
- [ ] Top 10 mídias mais tocadas
- [ ] Log de eventos visível no device detail
- [ ] Exportar logs (CSV)
- [ ] Alerta email quando device offline > 15 min (via serviço gratuito: Resend)
- [ ] Handle gracioso de todos os caminhos de erro
- [ ] Empty states e loading states bonitos
- [ ] Animações sutis (framer-motion onde faz sentido)
- [ ] Mobile-responsive (Diego no celular)
- [ ] Documentação interna:
  - [ ] `docs/runbook.md` — como resolver os 10 problemas mais prováveis
  - [ ] `docs/operacao-diego.md` — manual do usuário
- [ ] README matador com screenshots + diagrama
- [ ] Smoke test 2 semanas em paralelo com Flux
- [ ] Migração definitiva: cancelar Flux

### Critério de aceite

- 2 semanas sem crash em produção
- Diego consegue operar sozinho sem tirar dúvida
- README bom o suficiente pra mostrar em portfólio

---

## Cadência realista

- **Semana 1**: Fase 0 + Fase 1 (setup + API)
- **Semana 2-3**: Fase 2 (Android, onde vai doer mais)
- **Semana 4-5**: Fase 3 (Dashboard)
- **Semana 6**: Fase 4 (Polimento)
- **Semana 7-8**: Smoke test em paralelo com Flux
- **Semana 9**: Migração + cancelamento do Flux

**Total: ~2 meses calendário.**
