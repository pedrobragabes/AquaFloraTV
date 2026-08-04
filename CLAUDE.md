# AquaTV — contexto para agentes

Este arquivo é um resumo rápido para agentes que abrem o repositório. A fonte operacional principal é `AGENTS.md`, seguida de `README.md`, `docs/14-GITHUB-MILESTONES.md` e `docs/15-PLANO-APK-ANDROID-TV.md`.

## Produto atual

Digital signage local da **AquaFlora Agroshop**. O operador usa o dashboard no navegador; o PC Windows da loja hospeda o dashboard Next.js, a API Express, o SQLite e as mídias; a STV-3000 Plus executa o player Expo/React Native TV.

```text
Navegador
   -> PC Windows da loja
      Dashboard :7740
      API      :7741
      SQLite   apps/api/prisma/dev.db
      storage/media
   -> STV-3000 Plus
      apps/player — Android TV, cache local e reprodução offline
```

O IP atual do servidor de teste é `192.168.0.114`. O endereço deve ser configurável e não deve ser substituído por `localhost` no APK.

## Estado real

- Dashboard responsivo com login, conteúdos, playlists, programação e TVs.
- API protegida com Express, Prisma, SQLite, uploads validados e heartbeat.
- Player nativo com cadastro, cache transacional, polling/backoff, watchdog e fallback offline.
- Som configurável e orientação persistente (`Automática`, `Horizontal`, `Vertical lado A`, `Vertical lado B`) pelo controle remoto.
- Identidade em finalização: **AquaFlora Agroshop**, logo, splash, launcher e banner Android TV.
- APK atual usa pacote `com.aquatv.player`; releases precisam usar a mesma keystore.

## Stack

- pnpm 11.11.0, workspaces e Turborepo;
- Next.js 15, React e TypeScript estrito;
- Express, Prisma, SQLite e Multer;
- Expo 55, React Native TV, Hermes, `expo-video` e `expo-screen-orientation`;
- Windows PowerShell e Task Scheduler.

## Regras de operação

- Responder em português, exceto código.
- Não introduzir `any` em TypeScript.
- Preservar cache, sincronização, heartbeat, watchdog e contrato da API.
- Não reintroduzir player web, WebView legado, SSE, force-sync, auto-update de APK ou exposição pública.
- Não usar `prisma db push`; migrations e backup são obrigatórios para schema.
- Não versionar `.env`, banco, mídias, logs, backups, APK/AAB, senhas ou keystores.
- Não marcar teste físico como concluído sem evidência na STV-3000 Plus.
- Não apagar arquivos rastreados ou worktrees de agentes sem verificar uso e autorização.

## Validação

```powershell
corepack pnpm peers check
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
corepack pnpm format
```

Para o player, use também `corepack pnpm --filter @aquatv/player test`. Para release, JDK 17, SDK Android e `apksigner` são obrigatórios.

## Guias

- README executável: `README.md`;
- milestones e issues: `docs/14-GITHUB-MILESTONES.md`;
- APK e operação da box: `docs/15-PLANO-APK-ANDROID-TV.md`;
- finalização incremental para o Luna: `docs/16-GUIA-LUNA-FINALIZACAO-AQUATV.md`.
