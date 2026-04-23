# 07 — Deploy

## Visão geral

**Dashboard + API** → Hostinger Business via SSH + rsync (GitHub Actions)
**APK** → EAS Build cloud → upload manual pra Hostinger via dashboard
**DB** → MySQL da Hostinger, migrations via Prisma

---

## Hostinger Business — setup inicial

### 1. Criar Node.js app
Painel Hostinger → Avançado → Node.js

- **Node.js version**: 20.x LTS
- **Application root**: `/home/<user>/domains/app.aquafloragroshop.com.br/public_html`
- **Application URL**: `app.aquafloragroshop.com.br`
- **Application startup file**: `api/dist/index.js`
- **Environment variables** (ver seção abaixo)

### 2. Criar MySQL database
Painel → Databases → MySQL

- Database: `aquatv_prod`
- User: `aquatv_user`
- Password: (gerar forte, salvar em 1Password)
- Host: geralmente `localhost` do próprio servidor Hostinger
- Grant all privileges

Connection string:
```
mysql://aquatv_user:<password>@localhost:3306/aquatv_prod
```

### 3. DNS
Painel Hostinger → Domains → `aquafloragroshop.com.br` → DNS

- Adicionar registro A ou CNAME: `app` → IP do servidor (ou CNAME pro apex)
- TTL: 3600s

Propagação: 5-30 min. Testar via `dig app.aquafloragroshop.com.br`.

### 4. SSL
Hostinger auto-provisiona Let's Encrypt. Forçar HTTPS:
- Painel → SSL → Forçar HTTPS

### 5. SSH key pra GitHub Actions
Gerar chave dedicada:
```bash
ssh-keygen -t ed25519 -C "github-actions-aquatv" -f ~/.ssh/aquatv_deploy
```

- Public key → painel Hostinger SSH keys
- Private key → GitHub secret `HOSTINGER_SSH_KEY`

---

## Environment variables

### `apps/api/.env` (produção)

```env
NODE_ENV=production
PORT=3001

DATABASE_URL="mysql://aquatv_user:REDACTED@localhost:3306/aquatv_prod"

JWT_SECRET=REDACTED_64_CHARS
SESSION_SECRET=REDACTED_64_CHARS

STORAGE_PATH=/home/USER/aquatv_storage
MAX_UPLOAD_MB=300
STORAGE_WARN_PCT=70
STORAGE_CRITICAL_PCT=85
MEDIA_RETENTION_DAYS=45

ALLOWED_ORIGINS=https://app.aquafloragroshop.com.br

GOOGLE_CLIENT_ID=REDACTED
GOOGLE_CLIENT_SECRET=REDACTED

ADMIN_EMAILS=diego@loja.com,pedrobraga855@gmail.com
```

### `apps/dashboard/.env.production`

```env
NEXT_PUBLIC_API_URL=https://app.aquafloragroshop.com.br/api
NEXTAUTH_URL=https://app.aquafloragroshop.com.br
NEXTAUTH_SECRET=REDACTED

GOOGLE_CLIENT_ID=REDACTED
GOOGLE_CLIENT_SECRET=REDACTED
```

### `apps/player` (Expo)

Via `app.config.ts`:

```ts
export default {
  expo: {
    extra: {
      apiUrl: process.env.API_URL ?? 'https://app.aquafloragroshop.com.br/api',
    },
  },
};
```

Device token configurado no app depois da primeira instalação (via tela de onboarding).

---

## GitHub Actions — deploy contínuo

### `.github/workflows/deploy-api.yml`

Trigger: push em `main` que toca `apps/api/**` ou `packages/**`.

1. Checkout
2. Setup Node 20
3. `pnpm install`
4. `pnpm --filter api build`
5. `pnpm --filter api prisma migrate deploy`
6. rsync `apps/api/dist` + `node_modules` pra Hostinger via SSH
7. Restart Node app via painel Hostinger API (ou script remoto)

