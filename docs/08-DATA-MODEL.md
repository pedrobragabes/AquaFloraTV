# 08 — Data Model (Prisma)

Schema completo em Prisma, DB MySQL. Gerado em `apps/api/prisma/schema.prisma`.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

// ─────────────────────────────────────────────────────────
// Usuários (admin — Diego, Pedro)
// ─────────────────────────────────────────────────────────

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  image     String?
  role      Role     @default(ADMIN)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

enum Role {
  ADMIN
  OPERATOR   // reservado pra futuro
}

// ─────────────────────────────────────────────────────────
// Mídias (arquivos enviados pelo Diego)
// ─────────────────────────────────────────────────────────

model Media {
  id          String     @id @default(cuid())
  filename    String     // original
  storedName  String     @unique // uuid.mp4
  url         String     // URL pública de download
  thumbnailUrl String?
  mimetype    String
  sizeBytes   Int
  durationMs  Int?       // vídeo só
  widthPx     Int?
  heightPx    Int?
  md5         String
  uploadedBy  String?    // User.id
  createdAt   DateTime   @default(now())

  playlistItems PlaylistItem[]

  @@index([createdAt])
}

// ─────────────────────────────────────────────────────────
// Playlists
// ─────────────────────────────────────────────────────────

model Playlist {
  id          String         @id @default(cuid())
  name        String
  description String?
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  items       PlaylistItem[]
  schedules   Schedule[]

  @@index([name])
}

model PlaylistItem {
  id             String   @id @default(cuid())
  playlistId     String
  mediaId        String
  order          Int
  durationOverrideMs Int? // pra imagens (ignora duration do vídeo)

  playlist       Playlist @relation(fields: [playlistId], references: [id], onDelete: Cascade)
  media          Media    @relation(fields: [mediaId], references: [id], onDelete: Restrict)

  @@index([playlistId, order])
}

// ─────────────────────────────────────────────────────────
// Agendamento (killer feature)
// ─────────────────────────────────────────────────────────

model Schedule {
  id         String          @id @default(cuid())
  name       String          // "Quarta promo ração"
  playlistId String
  active     Boolean         @default(true)
  priority   Int             @default(0)  // maior vence em overlap

  // Recorrência (se null = one-off)
  daysOfWeek Int[]?          // MySQL 5.7+ com JSON: [0,1,2] (dom=0, sáb=6)
  startTime  String?         // "09:00" (HH:MM local)
  endTime    String?         // "18:00"

  // One-off / janela específica
  startDate  DateTime?       // pra agendamento único ou sazonal
  endDate    DateTime?

  createdAt  DateTime        @default(now())
  updatedAt  DateTime        @updatedAt

  playlist   Playlist        @relation(fields: [playlistId], references: [id], onDelete: Cascade)

  @@index([active, priority])
}

// Default playlist quando nenhum schedule aplicável
model GlobalConfig {
  id                  String   @id @default("singleton")
  defaultPlaylistId   String?
  updatedAt           DateTime @updatedAt
}

// ─────────────────────────────────────────────────────────
// Devices (TV Boxes)
// ─────────────────────────────────────────────────────────

model Device {
  id              String    @id @default(cuid())
  name            String    // "TV Balcão Aquaflora"
  token           String    @unique  // JWT pre-shared
  lastSeenAt      DateTime?
  appVersion      String?
  deviceModel     String?   // "STV-3000 Plus"
  androidVersion  String?   // "11"
  freeDiskMb      Int?
  totalDiskMb     Int?
  uptimeSeconds   Int?
  currentMediaId  String?
  currentPlaylistId String?
  networkType     String?   // "wifi", "ethernet"
  ipAddress       String?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  logs            DeviceLog[]
  heartbeats      DeviceHeartbeat[]

  @@index([lastSeenAt])
}

model DeviceHeartbeat {
  id            String   @id @default(cuid())
  deviceId      String
  timestamp     DateTime @default(now())
  freeDiskMb    Int?
  uptimeSeconds Int?
  appVersion    String?
  currentMediaId String?
  networkType   String?

  device        Device   @relation(fields: [deviceId], references: [id], onDelete: Cascade)

  @@index([deviceId, timestamp])
}

model DeviceLog {
  id         String      @id @default(cuid())
  deviceId   String
  timestamp  DateTime    @default(now())
  level      LogLevel    @default(INFO)
  event      String      // "boot", "sync_start", "sync_complete", "error", "playback_start"
  message    String?     @db.Text
  payload    Json?

  device     Device      @relation(fields: [deviceId], references: [id], onDelete: Cascade)

  @@index([deviceId, timestamp])
  @@index([level])
}

