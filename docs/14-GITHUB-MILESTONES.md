# 14 — GitHub: milestones, issues e critério de entrega

Este documento transforma o estado técnico do AquaTV em um plano verificável. O GitHub é a fonte de verdade para **o que falta**, enquanto os testes e o aceite no equipamento real determinam **o que pode ser fechado**.

## Visão geral

| Milestone                                                                                | Prazo      | Estado    | Escopo                                         |
| ---------------------------------------------------------------------------------------- | ---------- | --------- | ---------------------------------------------- |
| [MVP local — código funcional](https://github.com/pedrobragabes/AquaFloraTV/milestone/1) | 31/07/2026 | Concluída | Reescrita, segurança e validação automatizada  |
| [Go-live na loja — 31/07/2026](https://github.com/pedrobragabes/AquaFloraTV/milestone/2) | 31/07/2026 | Aberta    | PC, rede, APK assinado e aceite físico         |
| [Estabilização pós-go-live](https://github.com/pedrobragabes/AquaFloraTV/milestone/3)    | 03/08/2026 | Aberta    | Soak, recuperação, backup externo e acabamento |

O candidato pode entrar em operação no mesmo dia em que as três issues críticas do go-live forem concluídas. A confirmação de estabilidade exige mais 48 horas de reprodução contínua.

## Milestone 1 — MVP local: código funcional

Esta milestone foi fechada porque todas as entregas têm evidência automatizada ou inspeção técnica reproduzível.

### [#4 — Definir e simplificar a arquitetura do MVP local](https://github.com/pedrobragabes/AquaFloraTV/issues/4)

- Dashboard e API no PC da loja.
- SQLite e storage em disco local.
- Player nativo separado do dashboard.
- Remoção do player web, do fluxo de releases no painel e de integrações sem utilidade no MVP.
- Monorepo compilando como uma unidade.

### [#5 — Reescrever o dashboard operacional](https://github.com/pedrobragabes/AquaFloraTV/issues/5)

- Navegação reduzida a Início, Conteúdos, Programação e TV.
- Login local seguro.
- Upload e paginação de mídias.
- Editor de playlist e pausa global.
- Programação e gestão simplificada dos dispositivos.
- Interface responsiva para operação na loja.

### [#6 — Endurecer a API, uploads e contratos do player](https://github.com/pedrobragabes/AquaFloraTV/issues/6)

- Autorização administrativa nas rotas sensíveis.
- Validação de tipo, extensão e assinatura dos uploads.
- Nomes internos imprevisíveis e limite de tamanho.
- Correção de agendas que atravessam a madrugada.
- Respostas de dispositivo sem vazamento de token.
- Logs estruturados e configuração de produção fail-closed.

### [#7 — Reescrever o núcleo do player Android TV](https://github.com/pedrobragabes/AquaFloraTV/issues/7)

- Cache transacional com checksum.
- Manifesto anterior como fallback e reprodução offline.
- Polling com backoff e heartbeat serializado.
- Watchdog de progresso real do vídeo.
- Tela de configuração, menu administrativo oculto e integração Android TV.

### [#8 — Automatizar instalação, supervisão, backup e smoke no Windows](https://github.com/pedrobragabes/AquaFloraTV/issues/8)

- Instalação guiada e geração de segredos.
- Migração protegida por backup.
- Supervisor com start e stop seguros.
- Tarefas de inicialização e backup.
- Firewall limitado à rede privada.
- Diagnóstico de rede e smoke test isolado.

### Evidências para a milestone

```text
pnpm peers check        sem conflitos de peer dependencies
pnpm lint               aprovado
pnpm typecheck          aprovado
pnpm test               14 testes aprovados
pnpm build              aprovado
Expo Android export     624 módulos, bundle Hermes gerado
Smoke Windows           16 verificações aprovadas
SQLite                  integrity_check e foreign keys válidas
```

## Milestone 2 — Go-live na loja

As issues abaixo são sequenciais. Não devem ser fechadas apenas porque um script executou: cada uma possui um resultado observável.

### 1. [#9 — Configurar o PC e a rede local](https://github.com/pedrobragabes/AquaFloraTV/issues/9)

Responsabilidade principal: operação Windows.

Ordem recomendada:

1. Executar `instalar-dependencias.bat` e cadastrar a senha definitiva.
2. Reservar o IP do PC no roteador ou definir um IP estático.
3. Atualizar `API_URL` do player para `http://IP-DO-PC:7741/api`.
4. Mudar o perfil do Windows de Público para Privado.
5. Executar `liberar-firewall.bat` como administrador.
6. Registrar inicialização e backup automáticos.
7. Reiniciar o PC e testar dashboard e API por outro aparelho da rede.

Pode fechar quando:

- dashboard e `/health` abrem pela LAN;
- os serviços voltam sozinhos após reboot;
- as portas não são liberadas para uma rede pública;
- um backup manual válido foi criado.

### 2. [#10 — Gerar APK release assinado](https://github.com/pedrobragabes/AquaFloraTV/issues/10)

Responsabilidade principal: build Android.

Ordem recomendada:

1. Instalar Android Studio/SDK e configurar `ANDROID_HOME` ou `local.properties`.
2. Criar um keystore exclusivo para o AquaTV.
3. Guardar o keystore e as senhas fora do repositório.
4. Configurar as quatro variáveis `AQUATV_RELEASE_*`.
5. Confirmar a URL da API antes de gerar o bundle.
6. Executar `apps/player/android/gradlew.bat assembleRelease`.
7. Calcular SHA-256 do APK e guardar o artefato em local seguro.

Pode fechar quando:

- o APK está assinado com a chave de release, não com a chave debug;
- instala em Android 11;
- abre sem depender do Metro ou do PC de desenvolvimento.

### 3. [#11 — Validar na STV-3000 Plus e fazer o go-live](https://github.com/pedrobragabes/AquaFloraTV/issues/11)

Responsabilidade principal: aceite no hardware.

Roteiro mínimo:

1. Instalar o APK e registrar a TV.
2. Navegar pela configuração usando somente o controle remoto.
3. Reproduzir arquivos reais da loja em MP4 H.264/AAC, JPG, PNG e WebP.
4. Testar conteúdo landscape e portrait.
5. Pausar e retomar pelo dashboard.
6. Desligar a rede e confirmar que o cache continua tocando.
7. Reiniciar PC e TV box e observar a recuperação.
8. Confirmar o comportamento de HOME/launcher/kiosk suportado pelo aparelho.
9. Obter o aceite visual de Diego.

Pode fechar quando a TV inicia, sincroniza, toca em loop, funciona offline e se recupera sem intervenção manual.

## Milestone 3 — Estabilização pós-go-live

### [#12 — Soak test de 48 horas](https://github.com/pedrobragabes/AquaFloraTV/issues/12)

Manter reprodução contínua e registrar tela preta, crash, reinício, aquecimento, crescimento de cache e falha de sincronização. Durante o período, simular perda de rede e reinício dos dois equipamentos.

### [#13 — Backup fora do PC e restauração](https://github.com/pedrobragabes/AquaFloraTV/issues/13)

Copiar os backups para outro equipamento, NAS ou mídia removível. A issue só termina depois de restaurar banco e storage em uma pasta de teste e iniciar o sistema restaurado.

### [#14 — Identidade visual final](https://github.com/pedrobragabes/AquaFloraTV/issues/14)

Substituir os recursos genéricos por ícone, banner Android TV e splash da Aquaflora. Validar em 1080p e à distância real de uso, não somente no monitor do desenvolvimento.

### [#15 — Alerta residual do toolchain Expo](https://github.com/pedrobragabes/AquaFloraTV/issues/15)

O alerta de `brace-expansion` está numa dependência de build. Não se deve forçar uma versão incompatível que quebre o `minimatch` legado. Atualizar quando Expo/React Native aceitarem a cadeia corrigida e repetir toda a validação.

## Labels usadas

| Label               | Uso                                      |
| ------------------- | ---------------------------------------- |
| `priority:critical` | bloqueia o go-live                       |
| `area:dashboard`    | interface administrativa                 |
| `area:api`          | API, Prisma, banco e contratos           |
| `area:player`       | app e comportamento na TV                |
| `area:windows`      | instalação e runtime do PC               |
| `operations`        | rede, backup, observabilidade e aceite   |
| `enhancement`       | melhoria de produto sem falha regressiva |

## Como manter o GitHub atualizado

### Ao iniciar uma issue

1. Confirmar pré-requisitos e dependências.
2. Marcar somente os itens realmente executados.
3. Registrar decisões relevantes em comentário curto.
4. Anexar logs, hash ou foto quando o aceite depender de evidência física.

### Ao fechar uma issue

Antes de fechar, responder no próprio GitHub:

- o que foi feito;
- como foi validado;
- qual equipamento e versão foram usados;
- onde está o artefato, sem publicar senhas ou keystores;
- quais limitações permaneceram.

Uma issue parcialmente pronta continua aberta. Se o restante for independente, criar uma nova issue, vinculá-la e explicar a separação.

### Ao fechar uma milestone

Uma milestone fecha quando:

- não há issue crítica aberta;
- todos os critérios de aceite foram comprovados;
- pendências adiadas foram movidas explicitamente para outra milestone;
- a documentação reflete o comportamento que está rodando.

## Previsão de conclusão

- **Código do MVP:** concluído.
- **Candidato rodando na loja:** possível no mesmo dia, após concluir #9, #10 e #11 com o hardware disponível.
- **Estabilidade comprovada:** 48 horas depois do go-live.
- **Acabamento e recuperação completa:** meta de 03/08/2026, condicionada aos recursos visuais e ao destino de backup externo.

Essas datas são metas operacionais, não substituem os critérios de aceite. Se o hardware revelar incompatibilidade de codec, launcher ou rotação, a issue #11 permanece aberta até a correção e um novo teste.