### `.github/workflows/deploy-dashboard.yml`

Trigger: push em `main` que toca `apps/dashboard/**`.

1. Build: `pnpm --filter dashboard build`
2. Export estático se possível, senão Next em modo "standalone"
3. rsync pra Hostinger
4. Restart

### `.github/workflows/build-apk.yml`

Trigger: manual ou push de tag `player-v*`.

1. Checkout
2. Setup Expo CLI + EAS CLI
3. `eas build -p android --profile production --non-interactive`
4. Aguardar build terminar
5. Download APK
6. Calcular MD5
7. Upload APK pra Hostinger via SCP pra `/storage/apks/aquatv-v{version}.apk`
8. POST /api/app/releases com metadata (version, url, md5, notes)

---

## Migrations

### Dev
```bash
pnpm --filter api prisma migrate dev --name add_schedules
```

Cria migration + aplica local + regenera client.

### Prod
CI aplica automaticamente:
```bash
pnpm --filter api prisma migrate deploy
```

**Nunca usar `prisma db push` em produção** — só em dev/prototipagem.

### Rollback
MySQL não tem rollback nativo de DDL. Plano:
1. Backup antes de deploy via `mysqldump`
2. Se deu ruim, restaura do backup
3. Reverter commit da migration no repo

---

## Storage e backup

### Storage layout em prod

```
/home/USER/aquatv_storage/
├── media/           # vídeos e imagens uploaded
├── thumbs/          # thumbnails gerados
└── apks/
    ├── aquatv-v1.0.0.apk
    ├── aquatv-v1.1.0.apk
    └── latest -> aquatv-v1.1.0.apk  (symlink)
```

Não fica em `public_html` pra evitar listagem. API serve via rota `/storage/*` com auth.

### Política de retenção e ocupação

- Upload limitado a **300MB** por arquivo
- Limpeza automática de mídia sem uso com padrão **45 dias** (faixa configurável: 30-60)
- Alertas de ocupação do storage do servidor em **70%** e **85%**
- Player mantém somente cache da playlist ativa + fallback (device com ~16GB)

### Backup

**DB**: cron no Hostinger (ou GitHub Action agendado) faz `mysqldump` diário e envia pro storage (ou S3/R2 gratuito).

**Mídias**: fazer rsync pro Proxmox de casa semanalmente (backup secundário). Ou pro R2 da Cloudflare (free tier 10GB).

**APKs**: subidas ao GitHub Releases automaticamente via workflow.

---

## Monitoramento

Fase 4. Por enquanto:
- Hostinger tem dashboard básico de CPU/RAM/disco
- Logs da API via `pm2 logs` (Hostinger usa pm2 internamente)
- Erros do app Expo: Sentry free tier (500 erros/mês)

---

## Rollback do app Android

Se uma APK nova bugar em prod:

1. Pedro entra no dashboard → `/releases`
2. Marca versão anterior como "latest"
3. Próximo boot do device detecta downgrade (versionCode menor) — **Android não permite downgrade por default**, então:
   - Alternativa: subir APK antiga com versionCode maior (ex: v1.0.5 republicado como v1.0.7)
   - Ou: ir na loja + ADB `adb install -r -d` (o `-d` permite downgrade)

Lição: testar bem antes de marcar "latest". Considera manter uma flag `beta` no schema pra roll-out gradual.

---

## Plano B: Proxmox em casa

Se Hostinger quebrar / inviabilizar algo:

1. Container LXC com Ubuntu 22 no Proxmox
2. Nginx reverse proxy pra domínio
3. DDNS (No-IP free ou Cloudflare Tunnel)
4. Tailscale pro TV Box alcançar o servidor (substitui HTTPS público)
5. MySQL ou Postgres local
6. Mesmo código, variáveis de ambiente diferentes

Documentado aqui, mas objetivo é não precisar. Hostinger é primário.
