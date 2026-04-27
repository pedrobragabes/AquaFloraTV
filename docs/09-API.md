# 09 — API Reference

## Atualizacao 2026-04-27 - endpoints implementados localmente

Base local atual:

- API: `http://localhost:3001/api`
- Health: `http://localhost:3001/health`
- Storage: `http://localhost:3001/storage/...`

Endpoints ja implementados:

- `GET /api/media`
- `POST /api/media/upload` com campo multipart `file`
- `DELETE /api/media/:id`
- `GET /api/playlists` (inclui `defaultPlaylistId`)
- `POST /api/playlists`
- `GET /api/playlists/default`
- `PUT /api/playlists/default`
- `GET /api/playlists/:id`
- `PUT /api/playlists/:id`
- `DELETE /api/playlists/:id`
- `GET /api/schedules`
- `POST /api/schedules`
- `GET /api/schedules/current`
- `GET /api/schedules/:id`
- `PUT /api/schedules/:id`
- `DELETE /api/schedules/:id`
- `GET /api/devices`
- `POST /api/devices`
- `POST /api/devices/:id/heartbeat`
- `GET /api/devices/:id/current-playlist`
- `GET /api/devices/:id/stream`
- `POST /api/devices/:id/force-sync`
- `GET /api/devices/:id/logs`
- `POST /api/devices/:id/logs`
- `GET /api/devices/:id/heartbeats`
- app releases base em `/api/app/...`

Auth de browser ainda nao esta ativa; os endpoints administrativos estao abertos no MVP local. O token de device ja existe para registro/heartbeat/player.

Base URL produção: `https://app.aquafloragroshop.com.br/api`

Auth:

- **Browser (Diego)**: session cookie via NextAuth
- **Device (TV Box)**: header `Authorization: Bearer <device-token>`

Formato: JSON (exceto upload multipart e download de arquivos).

---

## Auth

### `GET /api/auth/session`

Retorna sessão NextAuth. Usado pelo dashboard.

### `GET /api/auth/signin/google`

Redirect pro OAuth Google.

### `POST /api/auth/signout`

Encerra sessão.

**Allowlist de emails** configurada via `ADMIN_EMAILS` env var. Qualquer outro email recebe 403.

---

## Media

### `GET /api/media`

Lista paginada.

Query params:

- `page` (int, default 1)
- `pageSize` (int, default 20, max 100)
- `search` (string, opcional)

Response:

```json
{
  "data": [
    {
      "id": "clx...",
      "filename": "promo-racao.mp4",
      "url": "/storage/media/uuid.mp4",
      "thumbnailUrl": "/storage/thumbs/uuid.jpg",
      "durationMs": 15000,
      "sizeBytes": 12345678,
      "createdAt": "2026-04-23T10:00:00Z"
    }
  ],
  "pagination": { "page": 1, "pageSize": 20, "total": 42 }
}
```

### `POST /api/media/upload`

Upload multipart.

Fields:

- `file` (required, binário) — MP4, JPG ou PNG
- `thumbnail` (optional, binário) — JPG gerado pelo ffmpeg.wasm
- `duration` (optional, int) — duração em ms se vídeo
- `width`, `height` (optional, int)

Response 201:

```json
{
  "id": "clx...",
  "url": "/storage/media/uuid.mp4",
  "md5": "d41d8cd98f00b204e9800998ecf8427e"
}
```

Limites: `MAX_UPLOAD_MB` (default 500). Rate: 10 uploads/min por user.

### `DELETE /api/media/:id`

Apaga arquivo + row. Falha se mídia em alguma playlist (return 409, forçar via `?force=true`).

---

## Playlists

### `GET /api/playlists`

Lista todas.

### `GET /api/playlists/:id`

Detalhe com items + media expandida.

### `POST /api/playlists`

```json
{ "name": "Promo Ração", "description": "Quartas 9-18h" }
```

### `PUT /api/playlists/:id`

Atualiza nome/descrição e items (reorder, add, remove).

Body:

```json
{
  "name": "Promo Ração",
  "items": [
    { "mediaId": "clx...", "order": 0, "durationOverrideMs": null },
    { "mediaId": "clx...", "order": 1, "durationOverrideMs": 8000 }
  ]
}
```

### `DELETE /api/playlists/:id`

Apaga playlist. Se referenciada em schedule ativa, 409.

---

## Schedules

### `GET /api/schedules`

Lista. Query param `active=true` pra filtrar.

### `POST /api/schedules`

Recorrente:

```json
{
  "name": "Quarta promo ração",
  "playlistId": "clx...",
  "daysOfWeek": [3],
  "startTime": "09:00",
  "endTime": "18:00",
  "priority": 0
}
```

One-off:

```json
{
  "name": "Black Friday",
  "playlistId": "clx...",
  "startDate": "2026-11-28T00:00:00Z",
  "endDate": "2026-11-30T23:59:59Z",
  "priority": 10
}
```

### `PUT /api/schedules/:id`

### `DELETE /api/schedules/:id`

