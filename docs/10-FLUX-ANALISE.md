# 10 — Análise do Flux Digital [INCOMPLETO]

**Referência ativa**: `app.fluxdigital.com`, R$35/mês, usado hoje pela Aquaflora.

Este doc registra observações do sistema em uso pra:
1. Garantir paridade no AquaTV
2. Identificar lacunas a preencher
3. Copiar UX que funciona

---

## Observações confirmadas (Pedro)

### Upload
- Funciona, mas **demora** — sensação de lentidão no upload
- Tamanho máximo: **não sabido** (não foi testado ao limite)
- Formatos aceitos: aparentemente MP4 (todo conteúdo enviado)
- Gera thumbnail: **não confirmado** (possivelmente sim)
- **Nossa vantagem**: `ffmpeg.wasm` processa no browser, upload é só o arquivo final, progress em tempo real

### Playlist
- Transições: **nenhuma** — acaba um vídeo, começa o próximo
- Som: **mutado** por padrão
- Tempo por mídia: provavelmente duração nativa do vídeo
- Mixa vídeo + imagem: **não testado** (só reels eram enviados)
- **Nossa vantagem**: suportar imagens com tempo configurável + banners dinâmicos

### Push-to-device
- Ao clicar "enviar": dashboard mostra "upload iniciou"
- Latência até aparecer na TV: **confirmado funcional**, tempo não medido
- Indicador de progresso: **sim** mostrava que começou (não confirmado se mostra %)
- **Nossa vantagem**: progress real com bytes transferidos, SSE confirmation instant

### Status do device
- Dashboard mostra **online/offline** (dot colorido ou similar)
- **Sem** métricas adicionais (uptime, espaço, mídia atual, etc)
- **Nossa grande vantagem**: métricas ricas — Diego saberia em tempo real o que tá rolando

### Agendamento
- **Flux NÃO tem** agendamento por dia/hora
- Só roda playlist linear, uma após outra, em loop
- **Este é o killer feature número 1 do AquaTV**

### Multi-device
- **Nunca testado** pelo Diego/Pedro
- Provavelmente tem em planos mais caros, ou não tem
- **Nossa vantagem**: suportar multi-device desde o começo (implementação P3, modelo já prevê)

### Offline fallback
- **Nunca testado** o que acontece se a internet da loja cair
- Provavelmente continua tocando do cache (padrão de mercado)
- **Nosso comportamento explícito**: cache indefinido, heartbeat reconecta ao voltar, sync atualiza diferenças

### Auto-update do app Flux
- **Não há mecanismo automático conhecido**
- Pedro historicamente precisou: subir escada, plugar pendrive, instalar APK manualmente
- Essa é uma **grande dor pessoal** dele
- **Nossa grande vantagem número 2**: app se atualiza sozinho, Pedro nunca mais sobe escada

---

## Comportamentos a copiar

✅ **Push imediato ao clicar "enviar"** — feedback visual rápido melhora percepção de velocidade. Implementar com SSE event antes mesmo de começar o sync real.

✅ **Dashboard foca em lista de mídias + lista de playlists** — fluxo linear, sem menus profundos.

✅ **Interface simples, drag-drop pra ordenar** — Diego não é técnico, UX tem que ser óbvia.

✅ **Dot colorido de status** — reconhecimento instantâneo.

---

## Comportamentos a melhorar

❌ **Upload lento** — usar upload multipart otimizado + processamento client-side antecipa validação.

❌ **Sem thumbnails automáticos** — confirmar e fazer automático via ffmpeg.wasm.

❌ **Só online/offline** — dashboard do AquaTV mostra card rico por device.

❌ **Sem agendamento** — feature central do AquaTV.

❌ **Sem auto-update** — feature central do AquaTV.

❌ **Sem análise do que está tocando ou histórico** — Diego não sabe quais promos performam.

---

## Questões abertas que valem testar no Flux antes de cancelar

Enquanto o Flux ainda tá rodando, vale observar:

1. **Qual é o delay real entre "enviar" e aparecer na TV?** (medir com cronômetro uma vez)
2. **Qual o tamanho máximo aceito no upload?** (tentar arquivo de 200MB, 500MB, 1GB)
3. **Como ele se comporta com internet lenta/instável?** (desligar Wi-Fi da TV por 30s)
4. **O que mostra no dashboard quando TV offline > 1h?**
5. **Se apagar uma mídia que tá em playlist, o que acontece?**
6. **Dá pra definir tempo custom de exibição de imagem, ou é fixo?**
7. **Existe log/histórico dentro do Flux?**
8. **Como ele lida com arquivo corrompido?**

**Ação**: Pedro anota respostas nessa doc nas próximas 2-3 semanas usando o Flux, antes do MVP do AquaTV estar pronto. Cada observação vira validação ou gap identificado.

---

## Resumo estratégico

Flux = **base suficiente pra paridade, referência pra UX**.

AquaTV oferece ao chefe:
| | Flux | AquaTV |
|---|---|---|
| Custo | R$35/mês | R$0 |
| Agendamento | ❌ | ✅ |
| Auto-update | ❌ | ✅ |
| Métricas ricas | ❌ | ✅ |
| Independência | ❌ | ✅ |
| Customização | limitada | total |

A conversa com o chefe é simples: "mesma coisa + 3 features + zero mensalidade + você tem controle total".
