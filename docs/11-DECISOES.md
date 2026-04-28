# 11 — ADRs (Architecture Decision Records)

Registro de decisões arquiteturais importantes, com contexto e trade-offs. Formato baseado em Michael Nygard.

---

## ADR-007 - PC local do escritorio + SQLite como primario do MVP

**Data**: 2026-04-27
**Status**: Accepted, supersede parcialmente ADR-001 e ADR-002 para o MVP

### Contexto

Depois da conversa de implementacao, ficou claro que o app vai ficar no PC do escritorio do Diego, que tem hardware suficiente (i9 9900K) e pode rodar o servidor ao ligar/logar no Windows. Para uma loja, baixa concorrencia e uso em rede local, Hostinger + MySQL adiciona custo operacional antes de provar o fluxo.

### Decisao

Rodar o MVP no PC local do escritorio:

- Next.js dashboard na porta `7740`;
- Express API na porta `7741`;
- SQLite em `apps/api/prisma/dev.db`;
- storage local em `storage/`;
- start via PowerShell e Windows Task Scheduler.

Hostinger fica como plano futuro/alternativo, nao como requisito da primeira operacao.

### Consequencias

- Menos infra para configurar agora.
- Sem dependencia de deploy remoto para validar produto na loja.
- Backup vira responsabilidade local: SQLite DB + pasta `storage/`.
- Acesso externo/HTTPS publico fica pendente ate eventual migracao.
- Migracao para MySQL continua possivel, mas vai exigir revisao de schema/migrations.

---

## ADR-001 — Hostinger Business em vez de Proxmox

**Data**: 2026-04-23
**Status**: Accepted

### Contexto

Pedro tem duas opções de hospedagem:

1. **Proxmox em casa** — zero custo marginal, controle total, mas depende da internet/luz da casa do Pedro
2. **Hostinger Business** — já pago (10 sites, 6GB de 50GB usados), SLA profissional, URL pública com certificado

### Decisão

**Hostinger Business como primário. Proxmox como plano B documentado.**

### Consequências