enum LogLevel {
  DEBUG
  INFO
  WARN
  ERROR
}

// ─────────────────────────────────────────────────────────
// App Releases (auto-update da APK)
// ─────────────────────────────────────────────────────────

model AppRelease {
  id           String   @id @default(cuid())
  versionCode  Int      @unique
  versionName  String   // "1.2.3"
  apkUrl       String
  apkSizeBytes Int
  apkMd5       String
  releaseNotes String?  @db.Text
  channel      Channel  @default(STABLE)  // STABLE | BETA
  mandatory    Boolean  @default(false)
  active       Boolean  @default(true)
  createdAt    DateTime @default(now())

  @@index([channel, active, versionCode])
}

enum Channel {
  STABLE
  BETA
}

// ─────────────────────────────────────────────────────────
// NextAuth (sessions — se usando database strategy)
// Deixado stub pra referência; pode optar por JWT strategy sem tabelas.
// ─────────────────────────────────────────────────────────

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}
```

## Notas de design

### Por que `storedName` separado de `filename`
- `filename` preserva o original (ex: "promo-ração-premium.mp4") pra UI
- `storedName` é UUID + ext pra evitar colisão no filesystem e problemas de encoding

### Por que `md5` e não `sha256`
- MD5 é suficiente pra detecção de corruption (não é uso criptográfico)
- Mais rápido de calcular em arquivos grandes
- TV Box tem CPU limitada, MD5 stream faster

### Por que `durationOverrideMs` em PlaylistItem
- Imagens não têm duração intrínseca — usuário define (default 10s)
- Vídeo ignora esse campo (usa duração própria)
- Permite customizar: "mostra essa imagem por 5s, essa por 15s"

### Por que `priority` em Schedule
- Duas schedules podem sobrepor (ex: "quarta 9-18h" + "Black Friday quarta 10-16h")
- A de maior prioridade vence no intervalo de overlap
- Default 0, usuário aumenta pra sobrescrever

### Por que separar `Device` e `DeviceHeartbeat`
- `Device.lastSeenAt` + métricas atuais = snapshot
- `DeviceHeartbeat` = série temporal pra charts (uptime histórico)
- Write intensivo (um por 30s) — separar evita mexer em row de device toda vez

### Por que não TTL nos heartbeats
- MySQL não tem TTL nativo
- Cron mensal limpa heartbeats > 90 dias (se DB crescer muito)
- Pra MVP, sem preocupação — 30s × 30 dias × 1 device = ~86k rows, trivial

### `daysOfWeek Int[]` — nota
- MySQL 5.7+ suporta JSON, mas Prisma mapeia `Int[]` de forma mais limpa em Postgres
- Em MySQL 8+, Prisma usa `JSON` column
- Se der atrito, alternativa: tabela `ScheduleDay` normalizada

## Lógica de "current playlist" (API)

Endpoint `/api/devices/:id/current-playlist` resolve:

```ts
async function getCurrentPlaylist(deviceId: string): Promise<Playlist | null> {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0-6
  const hhmm = now.toTimeString().slice(0, 5); // "14:30"

  const candidates = await prisma.schedule.findMany({
    where: {
      active: true,
      OR: [
        // Recorrente
        {
          daysOfWeek: { has: dayOfWeek },
          startTime: { lte: hhmm },
          endTime: { gte: hhmm },
          startDate: null,
        },
        // One-off / sazonal
        {
          startDate: { lte: now },
          endDate: { gte: now },
        },
      ],
    },
    include: { playlist: { include: { items: { include: { media: true } } } } },
    orderBy: { priority: 'desc' },
  });

  if (candidates.length > 0) return candidates[0].playlist;

  // Fallback: default playlist
  const config = await prisma.globalConfig.findUnique({ where: { id: 'singleton' } });
  if (config?.defaultPlaylistId) {
    return prisma.playlist.findUnique({
      where: { id: config.defaultPlaylistId },
      include: { items: { include: { media: true } } },
    });
  }

  return null;
}
```

## Migrations futuras

Candidatas conforme features entram:
- `add_tags_to_media` — tags/categorias
- `add_media_last_accessed_at` — suportar limpeza automática por inatividade (30-60 dias)
- `add_banners` — banners dinâmicos (P2)
- `add_device_groups` — agrupamento multi-device (P3)
- `add_analytics_events` — eventos pra chart de "mais tocadas"
