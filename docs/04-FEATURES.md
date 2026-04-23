# 04 — Features

## Priorização

- **P0** — MVP obrigatório (paridade com Flux Digital)
- **P1** — Diferenciais chave (justificam o custo de construir)
- **P2** — Polimento e qualidade
- **P3** — Futuro (não entra no MVP)

## P0 — Paridade com Flux Digital

### Upload de mídia
- [ ] Drag-and-drop de arquivos no dashboard
- [ ] Formatos aceitos: MP4 (H.264), JPG, PNG
- [ ] Limite de tamanho por arquivo (300MB)
- [ ] Validação client-side via `ffmpeg.wasm` (codec + resolução)
- [ ] Geração de thumbnail automática (frame 1s pra vídeos)
- [ ] Barra de progresso durante upload
- [ ] Preview inline antes de adicionar à playlist

### Gestão de playlists
- [ ] Criar playlist com nome
- [ ] Adicionar mídias à playlist
- [ ] Reordenar via drag-and-drop (dnd-kit)
- [ ] Tempo de exibição por imagem (default 10s, configurável)
- [ ] Remover item da playlist
- [ ] Deletar playlist inteira
- [ ] Duplicar playlist

### Player Android
- [ ] App roda na TV Box ao boot (auto-start)
- [ ] Baixa a playlist ativa via API
- [ ] Cache local só da playlist ativa + fallback
- [ ] Validação MD5 no download
- [ ] Playback loop contínuo
- [ ] Orientação portrait travada
- [ ] Sem som (playback muted)
- [ ] Transição instantânea entre mídias (sem fade por ora)
- [ ] Continua tocando do cache se internet cair
- [ ] Limpeza automática de arquivos órfãos no cache local

### Status básico
- [ ] Dashboard mostra device online/offline
- [ ] Heartbeat do device a cada 30s
- [ ] Indicador visual na lista de devices

### Sincronização
- [ ] Device detecta nova versão da playlist em ≤ 5 min
- [ ] Download incremental (só mídias novas)
- [ ] Botão "Sincronizar agora" no dashboard → push SSE → sync imediato

### Auth
- [ ] Login do Diego via Google OAuth
- [ ] Allowlist de emails (Diego + Pedro)
- [ ] Session persistente no browser

## P1 — Diferenciais chave

### 🌟 Agendamento contextual
**Motivação**: Flux só tem playlist linear. Diego quer "quarta de 9-18h roda promo ração" sem precisar trocar manualmente toda semana.

- [ ] Criar `Schedule` associando playlist a janela temporal
- [ ] Grade visual semanal no dashboard (estilo Google Calendar)
- [ ] Arrasta playlist pros slots (dnd-kit)
- [ ] Regra de prioridade quando slots sobrepõem (maior prioridade vence)
- [ ] Agendamento único (one-off, ex: "Black Friday")
- [ ] Agendamento recorrente (ex: "toda quarta 9-18h")
- [ ] Preview: "o que estaria tocando agora?" / "o que vai tocar às 15h?"
- [ ] Default playlist ("fallback") quando nenhum schedule aplicável
- [ ] API avalia schedule server-side em `/api/devices/:id/current-playlist`

### 🌟 Auto-update da APK
**Motivação**: Pedro sobe escada hoje com pendrive toda vez que precisa atualizar o Flux. Chega.

- [ ] Tabela `AppRelease` no DB (version, url, md5, mandatory, notes)
- [ ] Endpoint `/api/app/latest` retorna último release
- [ ] Dashboard: página "Releases" pra subir nova APK
- [ ] App checa no boot (+ a cada 24h): se versão nova, baixa
- [ ] Valida MD5 após download
- [ ] Instala via `REQUEST_INSTALL_PACKAGES` (PackageInstaller API)
- [ ] Restart automático pós-install
- [ ] Rollback manual: Pedro volta uma release anterior como "latest" se nova bugar

### Métricas ricas de device
**Motivação**: Flux só mostra online/offline. Diego/Pedro querem saber o que tá rolando.

- [ ] Heartbeat envia: uptime, freeDisk, currentMediaId, appVersion, lastSyncAt, networkType
- [ ] Dashboard mostra card por device com todas métricas
- [ ] Histórico de uptime (chart últimos 7d)
- [ ] Mídias mais tocadas (top 10)
- [ ] Alertas básicos: "device offline há > 10 min"
- [ ] Alertas de armazenamento em 70% e 85% (server e device)
- [ ] Limpeza automática de mídia sem uso (janela configurável 30-60 dias)
- [ ] Log de eventos (boot, sync, erro, crash)

### Banner "HOJE TEM X"
**Motivação**: Diego quer marketing em tempo real. Sem precisar gravar vídeo novo.

- [ ] Dashboard: cria "banner" (texto + cor + opcional imagem)
- [ ] Agendar banner pra data X (one-off) ou dia Y (recorrente)
- [ ] Device renderiza banner como overlay sobre o vídeo atual por N segundos
- [ ] Ou banner como slide full-screen na playlist (mais simples, Fase 3)

## P2 — Polimento

- [ ] Dark mode no dashboard (padrão atual)
- [ ] Modo claro opcional
- [ ] Mobile-responsive dashboard (Diego pode gerenciar do celular)
- [ ] Notificação email quando device offline > 15 min
- [ ] Log exportável (CSV) de uptime
- [ ] Transição fade entre mídias (tempo configurável)
- [ ] Imagens com zoom/pan lento (efeito Ken Burns) — opcional
- [ ] QR code da loja nas mídias (sobreposto em canto)
- [ ] Player modo "preview" no dashboard (tocar playlist no browser)
- [ ] Busca no histórico de mídias
- [ ] Tags/categorias nas mídias (filtro)

## P3 — Futuro

### Multi-device
- [ ] Suportar múltiplas TV Boxes com playlists diferentes
- [ ] Grupos de devices (ex: "frente de loja", "vitrine")
- [ ] Sync independente por device

### Analytics avançado
- [ ] Integração com contador de pessoas (câmera + IA)
- [ ] Correlação tempo-de-exibição × vendas (se Diego compartilhar ERP)
- [ ] A/B test de playlists
- [ ] Heatmap de atenção (daria precisar de câmera)

### Conteúdo dinâmico
- [ ] Geração de arte por IA (Stable Diffusion + template)
- [ ] Feed RSS de ofertas → renderização automática em slide
- [ ] Cotação do dólar/tempo/clima em overlay (irrelevante pra aquário mas flexível)

### Operação
- [ ] Multi-tenant (atender outras lojas com a mesma infra)
- [ ] Plano de assinatura (vira SaaS próprio — concorrente do Flux)
- [ ] Billing integrado

## Feature matrix: AquaTV vs Flux Digital

| Feature | Flux Digital | AquaTV (MVP) | AquaTV (full) |
|---|---|---|---|
| Upload mídia | ✅ | ✅ | ✅ |
| Playlist | ✅ | ✅ | ✅ |
| Push pra device | ✅ | ✅ | ✅ |
| Online/offline | ✅ | ✅ | ✅ |
| Agendamento por hora/dia | ❌ | ✅ | ✅ |
| Banners dinâmicos | ❌ | ⏳ P2 | ✅ |
| Auto-update APK | ❌ | ✅ | ✅ |
| Métricas detalhadas | ❌ | ✅ | ✅ |
| Histórico de uptime | ❌ | ✅ | ✅ |
| Multi-device | ❓ (não testado) | ⏳ P3 | ✅ |
| Custo | R$35/mês | R$0 | R$0 |
| Independência de vendor | ❌ | ✅ | ✅ |