✅ Não depende da casa do Pedro (uptime superior)
✅ URL profissional `app.aquafloragroshop.com.br`
✅ Cert HTTPS automático (Let's Encrypt)
✅ Elimina Tailscale (simplifica muito)
❌ Limitação: Node.js Selector não permite ffmpeg server-side
❌ Limitação: MySQL só (não Postgres)
⚠️ Mitigação ffmpeg: `ffmpeg.wasm` no browser
⚠️ Mitigação BD: Prisma suporta MySQL sem problema

---

## ADR-002 — MySQL em vez de PostgreSQL

**Data**: 2026-04-23
**Status**: Accepted

### Contexto

Hostinger Business vem com MySQL incluído. Postgres exigiria Hostinger VPS (mais caro).

### Decisão

**MySQL como DB primário.**

### Consequências

✅ Zero custo adicional
✅ Prisma suporta nativamente
✅ MySQL 8+ tem JSON columns (resolve array de dias da semana)
❌ Perde features específicas do Postgres (arrays nativos, extensions)
❌ Menos "hipster" no currículo

Pra esse caso de uso (simples, poucas tabelas, baixa concorrência), diferença técnica é desprezível.

---

## ADR-003 — Portrait gerenciado no app (não rotação server-side)

**Data**: 2026-04-23
**Status**: Accepted

### Contexto

TV na loja é vertical. Opções pra fazer o vídeo tocar certo:

1. Pré-rotacionar vídeo no servidor via ffmpeg (antes de estar na playlist)
2. Forçar portrait no app Expo (via `expo-screen-orientation`)
3. Rotacionar o sistema todo via `wm rotation` ADB

### Decisão

**Portrait forçado no app Expo. Fallback ADB `wm rotation` documentado.**

### Consequências

✅ Validação em plataforma anterior prova que funciona — bug de orientação foi resolvido via update do app
✅ Elimina necessidade de ffmpeg server-side (confirma ADR-001)
✅ Diego sobe vídeo "tal qual recebe" (reels do Instagram são nativamente portrait)
⚠️ Risco: overlays do sistema (volume, notificações) podem quebrar layout — aceitável pra signage fechada

---

## ADR-004 — Híbrido poll + SSE em vez de WebSocket puro

**Data**: 2026-04-23
**Status**: Accepted

### Contexto

Como sincronizar device quando há novo conteúdo ou mudança de playlist?

Opções:

1. **Poll puro** (a cada 5 min) — simples, resiliente, mas delay de até 5 min
2. **WebSocket/SSE puro** — push instantâneo, mas falha se conexão cai
3. **Híbrido** — poll baseline + SSE push

### Decisão

**Híbrido: poll a cada 5 min + SSE pra push instantâneo em ações do usuário.**

SSE em vez de WebSocket porque:

- Push é one-way (servidor → device)
- SSE é HTTP padrão, passa por qualquer proxy/CDN
- Reconnect built-in
- Mais simples que `socket.io` pra este caso

### Consequências

✅ Latência baixa quando SSE conectado (força-sync instantâneo)
✅ Poll garante consistência se SSE cair
✅ Sem dependência de lib de WebSocket
⚠️ Dois mecanismos de sync (complexidade leve, aceitável)

---

## ADR-005 — App AquaTV como launcher do device

**Data**: 2026-04-23
**Status**: Proposed (validar na Fase 2)

### Contexto

Auto-start do app no boot tem várias abordagens no Android:

1. `RECEIVE_BOOT_COMPLETED` receiver + launcher padrão
2. App se tornar launcher via HOME intent
3. Watchdog externo nativo

### Decisão

**App como launcher (HOME intent filter + LEANBACK_LAUNCHER).**

### Consequências

✅ Boot direto no AquaTV (sem tela do launcher Aquário V5.5.5)
✅ Se app crashar, OS reinicia automaticamente (grátis)
✅ Botão Home volta pro AquaTV
✅ Watchdog externo fica desnecessário
❌ Precisa do usuário marcar AquaTV como launcher default na 1ª instalação
⚠️ Vendor OTA pode resetar launcher default — mitigação: desativar OTA (ADR-006)

---

## ADR-006 — Desativar OTA do vendor

**Data**: 2026-04-23
**Status**: Operational

### Contexto

STV-3000 Plus tem OTA auto do vendor. OTA pode:

- Resetar "fontes desconhecidas" (impede updates do AquaTV)
- Resetar orientação portrait
- Resetar launcher default
- Instalar bloatware que consome storage
- Mudar behavior de permissões

### Decisão

**Desativar OTA automático nas Configurações → Sobre → Atualização de Software no setup inicial.**

### Consequências

✅ Sistema estável, sem surpresas
❌ Perde patches de segurança — aceitável pro caso de uso (device fechado, sem navegação)
⚠️ Se vendor empurrar OTA mesmo com config off, Pedro vai ter que reconfigurar. Documentar procedimento de recovery.

---

## ADR-007 — Expo bare em vez de managed

**Data**: 2026-04-23
**Status**: Accepted

### Contexto

Expo tem dois workflows:

- **Managed** — zero config nativo, Expo cuida de tudo, mas limitado
- **Bare** — acesso ao `AndroidManifest.xml` e código nativo, mais flexível

### Decisão

**Bare workflow.**

### Consequências

✅ Acesso ao manifest pra LEANBACK_LAUNCHER, HOME intent, `REQUEST_INSTALL_PACKAGES`
✅ Pode adicionar módulo nativo se necessário (ex: PackageInstaller custom)
✅ EAS Build funciona em bare igual managed
❌ Mais complexidade (requer gradle, manifest fluency)
❌ Upgrades de Expo SDK mais dolorosos que managed

Pra esse caso (Android TV, kiosk mode, auto-install APK), managed não cobriria. Bare é necessário.

---

## ADR-008 — `ffmpeg.wasm` no browser em vez de ffmpeg server

**Data**: 2026-04-23
**Status**: Accepted

### Contexto

Precisamos gerar thumbnail + validar codec do vídeo antes do upload. Hostinger Node.js Selector não permite binários arbitrários.

### Decisão

**`ffmpeg.wasm` no browser — processamento client-side antes do upload.**

### Consequências

✅ Sem dependência de ffmpeg no servidor
✅ Validação imediata (UX: erro antes de esperar upload)
✅ Thumbnail gerado local, enviado junto com vídeo
❌ Consome CPU/RAM do browser (pode ser lento em máquinas fracas do Diego)
❌ Arquivo grande (~25MB do wasm) carrega uma vez e cacheia
⚠️ Fallback: se `ffmpeg.wasm` falhar, aceita upload sem thumb + server gera thumb "depois" via Worker externo (fase futura)

---

## ADR-009 — Monorepo pnpm + turborepo

**Data**: 2026-04-23
**Status**: Accepted

### Contexto

3 apps (dashboard, api, player) + 2 packages compartilhados (types, api-client).

Opções:

1. Repos separados + npm packages publicados
2. Monorepo com npm/yarn workspaces
3. Monorepo pnpm + turborepo
4. Nx

### Decisão

**Monorepo pnpm workspaces + turborepo.**

### Consequências

✅ Tipos compartilhados sem publicar npm package
✅ pnpm é mais rápido e usa menos disk que npm/yarn
✅ Turborepo caching acelera CI
✅ Um PR pode tocar dashboard + api + types atomicamente
❌ Pequena curva de aprendizado se Pedro não conhece pnpm workspaces
❌ CI precisa entender monorepo (`pnpm --filter`)

---

## ADR-010 — NextAuth v5 (Auth.js) com Google OAuth

**Data**: 2026-04-23
**Status**: Accepted

### Contexto

Auth pra Diego e Pedro. Precisa ser simples, seguro, e com allowlist de emails.

Opções:

1. JWT customizado (login email+senha)
2. NextAuth/Auth.js v5 com Google
3. Clerk / Supabase Auth (pago ou outro lock-in)

### Decisão

**NextAuth v5 (Auth.js) com Google provider + allowlist `ADMIN_EMAILS`.**

### Consequências

✅ Zero gestão de senha (Google cuida)
✅ Diego já tem Google, experiência familiar
✅ Session via cookie HTTP-only (seguro)
✅ Next.js 15 + Auth.js v5 têm integração canônica
❌ Dependência de Google (se conta Google sumir, perde acesso — aceitável pra esse caso)
❌ Auth.js v5 ainda em beta enquanto escrevo — pode ser estável no momento da implementação

---

## ADR-011 — SemVer por app, sem versionamento global

**Data**: 2026-04-23
**Status**: Accepted

### Contexto

Como versionar o monorepo?

### Decisão

**SemVer individual por app (`dashboard@1.0.0`, `api@1.0.0`, `player@1.0.0`). Sem versão global do monorepo.**

### Consequências

✅ Atualizar só o player não bumpa dashboard
✅ Changelog por app faz sentido
✅ `player` tem `versionCode` (int) e `versionName` (string) conforme Android exige
❌ Coordenação manual quando breaking change afeta múltiplos apps

---

## Template pra futuros ADRs

```markdown
## ADR-NNN — Título curto

**Data**: YYYY-MM-DD
**Status**: Proposed | Accepted | Deprecated | Superseded by ADR-MMM

### Contexto

Qual problema? Quais forças competem?

### Decisão

O que foi escolhido, em uma frase clara.

### Consequências

✅ Positivas
❌ Negativas
⚠️ Mitigações / pontos de atenção
```
