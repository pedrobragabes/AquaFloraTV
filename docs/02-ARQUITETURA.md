# 02 — Arquitetura

## Atualizacao 2026-04-27 - arquitetura real do MVP

A arquitetura planejada abaixo ainda serve como visao de longo prazo, mas o MVP atual mudou para execucao local no PC do escritorio.

Arquitetura implementada hoje:

```text
Diego (browser)
  -> http://localhost:3000 ou http://IP-DO-PC:3000
     Next.js dashboard
       -> http://localhost:3001/api
          Express API + Prisma + SQLite
          storage/media + storage/apks

Player
  -> /player no dashboard, simulando a TV
  -> registra device, busca current-playlist, toca midias em loop e envia heartbeat
```

Componentes implementados:

- `apps/api`: Express, Prisma SQLite, upload com Multer, `/storage` estatico, playlists, schedules, devices, releases/APKs, logs, SSE e limpeza diaria de midias sem uso.
- `apps/dashboard`: auth local por senha, telas `/dashboard`, `/media`, `/playlists`, `/schedule`, `/devices`, `/devices/:id`, `/releases` e `/player`.
- `scripts/windows`: start de producao local, registro no Task Scheduler e backup local.

Hostinger/MySQL ficam como plano futuro se a loja precisar acesso externo/HTTPS publico. Para a operacao inicial, PC local + SQLite e suficiente e reduz pontos de falha.

## Visão geral

Três componentes principais se comunicando via HTTPS público:

```
┌─────────────────────┐              ┌──────────────────────┐
│  Browser (Diego)    │              │  TV Box (loja)       │
│  - Upload mídia     │              │  - Player loop       │
│  - Edita playlist   │              │  - Cache local       │
│  - Agenda conteúdo  │              │  - Heartbeat         │
│  - Vê status        │              │  - Self-update       │
└──────────┬──────────┘              └──────────┬───────────┘
           │ HTTPS                              │ HTTPS
           │                                    │
           ▼                                    ▼
    ┌──────────────────────────────────────────────┐
    │  app.aquafloragroshop.com.br                 │
    │  (Hostinger Business)                        │
    │                                              │
    │  ┌──────────────────┐   ┌─────────────────┐  │
    │  │ Next.js          │   │ Express API     │  │
    │  │ Dashboard        │◄──┤ + Prisma ORM    │  │
    │  │ (NextAuth Google)│   │ + SSE           │  │
    │  └──────────────────┘   └────────┬────────┘  │
    │                                  │           │
    │  ┌──────────────┐    ┌───────────▼────────┐  │
    │  │  MySQL       │    │  /storage          │  │
    │  │  (Prisma)    │    │  - mídias          │  │
    │  │              │    │  - APKs            │  │
    │  │              │    │  - thumbnails      │  │
    │  └──────────────┘    └────────────────────┘  │
    └──────────────────────────────────────────────┘
```

## Fluxos principais

### 1. Upload de mídia

```
Diego ─► Dashboard
  │
  ├─ Seleciona arquivo (drag-drop)
  ├─ ffmpeg.wasm valida codec e gera thumbnail no browser
  ├─ POST /api/media/upload (multipart, com thumbnail inline)
  │    │
  │    ▼
  │  API recebe via Multer
  │    ├─ Salva arquivo em /storage/media/{uuid}.mp4
  │    ├─ Salva thumbnail em /storage/thumbs/{uuid}.jpg
  │    ├─ Calcula MD5
  │    ├─ Insere em Media no MySQL (inclui size, duration, md5, url)
  │    └─ Retorna id + url pública
  │
  └─ Dashboard atualiza lista (SWR revalida)
```

### 2. Montagem de playlist + agendamento

```
Diego ─► Dashboard
  │
  ├─ Monta playlist via dnd-kit (order dos items)
  ├─ POST /api/playlists (ou PUT se edição)
  │
  ├─ Abre Agendador Visual (grade semanal 7×24)
  ├─ Arrasta playlist pros slots (ex: seg 9-18h = Playlist Geral,
  │                                   qua 9-13h = Playlist Ração Promo)
  ├─ POST /api/schedules (cria um Schedule por slot)
  │
  └─ Opcional: clica "Sincronizar agora"
       └─ POST /api/devices/:id/force-sync
            └─ API emite evento SSE pro device conectado
```

### 3. Sync no TV Box (hybrid poll + SSE)

```
TV Box boot:
  ├─ Expo app inicia
  ├─ Carrega config local (device token, última sync)
  ├─ Abre conexão SSE pra /api/devices/:id/stream
  └─ Inicia loop de poll a cada 5 min

Loop de sync (poll ou triggered por SSE):
  1. GET /api/devices/:id/current-playlist
     └─ API avalia Schedule contra horário atual do servidor
     └─ Retorna playlist ativa + items + hash
  2. Compara hash com cache local (JSON persistido)
  3. Se diferente:
       a. Para cada item novo, GET /storage/media/{id}.mp4 com Range header (resume)
       b. Salva em arquivo .tmp
       c. Valida MD5
       d. Renomeia pra nome final atômico
       e. Marca como "pronto"
  4. Ao fim: troca playlist ativa no player (sem interromper vídeo atual)

Em paralelo:
  - A cada 30s: POST /api/devices/:id/heartbeat
    com { uptime, freeDisk, currentMediaId, appVersion }
```

