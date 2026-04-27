# Analise interna da plataforma atual [INCOMPLETO]

**Referencia ativa**: plataforma de digital signage usada hoje na loja, com custo mensal aproximado de R$35.

Este doc registra observacoes do sistema em uso pra:
1. Garantir paridade no AquaTV
2. Identificar lacunas a preencher
3. Copiar UX que funciona

---

## Observacoes confirmadas (Pedro)

### Upload
- Funciona, mas **demora** e passa sensacao de lentidao
- Tamanho maximo: **nao sabido** (nao foi testado ao limite)
- Formatos aceitos: aparentemente MP4 (todo conteudo enviado)
- Gera thumbnail: **nao confirmado** (possivelmente sim)
- **Nossa vantagem**: `ffmpeg.wasm` processa no browser, upload e so o arquivo final, progress em tempo real

### Playlist
- Transicoes: **nenhuma** (acaba um video, comeca o proximo)
- Som: **mutado** por padrao
- Tempo por midia: provavelmente duracao nativa do video
- Mixa video + imagem: **nao testado** (so reels foram enviados)
- **Nossa vantagem**: suportar imagens com tempo configuravel + banners dinamicos

### Push-to-device
- Ao clicar "enviar": dashboard mostra "upload iniciou"
- Latencia ate aparecer na TV: **confirmado funcional**, tempo nao medido
- Indicador de progresso: **sim** mostrava que comecou (nao confirmado se mostra %)
- **Nossa vantagem**: progress real com bytes transferidos, SSE confirmation instant

### Status do device
- Dashboard mostra **online/offline** (dot colorido ou similar)
- **Sem** metricas adicionais (uptime, espaco, midia atual etc.)
- **Nossa grande vantagem**: metricas ricas, com visibilidade em tempo real

### Agendamento
- **A plataforma atual NAO tem** agendamento por dia/hora
- So roda playlist linear, uma apos outra, em loop
- **Este e o killer feature numero 1 do AquaTV**

### Multi-device
- **Nunca testado** pelo Diego/Pedro
- Provavelmente existe em plano diferente, ou nao existe
- **Nossa vantagem**: suportar multi-device desde o comeco (implementacao P3, modelo ja preve)

### Offline fallback
- **Nunca testado** o que acontece se a internet da loja cair
- Provavelmente continua tocando do cache (padrao de mercado)
- **Nosso comportamento explicito**: cache indefinido, heartbeat reconecta ao voltar, sync atualiza diferencas

### Auto-update do app atual
- **Nao ha mecanismo automatico conhecido**
- Pedro historicamente precisou subir escada, plugar pendrive e instalar APK manualmente
- Essa e uma **grande dor pessoal**
- **Nossa grande vantagem numero 2**: app se atualiza sozinho

---

## Comportamentos a copiar

- **Push imediato ao clicar "enviar"** para reforcar feedback visual rapido
- **Dashboard focado em lista de midias + lista de playlists**
- **Interface simples com drag-and-drop** para ordenacao
- **Dot colorido de status** para reconhecimento instantaneo

---

## Comportamentos a melhorar

- **Upload lento**: usar upload multipart otimizado + processamento client-side
- **Sem thumbnails automaticos**: confirmar e gerar automaticamente via ffmpeg.wasm
- **So online/offline**: dashboard do AquaTV deve exibir card rico por device
- **Sem agendamento**: feature central do AquaTV
- **Sem auto-update**: feature central do AquaTV
- **Sem analise do que esta tocando ou historico**: baixa visibilidade operacional

---

## Questoes abertas que valem testar na plataforma atual antes da migracao

Enquanto a plataforma atual ainda ta rodando, vale observar:

1. **Qual e o delay real entre "enviar" e aparecer na TV?**
2. **Qual o tamanho maximo aceito no upload?**
3. **Como se comporta com internet lenta/instavel?**
4. **O que mostra no dashboard quando a TV fica offline por mais de 1h?**
5. **Se apagar uma midia que esta em playlist, o que acontece?**
6. **Da para definir tempo custom de exibicao de imagem, ou e fixo?**
7. **Existe log/historico dentro da plataforma atual?**
8. **Como lida com arquivo corrompido?**

**Acao**: Pedro anota respostas nessa doc nas proximas 2-3 semanas usando a plataforma atual, antes do MVP do AquaTV estar pronto. Cada observacao vira validacao ou gap identificado.

---

## Resumo estrategico

Plataforma atual = **base suficiente para paridade e referencia de UX**.

AquaTV oferece ao chefe:
| | Plataforma atual | AquaTV |
|---|---|---|
| Custo | R$35/mes | R$0 |
| Agendamento | Nao | Sim |
| Auto-update | Nao | Sim |
| Metricas ricas | Nao | Sim |
| Independencia | Nao | Sim |
| Customizacao | Limitada | Total |

A conversa com o chefe e simples: "mesma base + diferenciais operacionais + zero mensalidade recorrente + controle total".
