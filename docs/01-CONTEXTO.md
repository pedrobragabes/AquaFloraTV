# 01 — Contexto

## O negócio

**Aquaflora Grow Shop** é uma loja física que vende produtos pra aquarismo (peixes, rações, acessórios, plantas, equipamentos). A loja tem uma **TV vertical** posicionada no balcão / vitrine, que roda vídeos de marketing em loop contínuo durante o horário comercial.

A TV tem dois papéis:
1. **Entretenimento passivo** pro cliente enquanto espera atendimento
2. **Marketing direcionado** mostrando promoções, produtos novos, reels institucionais

## Sistema atual (Flux Digital)

Hoje a loja usa o **Flux Digital** (`app.fluxdigital.com`), um SaaS de digital signage:

- **Custo**: R$35/mês
- **Funcionalidade**: upload de mídia, montagem de playlist, push pra dispositivo, status online/offline
- **Limitações observadas**:
  - Sem agendamento por dia/hora — só playlist linear
  - Sem métricas detalhadas do device (só online/offline)
  - Update do app requer pendrive + subir escada manualmente
  - Sem histórico de uptime, sem analytics de mídia
  - Multi-device não testado (pode ter limitação por plano)

O Flux funciona bem pro básico, mas tem teto baixo de customização.

## Quem é quem

### Pedro (desenvolvedor)
- Full-stack TypeScript/React/Node
- Dono da implementação
- Tem Hostinger Business com 50GB (6GB usados por 10 sites existentes — 44GB livres)
- Tem domínios `aquafloragroshop.com.br` e `.com`
- Proxmox em casa como infra pessoal (ficará como plano B)
- Objetivo pessoal: **aprendizado + portfólio**

### Diego (cliente / chefe)
- Dono da Aquaflora Grow Shop
- Faz upload do conteúdo, monta playlists
- Hoje usa Flux Digital
- **Sem pressa** — prefere qualidade sobre velocidade
- Valoriza economia recorrente e independência de vendor

## Motivação pra construir custom

### Econômica
- R$35/mês × 12 = **R$420/ano** de economia direta
- Custo incremental zero (Hostinger já pago, domínio já comprado)

### Estratégica
- **Independência de vendor** — se Flux subir preço / mudar políticas / sumir, loja não fica refém
- **Features sob medida** — agendamento contextual é impossível no Flux; trivial no sistema próprio
- **Escala** — infra suporta adicionar outras TVs em futuras lojas sem custo adicional

### Pedro (aprendizado)
Este projeto é uma **peça de portfólio substantiva**:
- Sistema distribuído real (web + API + mobile nativo + sync)
- Cliente em produção física (não demo)
- Tech stack moderna ponta a ponta
- Decisões de arquitetura documentadas
- Features sofisticadas (agendamento temporal, auto-update OTA)

Vale muito mais no currículo que "mais um CRUD".

## Critérios de sucesso

### Paridade mínima com Flux Digital
- [ ] Diego faz upload de mídia via browser
- [ ] Diego monta playlist com drag-and-drop
- [ ] Diego vê status online/offline do device
- [ ] TV Box baixa e toca em loop automaticamente
- [ ] Sincronização automática de novo conteúdo em ≤ 5 min

### Diferenciais
- [ ] Agendamento por dia da semana e horário
- [ ] Banners temporários ("HOJE TEM X")
- [ ] Agendamento sazonal com semanas/meses de antecedência
- [ ] Device faz auto-update da APK sem intervenção física
- [ ] Dashboard mostra uptime, espaço livre, mídia atual, histórico de sync

### Operacionais
- [ ] Sistema roda estável ≥ 2 semanas antes de desativar o Flux
- [ ] Documentação suficiente pra Diego operar sozinho
- [ ] Runbook de troubleshooting pra Pedro em caso de quebra

## O que NÃO está no escopo (pro MVP)

Deixando explícito pra não escopocrescer:
- Multi-tenant (várias lojas/clientes usando mesma infra)
- Conteúdo gerado por IA / personalização por câmera
- Integração com ERP da loja
- Relatórios financeiros (ROI de campanha)
- Conteúdo interativo (toque na tela)
- Áudio (a TV fica muda por política da loja)

Qualquer um desses vira item de fase futura, não MVP.