### 4. Auto-update da APK

```
No boot do app:
  ├─ GET /api/app/latest
  │    └─ { versionCode: 42, versionName: "1.2.3", apkUrl, apkMd5 }
  │
  ├─ Compara com versionCode local
  │
  └─ Se maior:
      ├─ Baixa APK pro diretório interno
      ├─ Valida MD5
      ├─ Chama PackageInstaller com FLAG_UPDATE via REQUEST_INSTALL_PACKAGES
      ├─ Android reinstala o app (mantém dados)
      └─ App reinicia automaticamente
```

### 5. Auth

```
Diego:
  ├─ Abre dashboard → redirect /login
  ├─ Informa senha local configurada em DASHBOARD_ADMIN_PASSWORD
  └─ Session cookie HTTP-only assinado

TV Box:
  ├─ Registro inicial: Pedro gera device + token no dashboard
  ├─ Token é inserido manualmente no app (ou via deep link / QR)
  └─ Todas requests à API levam header Authorization: Bearer <token>
       └─ Middleware Express valida JWT assinado
```

## Sincronização: poll vs push

Escolha: **híbrido poll (5min) + SSE push**.

|                      | Poll puro     | WebSocket/SSE puro      | Híbrido                            |
| -------------------- | ------------- | ----------------------- | ---------------------------------- |
| Simplicidade         | ✅ trivial    | ⚠️ reconnect logic      | ✅ poll garante                    |
| Latência             | ❌ até 5 min  | ✅ instantâneo          | ✅ instantâneo quando conectado    |
| Resiliência          | ✅ sem estado | ❌ falha se conexão cai | ✅ fallback pro poll               |
| Uso de bateria / CPU | ✅ baixo      | ⚠️ conexão persistente  | ✅ aceitável (TV tá sempre ligada) |

SSE (não WebSocket) porque:

- Push é one-way (servidor → device)
- SSE é HTTP comum, passa por proxy/CDN sem gambiarra
- Reconnect automático built-in no browser/fetch
- Simpler que socket.io pra esse caso

## Storage

### Hostinger disk layout

```
/storage/
├── media/
│   ├── {uuid}.mp4
│   ├── {uuid}.mp4
│   └── ...
├── thumbs/
│   ├── {uuid}.jpg
│   └── ...
└── apks/
    ├── aquatv-v1.0.0.apk
    ├── aquatv-v1.1.0.apk
    └── latest -> aquatv-v1.1.0.apk  (symlink)
```

Capacidade: 50GB total, 6GB já usado por outros sites (Pedro), **~44GB livres**. Isso dá pra ~1400 vídeos de 30MB (reels típicos). Sobra absurda.

### MySQL

Schema mínimo em `docs/08-DATA-MODEL.md`. Tabelas core:

- `Media` (arquivos enviados)
- `Playlist` + `PlaylistItem`
- `Schedule` (regras de quando rodar qual playlist)
- `Device` (TV Box registrada)
- `DeviceLog` (heartbeats + eventos)
- `AppRelease` (versões da APK pro auto-update)

## Segurança (nível MVP)

- HTTPS obrigatório (Hostinger cuida do cert via Let's Encrypt)
- NextAuth com Google OAuth (allowlist de emails)
- JWT pros devices, assinado com secret rotacionável
- Rate limit básico no upload (express-rate-limit)
- Multer com filtro de MIME + tamanho máx
- SQL injection: Prisma é safe por default
- CORS: API aceita só `app.aquafloragroshop.com.br`
- APKs servidos de path público mas com MD5 pra validar integridade

Não é fortaleza bancária. É o suficiente pra uso comercial small-scale.

## Resiliência

### Se a internet da loja cair

- TV Box continua tocando do cache local indefinidamente
- Heartbeat para, dashboard mostra "offline há X min"
- Quando volta: poll detecta mudanças e baixa novidades

### Se a Hostinger cair

- TV Box continua tocando do cache local
- Sem sync, sem update, sem dashboard até voltar
- Fallback plan B: subir API no Proxmox de casa (doc `07-DEPLOY.md` tem o procedimento)

### Se o app crashar

- Se AquaTV estiver como launcher (HOME intent), Android reinicia automaticamente
- Se não, BOOT_COMPLETED receiver inicia no próximo reboot
- Heartbeat ausente > 5 min = alerta no dashboard (email/push opcional)

### Se Diego derrubar o dashboard

- Dashboard rodando na Hostinger, não tem como Diego "derrubar" do browser
- Ele pode subir mídia corrompida — validação no upload bloqueia
