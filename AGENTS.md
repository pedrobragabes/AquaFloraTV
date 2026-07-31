# AquaTV — contexto para agentes Codex

Este arquivo deve refletir o estado real do repositório. Pedro fala português e prefere crítica construtiva, código simples e validações reproduzíveis.

## Produto

Digital signage da **Aquaflora Grow Shop**. O dashboard permite upload de mídia, playlists, programação e gestão das TVs. O player Android TV sincroniza a playlist, mantém cache local e continua reproduzindo durante falhas de rede.

## Arquitetura atual

```text
Diego no navegador
  -> PC Windows da loja
     Dashboard Next.js :7740
     API Express       :7741
     Prisma + SQLite   apps/api/prisma/dev.db
     Mídias            storage/media
  -> STV-3000 Plus
     App Expo/React Native TV em apps/player
```

O PC local com SQLite é o caminho primário do MVP. Hostinger e acesso externo são alternativas futuras, não requisitos do go-live.

## Stack

- Monorepo: pnpm 11.11.0, workspaces e Turborepo.
- Dashboard: Next.js 15, React e TypeScript estrito.
- API: Node.js, Express, Prisma, SQLite e Multer.
- Player: Expo 55, React Native TV e Hermes.
- Operação: Windows PowerShell e Task Scheduler.

## Estado em 2026-07-31

Implementado:

- dashboard responsivo com Início, Conteúdos, Programação e TV;
- autenticação local por cookie assinado e proxy administrativo;
- API protegida, uploads validados e logs estruturados;
- playlists, pausa global e agendamentos, inclusive overnight;
- cadastro, heartbeat e exclusão administrativa de TVs sem vazamento de token;
- player nativo com configuração, cache transacional, fallback offline, backoff e watchdog;
- manifest Android TV com HOME/LEANBACK e suporte a portrait;
- scripts seguros de preparação, start/stop, diagnóstico, firewall, backup e smoke;
- migration `20260730134500_playback_enabled`.

Removido por decisão de produto:

- player web em `/player`;
- gestão de releases/APKs no dashboard;
- app WebView legado em `apps/tv-apk`;
- SSE, force-sync e histórico ruidoso de heartbeats/logs;
- pacote `packages/api-client` e rotas antigas de releases.

Validações já concluídas:

- `pnpm peers check`;
- `pnpm lint`;
- `pnpm typecheck`;
- `pnpm test`: 14 testes;
- `pnpm build`;
- export Android/Hermes;
- smoke Windows: 16 verificações;
- integridade e foreign keys do SQLite;
- backups pré e pós-migração.

## Pendências de go-live

1. Configurar PC, IP reservado, rede Privada, firewall e tarefas automáticas.
2. Instalar Android SDK e gerar um APK assinado com keystore novo.
3. Testar o APK na STV-3000 Plus com controle, codecs, portrait, cache, reboot e launcher.
4. Executar soak de 48 horas.
5. Configurar cópia de backup fora do PC.
6. Aplicar ícone, banner e splash finais.

Fonte de verdade: `docs/14-GITHUB-MILESTONES.md` e as issues do repositório.

## Regras para trabalhar no projeto

- Sempre responder em português, exceto código.
- TypeScript estrito; não introduzir `any`.
- Comentários somente quando explicam lógica não óbvia.
- Justificar dependências novas e considerar o custo offline/local.
- Não reintroduzir player web, auto-update de APK ou exposição pública sem decisão explícita.
- Não versionar `.env`, banco, mídia, logs, backups, APK/AAB ou chaves de release.
- Não usar `prisma db push` no ambiente da loja; usar migrations e backup.
- Não marcar teste físico como concluído sem executar na STV-3000 Plus.
- Não criar arquivos `.md` sem Pedro pedir; atualizar documentação existente é permitido quando a tarefa envolver docs.
