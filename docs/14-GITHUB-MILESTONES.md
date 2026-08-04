# 14 — GitHub: milestones, issues e critério de entrega

Este documento reflete o estado do projeto em **4 de agosto de 2026**. O GitHub registra o que falta; testes automatizados provam o software, enquanto o aceite na STV-3000 Plus prova o produto no equipamento real.

O roteiro operacional detalhado para o Luna está em [Plano de APK e validação na STV-3000 Plus](15-PLANO-APK-ANDROID-TV.md).

## Visão geral atual

| Milestone                                                                                    | Prazo      | Estado    | Escopo                                                                                 |
| -------------------------------------------------------------------------------------------- | ---------- | --------- | -------------------------------------------------------------------------------------- |
| [MVP local — código funcional](https://github.com/pedrobragabes/AquaFloraTV/milestone/1)     | 31/07/2026 | Concluída | Dashboard, API, player nativo e operação Windows implementados e validados em software |
| [APK e validação na STV-3000 Plus](https://github.com/pedrobragabes/AquaFloraTV/milestone/2) | 05/08/2026 | Aberta    | APK assinado, rotação calibrada e aceite inicial no hardware                           |
| [Go-live e estabilização local](https://github.com/pedrobragabes/AquaFloraTV/milestone/3)    | 08/08/2026 | Aberta    | Soak de 48 horas, backup externo e identidade AquaFlora Agroshop                       |
| [Backlog técnico pós-MVP](https://github.com/pedrobragabes/AquaFloraTV/milestone/4)          | Sem prazo  | Aberta    | Manutenção que não bloqueia o uso na loja                                              |

As datas são metas operacionais. Uma milestone não deve ser fechada pela data: os critérios de aceite e as evidências têm prioridade.

## Milestone 1 — MVP local: código funcional

Concluída com as issues #4 a #8 fechadas. O estado entregue inclui:

- dashboard responsivo com login, conteúdos, playlists, programação e TVs;
- API Express protegida, Prisma/SQLite e uploads validados;
- player Expo/React Native TV com cadastro, cache transacional, fallback offline, polling, heartbeat e watchdog;
- operação Windows com preparação, start/stop, diagnóstico, firewall, backup e smoke;
- player web, WebView legado, releases pelo dashboard, auto-update de APK, SSE e force-sync removidos por decisão de produto.

Evidências já registradas:

```text
pnpm peers check        aprovado
pnpm lint               aprovado
pnpm typecheck          aprovado
  pnpm test               19 testes aprovados (4 API + 15 player)
pnpm build              aprovado
Expo Android export     bundle Hermes gerado
Smoke Windows           16 verificações aprovadas
SQLite                  integrity_check e foreign keys válidas
```

## Milestone 2 — APK e validação na STV-3000 Plus

Esta é a milestone ativa imediata. As issues são sequenciais.

### [#9 — Configurar o PC da loja e a rede local para produção](https://github.com/pedrobragabes/AquaFloraTV/issues/9)

Estado verificado:

- o servidor alvo `192.168.0.114:7741` respondeu `status: ok` nesta máquina;
- a interface ativa desta máquina continua em `192.168.0.36`, que não deve ser embutido no APK;
- rede Ethernet está como Privada;
- firewall permite 7740/7741 somente no perfil Private e na sub-rede local;
- tarefa de backup existe;
- ainda faltam reserva do IP, prova a partir da box, tarefa de inicialização, reboot completo e backup atual.

Pode fechar quando o IP estiver reservado, `/health` responder a partir de outro aparelho, serviços voltarem após reboot e houver backup atual.

### [#10 — Preparar Android SDK e gerar APK release assinado](https://github.com/pedrobragabes/AquaFloraTV/issues/10)

Estado verificado:

- Android Studio instalado;
- JDK 17 Microsoft instalado e validado no Gradle 8.13;
- Platform 36, Build Tools 36.0.0, Platform-Tools e Command-line Tools instalados;
- `local.properties` criado localmente e ignorado pelo Git;
- Java 25 do Android Studio também falhou com o Gradle atual;
- lint, typecheck e 15 testes do player aprovados após a rotação configurável;
- APK `1.0.0`, `versionCode 2`, gerado com a keystore `aquatv-release-v2.jks` fora do repositório;
- certificado release verificado com digest `f0de69f62bb4a348b069275e39cd26930229e5423839f65b99a3a4d387be7005`;
- o APK usa o pacote `com.aquatv.player` e embute `192.168.0.114` como URL inicial;
- áudio começa mudo e a orientação é persistida localmente;
- ícone, splash e banner AquaFlora Agroshop foram aplicados;
- o APK assinado anterior permanece como evidência de continuidade da chave;
- após esta rodada de rotação e marca, o Gradle nativo foi recompilado com sucesso,
  mas a sessão não tinha as variáveis de assinatura e gerou somente o artefato
  unsigned; o hash do APK final assinado ainda deve ser registrado.

Pode fechar quando houver APK release assinado com chave própria, assinatura verificada, SHA-256 registrado e abertura sem Metro.

### [#11 — Validar APK e integração na STV-3000 Plus](https://github.com/pedrobragabes/AquaFloraTV/issues/11)

Depende das issues #9 e #10. Pedro reportou instalação e reprodução inicial bem-sucedidas. A validação completa ainda deve cobrir atualização por cima, controle remoto, cadastro automático, heartbeat, formatos reais, os dois lados de portrait, pausa/retomada, cache offline, reboot e HOME/launcher.

Pode fechar quando a box real sincronizar e reproduzir em loop, continuar offline e recuperar sozinha após retorno da rede e reinicialização.

## Milestone 3 — Go-live e estabilização local

### [#12 — Executar soak test de 48 horas e validar recuperação](https://github.com/pedrobragabes/AquaFloraTV/issues/12)

Manter a STV-3000 Plus tocando por 48 horas depois do aceite inicial. Registrar crashes, telas pretas, reinícios, aquecimento, armazenamento, perda/retorno da rede e reinício do PC/box.

### [#13 — Configurar backup fora do PC da loja e testar restauração](https://github.com/pedrobragabes/AquaFloraTV/issues/13)

Criar cópia automática fora do PC e comprovar uma restauração completa de banco e mídia em pasta de teste.

### [#14 — Aplicar identidade visual final no app da TV](https://github.com/pedrobragabes/AquaFloraTV/issues/14)

Aplicar e validar logo, nome AquaFlora Agroshop, ícone, banner Android TV, splash e foco visual das telas administrativas em 1080p e à distância real de uso. A rotação configurável pertence ao aceite da issue #11.

## Milestone 4 — Backlog técnico pós-MVP

### [#15 — Acompanhar correção do alerta residual brace-expansion](https://github.com/pedrobragabes/AquaFloraTV/issues/15)

O alerta está no toolchain de build, não no runtime do servidor ou do APK. A issue não bloqueia instalação, teste físico nem go-live; deve ser retomada quando Expo/React Native aceitarem a cadeia corrigida sem override incompatível.

## Dependências e ordem de fechamento

```text
#9 Rede pronta
    |
    v
#10 APK assinado
    |
    v
#11 Aceite inicial na box
    |
    v
#12 Soak de 48 horas
    |
    v
Go-live comprovado

#13 Backup externo e #14 identidade visual podem avançar em paralelo após #11.
#15 permanece fora do caminho crítico.
```

## Labels usadas

| Label               | Uso                                     |
| ------------------- | --------------------------------------- |
| `priority:critical` | bloqueia a milestone ativa ou o go-live |
| `area:dashboard`    | interface administrativa                |
| `area:api`          | API, Prisma, banco e contratos          |
| `area:player`       | app e comportamento na TV               |
| `area:windows`      | instalação e runtime do PC              |
| `operations`        | rede, backup, observabilidade e aceite  |
| `enhancement`       | melhoria sem falha regressiva           |

## Regra de evidência para o Luna

Ao concluir uma tarefa, comentar na issue:

- o que foi executado;
- comandos e resultado resumido;
- equipamento e versão usados;
- caminho privado do artefato, sem anexar segredo;
- SHA-256 do APK quando aplicável;
- foto ou vídeo para comportamento visual/físico;
- falhas encontradas e o que continua pendente.

Não marcar teste físico como concluído com base em emulador, build verde ou inspeção de código. Uma issue parcialmente pronta continua aberta.

## Previsão operacional

- **APK de teste:** após concluir SDK/JDK 17, assinatura e build da issue #10.
- **Aceite inicial na box:** após a issue #11, com a STV-3000 Plus ao lado do PC.
- **Estabilidade comprovada:** 48 horas após o início do soak da issue #12.
- **Go-live completo:** issues #9 a #14 fechadas ou pendências não críticas explicitamente replanejadas.

Se o hardware revelar incompatibilidade de codec, foco do controle, launcher ou rotação, a issue #11 permanece aberta até a correção e um novo teste no equipamento.