### `GET /api/schedules/current`

Debug: o que o agendador resolveria agora?

Response:

```json
{
  "now": "2026-04-23T14:30:00-03:00",
  "activeSchedule": { "id": "clx...", "name": "Quarta promo ração" },
  "playlist": { "id": "clx...", "name": "Promo Ração", "itemCount": 8 }
}
```

---

## Devices

### `POST /api/devices`

Registra novo device. Gera token JWT.

```json
{ "name": "TV Balcão Aquaflora" }
```

Response 201:

```json
{
  "id": "clx...",
  "name": "TV Balcão Aquaflora",
  "token": "eyJhbGci..." // JWT longo, Pedro cola no app
}
```

Só retorna o token uma vez (Fase 4 pode adicionar rotate).

### `GET /api/devices`

Lista todos. Admin only.

### `GET /api/devices/:id`

Detalhe com últimos 20 heartbeats + stats.

### `POST /api/devices/:id/heartbeat`

**Auth: device token.**

```json
{
  "uptimeSeconds": 3600,
  "freeDiskMb": 10240,
  "totalDiskMb": 16384,
  "appVersion": "1.0.3",
  "currentMediaId": "clx...",
  "networkType": "wifi",
  "ipAddress": "192.168.1.50"
}
```

Response 204.

### `GET /api/devices/:id/current-playlist`

**Auth: device token.**

Retorna playlist que o device deve estar tocando agora. Avalia schedule.

Response:

```json
{
  "playlist": {
    "id": "clx...",
    "name": "Promo Ração",
    "hash": "sha256:abc..." // pro device comparar antes de baixar
  },
  "items": [
    {
      "id": "clx...",
      "order": 0,
      "durationOverrideMs": null,
      "media": {
        "id": "clx...",
        "storedName": "uuid.mp4",
        "url": "https://.../storage/media/uuid.mp4",
        "md5": "d41...",
        "sizeBytes": 12345678,
        "mimetype": "video/mp4"
      }
    }
  ]
}
```

### `GET /api/devices/:id/stream`

**Auth: device token.** Server-Sent Events.

Eventos possíveis:

- `sync` — device deve re-sincar agora
- `update` — nova APK disponível
- `ping` — keep-alive (a cada 20s)

```
event: sync
data: {"reason":"manual"}

event: ping
data: {}
```

### `POST /api/devices/:id/force-sync`

Admin dispara re-sync. Emite evento SSE no canal do device.

Response 202.

### `GET /api/devices/:id/logs`

Lista logs do device. Query: `level`, `event`, `from`, `to`, `limit`.

### `GET /api/devices/:id/heartbeats`

Série temporal. Query: `from`, `to` (ISO datetime), `resolution` (minute/hour/day).

---

## App Releases

### `GET /api/app/latest`

**Auth: device token.**

Retorna último release do canal do device (stable por default).

```json
{
  "versionCode": 42,
  "versionName": "1.2.3",
  "apkUrl": "https://.../storage/apks/aquatv-v1.2.3.apk",
  "apkSizeBytes": 15728640,
  "apkMd5": "d41...",
  "releaseNotes": "Corrige bug de orientação",
  "mandatory": false
}
```

### `GET /api/app/releases`

Admin lista todas.

### `POST /api/app/releases`

Admin cria (usado pelo CI após build).

```json
{
  "versionCode": 42,
  "versionName": "1.2.3",
  "apkUrl": "https://.../storage/apks/aquatv-v1.2.3.apk",
  "apkSizeBytes": 15728640,
  "apkMd5": "d41...",
  "releaseNotes": "Corrige bug de orientação",
  "channel": "STABLE",
  "active": true
}
```

### `PUT /api/app/releases/:id`

Toggle `active`, update notes.

---

## Storage (arquivos estáticos)

### `GET /storage/media/:filename`

Serve arquivo de mídia. **Sem auth** (URL é secret enough via UUID). Cache headers longos.

### `GET /storage/thumbs/:filename`

Thumbnail.

### `GET /storage/apks/:filename`

APK pra download do device.

---

## Errors

Formato padrão:

```json
{
  "error": {
    "code": "PLAYLIST_NOT_FOUND",
    "message": "Playlist clx123 not found",
    "details": {}
  }
}
```

Códigos HTTP:

- 400 — input inválido
- 401 — não autenticado
- 403 — sem permissão
- 404 — recurso não existe
- 409 — conflito (ex: delete com FK)
- 429 — rate limit
- 500 — erro interno (logado com stack)

---

## Rate limits

| Rota                              | Limite                           |
| --------------------------------- | -------------------------------- |
| `POST /api/media/upload`          | 10/min por user                  |
| `POST /api/devices/:id/heartbeat` | 60/min por device (30s × margem) |
| Outros                            | 100/min por IP                   |

---

## Versionamento

Sem prefixo `/v1/` no MVP. Se quebrar contrato no futuro, adicionar `/v2/` e manter `/v1/` lado a lado por 3 meses.
