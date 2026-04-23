# 12 — Aprendizado & Portfólio

Este projeto é, intencionalmente, uma peça de portfólio + aprendizado substantivo do Pedro. Esse doc explicita o valor formativo e as skills que o projeto desenvolve.

---

## Por que este projeto vale ouro pra portfólio

Um sistema de digital signage self-hosted em produção real cobre **5 domínios completos de um software engineer sênior**:

1. **Full-stack web** (Next.js + Node + DB)
2. **Mobile nativo** (Expo bare, Android TV)
3. **Infraestrutura** (Hostinger, DNS, CI/CD, deploy)
4. **Sincronização distribuída** (poll + SSE + cache + conflito de schedule)
5. **Product thinking** (identificação de gaps de concorrente, features diferenciadoras)

A maioria de projetos de portfólio cobre 1-2 dos acima. **Esse cobre os 5.**

---

## Skills desenvolvidas

### TypeScript avançado
- Monorepo com tipos compartilhados
- `zod` pra runtime validation
- Prisma types auto-gerados
- Tipos end-to-end via `@aquatv/api-client`

### React / Next.js 15
- App Router
- Server Actions
- Server Components + Client Components híbrido
- SWR pra caching + revalidação
- `ffmpeg.wasm` integração (WebAssembly no browser)

### Node.js / Express
- Middleware pipeline
- Auth multi-strategy (NextAuth + JWT device)
- Multipart upload com Multer
- SSE (Server-Sent Events)
- Rate limiting
- Error handling padronizado

### Databases
- Schema design com relações complexas (Schedule com prioridade + overlap)
- Prisma migration workflow (dev → deploy)
- Índices pra query patterns identificados
- MySQL 8 JSON columns
- Time-series (heartbeats)

### React Native / Expo bare
- Config nativa (AndroidManifest, build.gradle)
- Android TV specifics (Leanback, HOME intent, banner)
- `expo-file-system` pra cache persistente
- `expo-background-fetch` pra sync periódica
- `expo-screen-orientation` (portrait lock)
- Integração com APIs nativas (PackageInstaller via módulo)

### Android development
- Manifest declarations (Leanback feature, screen orientation)
- Permissions (`REQUEST_INSTALL_PACKAGES`, `RECEIVE_BOOT_COMPLETED`)
- Launcher replacement (HOME intent filter)
- Intent filters
- ADB over network

### DevOps / Infra
- DNS configuration (subdomain delegation)
- SSL/TLS (Let's Encrypt auto-renew)
- GitHub Actions (CI + CD)
- Deploy via SSH + rsync
- Environment management (dev/staging/prod)
- EAS Build (cloud build pra Android)

### Design patterns
- Monorepo (pnpm workspaces + turborepo)
- Separation of concerns (dashboard vs api vs player)
- Shared packages (types, api-client)
- ADR (Architecture Decision Records)
- Feature flags básicos (channel STABLE/BETA)

### System design
- Consistência eventual (cache local + sync periódica)
- Idempotência (upload MD5-based deduplication)
- Graceful degradation (offline fallback)
- Observabilidade (heartbeats, logs estruturados)
- Disaster recovery (backup DB, plano B Proxmox)

### Product thinking
- Identificação de gaps do concorrente (Flux Digital)
- Priorização com matriz P0/P1/P2/P3
- Métricas de sucesso explícitas
- Escopo com "NÃO está no escopo" declarado

---

## Conversação de entrevista potencial

Dá pra usar esse projeto em múltiplos tipos de pergunta técnica:

### "Me fala de um projeto desafiador que você fez"
→ "Construí um sistema de digital signage substituindo um SaaS que a loja do meu chefe usava. Três componentes em TypeScript: dashboard Next.js, API Express, app Expo bare pra TV Android. Desafio principal foi sincronização — TV Box pode ficar offline, tem que tocar do cache, detectar mudanças, baixar diferenças atomicamente, sem interromper playback. Resolvi com híbrido poll + SSE push."

### "Como você toma decisões arquiteturais?"
→ "Tenho ADRs em `docs/11-DECISOES.md`. Cada decisão tem contexto, alternativas consideradas e consequências. Exemplo: escolhi Hostinger sobre Proxmox porque...". Mostra consciência sobre trade-offs.

### "Como você lidaria com X problema"
→ Ancora em decisão real do AquaTV. "No AquaTV resolvi parecido — tinha que [problema similar], e a abordagem foi [decisão]".

### "Qual tecnologia nova você aprendeu recentemente?"
→ Muitas pra escolher: `ffmpeg.wasm`, Expo bare, Android TV Leanback, PackageInstaller, SSE, pnpm workspaces, turborepo.

### "Me conta de uma vez que você teve que fazer uma troca técnica difícil"
→ "Estava planejando usar ffmpeg server-side pra gerar thumbnails e validar vídeos, mas descobri que a Hostinger não permite binários arbitrários. Tive três opções: mudar de host, subir VPS separado só pra ffmpeg, ou processar no cliente. Fui com `ffmpeg.wasm` no browser — mais trabalho inicial, mas economiza recursos server-side e dá feedback instantâneo ao usuário. Documentei a decisão em ADR-008."

---

## O que colocar no README do GitHub

Um README forte inclui:

### Screenshots
- Dashboard com agendador visual (highlight feature)
- Device card com métricas ricas
- TV na loja rodando (foto real)

### Arquitetura em diagrama
- ASCII ou Mermaid (render no GitHub)
- Mostra distribuição (browser, Hostinger, TV)

### Stack destacada com ícones
- Badges de tech (shields.io)

### Métricas de produção
- "Rodando há X meses em produção"
- "Uptime 99.X%"
- "Substituiu serviço pago que custava R$420/ano"
- "Economia + 3 features exclusivas não disponíveis no concorrente"

### Link pra docs/
- A documentação em si já é diferencial

### Badges
- CI status
- Deploy status
- License

---

## Metas pessoais com o projeto

Além das skills, Pedro sai com:

- [ ] **Primeiro projeto de digital signage** — domínio específico valioso (varejo, out-of-home media)
- [ ] **Primeira experiência com cliente externo** — lidar com Diego como usuário real
- [ ] **Portfolio piece que rende conversa** — entrevistador tem muito o que perguntar
- [ ] **Base pra futuros projetos** — arquitetura reutilizável pra sistema conectado (IoT, kiosk, edge)
- [ ] **Potencial spin-off** — se o resultado for bom, vira SaaS próprio (concorrente do Flux)

---

## Marcos pra celebrar

- ⭐ **Fase 0 concluída**: monorepo compila, deploy de "hello world" respondeu
- ⭐ **Fase 1 concluída**: primeiro upload de vídeo funciona end-to-end
- ⭐ **Fase 2 concluída**: TV Box toca vídeo vindo da API em prod
- ⭐ **Fase 2.5**: auto-update da APK funciona (NUNCA MAIS SUBIR ESCADA)
- ⭐ **Fase 3 concluída**: Diego consegue operar o sistema sozinho
- ⭐ **Fase 4 concluída**: 2 semanas estável em produção
- 🎉 **Marco principal**: cancelar Flux Digital e comemorar

Cada marco vale um tweet, post no LinkedIn, commit screenshot. **Compartilhar o processo ao longo do caminho é parte do valor do portfólio**, não só o produto final.
