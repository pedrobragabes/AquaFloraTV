# Guia estrito para o Luna — finalização do AquaTV

> Este documento é uma ordem de execução para o Luna. O objetivo é finalizar o produto existente, não reescrevê-lo. Antes de alterar qualquer arquivo, leia `AGENTS.md`, `README.md`, `docs/14-GITHUB-MILESTONES.md` e `docs/15-PLANO-APK-ANDROID-TV.md` por inteiro.

## 1. Resultado esperado

Entregar uma versão final do AquaTV para a **AQUAFLORA AGROSHOP**, preservando tudo que já funciona na STV-3000 Plus e acrescentando somente:

1. rotação configurável dentro do app, incluindo os dois lados possíveis da TV vertical;
2. nome correto da empresa em todo conteúdo atual;
3. identidade visual baseada na logo oficial fornecida por Pedro;
4. acabamento visual incremental no dashboard e nas telas administrativas do player;
5. documentação atual, limpeza segura e preparação para publicação no GitHub;
6. novo APK release assinado com a mesma chave usada no APK já instalado.

Não transformar esta tarefa em uma nova arquitetura. O núcleo do produto já foi aprovado em teste físico inicial e deve permanecer estável.

## 2. Contexto confirmado em 4 de agosto de 2026

- Dashboard Next.js: `http://192.168.0.114:7740`.
- API Express: `http://192.168.0.114:7741/api`.
- Health check: `http://192.168.0.114:7741/health`.
- Player atual: `apps/player`, Expo 55, React Native TV e Hermes.
- Pacote Android atual: `com.aquatv.player`.
- Versão instalada inicialmente: `0.1.0`, `versionCode 1`.
- O APK atual foi assinado e verificado com APK Signature Scheme v2.
- SHA-256 do certificado da chave correta: `f0de69f62bb4a348b069275e39cd26930229e5423839f65b99a3a4d387be7005`.
- SHA-256 do APK inicial aprovado: `1C56F8B8C5A30BA1F5D5FB12121FDDE1A52873A5A7AB062DE2C7E3B2F80240E1`.
- Keystore local usado por Pedro: `C:\AquaTV-Secrets\aquatv-release-v2.jks`.
- Pedro confirmou que a instalação e o teste inicial na TV Box funcionaram. Isso não comprova automaticamente soak de 48 horas, todos os codecs, recuperação offline ou todos os cenários da issue #11.
- A TV passará a ficar fisicamente na vertical.
- A orientação precisa poder ser trocada na própria TV com o controle remoto.
- O som continua configurável e deve iniciar desligado.

O hash do APK mudará a cada nova compilação. O hash do certificado deve continuar exatamente igual enquanto a mesma chave for usada.

## 3. Decisões de produto obrigatórias

### 3.1 Nome e marca

- Nome canônico da empresa em textos: **AquaFlora Agroshop**.
- Forma institucional ou etiqueta curta: **AQUAFLORA AGROSHOP**.
- Nome do produto: **AquaTV**.
- Nome sugerido do aplicativo no launcher: **AquaTV**.
- Não alterar o domínio `aquafloragroshop.com.br`; ele já usa “agroshop” corretamente.
- Remover referências atuais a “Aquaflora Grow Shop”, “AquaFlora Grow Shop” e “AQUAFLORA GROW SHOP”.

### 3.2 Logo oficial

A fonte entregue por Pedro está em:

```text
C:\Users\pedro\Downloads\AquaFlora.webp
```

Características conferidas da fonte:

- WebP de `300 × 300` pixels;
- transparência real no fundo (`RGBA`, alpha de 0 a 255); o visualizador pode apresentá-la sobre preto;
- símbolo colorido de animais/casa;
- assinatura “AquaFlora agroshop” em branco;
- tamanho atual de 6.394 bytes.

Copiar a fonte original sem modificá-la para um diretório versionado de marca, por exemplo:

```text
assets/brand/aquaflora-agroshop-source.webp
```

Manter esse arquivo como fonte de verdade. Arquivos derivados podem ser criados para dashboard e Android, mas não redesenhar a marca nem alterar suas proporções.

### 3.3 Orientação do player

Disponibilizar no app os seguintes modos:

1. **Automática / sistema**;
2. **Horizontal**;
3. **Vertical — lado A**;
4. **Vertical — lado B**.

Os nomes “lado A” e “lado B” podem virar “topo à esquerda” e “topo à direita” somente depois do teste físico confirmar qual mapeamento a STV-3000 Plus aplica. Não adivinhar o sentido apenas pelos nomes das constantes Android.

A orientação escolhida deve:

- ser aplicada imediatamente;
- persistir após fechar o app e reiniciar a TV Box;
- continuar salva ao usar **Reconectar**;
- afetar setup, status, reprodução e painel administrativo de maneira coerente;
- preservar navegação por controle remoto;
- não cortar, esticar ou deformar imagens e vídeos;
- continuar usando fundo preto quando a proporção da mídia não preencher a tela.

## 4. Limites contra overengineering

Não fazer nesta entrega:

- reescrever dashboard, API ou player;
- criar novo banco, tabela ou endpoint para orientação;
- controlar orientação remotamente pelo dashboard;
- reintroduzir player web, WebView, SSE, force-sync ou gestão de APK no painel;
- implementar auto-update de APK;
- expor o sistema publicamente ou migrar para Hostinger;
- adicionar analytics, telemetria externa ou contas de usuário;
- adotar Tailwind, biblioteca de componentes, Redux ou novo gerenciador de estado;
- adicionar biblioteca de animação apenas para efeitos cosméticos;
- colocar marca d’água por cima dos vídeos;
- alterar cache, polling, heartbeat, watchdog ou contratos da API sem um defeito comprovado;
- apagar arquivos rastreados apenas porque parecem antigos;
- versionar `.env`, banco, mídias, logs, backups, APK, AAB, senhas ou keystores.

A regra é: mudança pequena, visualmente caprichada, testável e reversível.

## 5. Ordem de execução

Executar as fases abaixo na ordem. Ao final de cada fase, validar antes de continuar.

### Fase 0 — proteger o estado aprovado

1. Conferir o branch e o working tree:

   ```powershell
   git branch --show-current
   git status --short
   git diff --check
   ```

2. Há alterações locais legítimas de Pedro em `README.md`, `apps/player` e `docs/14`/`docs/15`. Não descartar, sobrescrever ou fazer reset nelas.
3. Registrar o APK inicial apenas como evidência; não adicioná-lo ao Git.
4. Confirmar que o arquivo de logo em Downloads é legível antes de copiá-lo.
5. Criar um commit ou branch de trabalho somente se Pedro tiver autorizado a estratégia de Git. Não fazer push nem publicar release sem autorização explícita.

Critério de saída: nenhuma mudança anterior perdida e nenhum segredo adicionado ao índice do Git.

### Fase 1 — rotação configurável dentro do app

#### 1.1 Dependência nativa mínima

Usar `expo-screen-orientation`, compatível com Expo SDK 55. Instalar pelo resolvedor do Expo, dentro do workspace do player:

```powershell
corepack pnpm --filter @aquatv/player exec expo install expo-screen-orientation
```

Documentação oficial de referência:

- <https://docs.expo.dev/versions/v55.0.0/sdk/screen-orientation/>

Não escolher manualmente uma versão fora da faixa indicada pelo Expo.

#### 1.2 Modelo local da preferência

Criar um tipo estrito, sem `any`, semelhante a:

```ts
export type DisplayRotation = 'system' | 0 | 90 | 270;
```

Persistir a orientação separadamente das credenciais da TV, em SecureStore. O motivo é operacional: **Reconectar** limpa `deviceId` e token, mas não deve fazer a tela voltar para o lado errado.

Sugestão de chave:

```text
aquatv.player.display-rotation.v1
```

Requisitos da leitura:

- aceitar apenas valores conhecidos;
- usar `90` como padrão quando não houver valor ou o JSON for inválido, pois a instalação física agora será vertical;
- nunca impedir o boot do player por falha no SecureStore;
- não migrar banco nem enviar essa preferência à API;
- manter `audioEnabled` funcionando como está, salvo se uma pequena extração para preferências locais reduzir duplicação sem ampliar o escopo.

#### 1.3 Aplicação da orientação

Mapear os modos para `ScreenOrientation.lockAsync` e aplicar no boot e sempre que a preferência mudar. O mapeamento final dos dois portraits deve ser confirmado fisicamente:

- `system` → `OrientationLock.DEFAULT`;
- `0` → `OrientationLock.LANDSCAPE`;
- `90` → `OrientationLock.PORTRAIT_UP`;
- `270` → `OrientationLock.PORTRAIT_DOWN`.

Regras de implementação:

- manter `orientation: 'default'` em `apps/player/app.config.js`;
- manter o `AndroidManifest.xml` sem `android:screenOrientation` fixo;
- tratar rejeição de `lockAsync` sem derrubar reprodução ou sincronização;
- expor uma mensagem curta no painel quando o firmware ignorar ou rejeitar a troca;
- evitar chamadas repetidas a cada render;
- preservar `StatusBar` oculta e keep-awake;
- não usar `transform: rotate(...)` sobre `VideoView` nesta primeira implementação.

O player usava `surfaceType="surfaceView"`. O primeiro teste físico mostrou que o lock nativo mudava o menu, mas não girava a mídia e ainda cortava o painel em portrait. Por isso o fallback foi ativado: `textureView`, dimensões trocadas e rotação de viewport de `90°`/`270°` para imagens e vídeos. O novo APK ainda precisa da confirmação física de que não há corte, tela preta ou dupla rotação.

#### 1.4 Controles na TV

Adicionar a configuração em dois locais:

- `SetupScreen`: para corrigir a tela antes mesmo de registrar/reconectar a TV;
- `AdminOverlay`: para trocar durante a operação, acessível segurando OK/centro por aproximadamente 1,5 segundo.

O painel administrativo deve exibir o modo atual e oferecer botões claros para Automática, Horizontal, Vertical A e Vertical B. Reutilizar `TvButton`; não criar uma biblioteca de componentes.

Requisitos do controle remoto:

- foco inicial previsível;
- borda de foco claramente visível;
- OK aplica a mudança;
- Voltar fecha o painel sem encerrar o player;
- após a rotação, todos os botões continuam alcançáveis;
- nenhuma ação depende de toque.

#### 1.5 Testes automatizados da preferência

Adicionar testes para:

- ausência de preferência → `90`;
- valor antigo ou inválido → `90`;
- salvar e carregar os quatro modos;
- falha do lock nativo não interromper o runtime;
- **Reconectar** preservar a orientação;
- configurações antigas, que não possuem a nova propriedade, continuarem válidas.

Critério de saída: rotação muda ao vivo, persiste e não afeta áudio, cache, sincronização ou controle remoto.

### Fase 2 — aplicar a identidade da AquaFlora Agroshop

#### 2.1 Preparar derivados da logo

Usar processamento offline; não adicionar dependência de runtime ao dashboard ou ao player apenas para redimensionar imagens.

Produzir, no mínimo:

- logo completa para dashboard e telas do player;
- símbolo sem o texto para launcher/adaptive icon, obtido por recorte fiel do símbolo existente;
- splash em fundo preto com logo centralizada e margem segura;
- banner Android TV horizontal de `320 × 180`, com logo legível e sem encostar nas bordas;
- favicon/ícone do dashboard.

Não esticar a fonte de 300 × 300. Preservar proporção, usar `contain` e verificar a nitidez nos tamanhos reais. Se a ampliação ficar visivelmente ruim, manter a fonte em tamanho moderado ou fazer vetorização fiel; não inventar uma nova ilustração.

#### 2.2 Paleta

Extrair as cores diretamente da logo e registrá-las como tokens semânticos. A paleta visual contém:

- preto e branco como base;
- turquesa/ciano;
- roxo;
- laranja;
- amarelo/dourado.

Não transformar todas as telas em um arco-íris. Sugestão de papéis:

- turquesa: ação primária, links e foco;
- roxo: detalhe institucional e superfícies secundárias;
- laranja: destaque pontual;
- amarelo: aviso e informação importante;
- preto/deep green: fundos do player;
- branco/off-white: texto e painéis.

Manter contraste legível. Não substituir estados de erro/sucesso por cores da marca se isso diminuir a compreensão.

#### 2.3 Dashboard

Manter as rotas, componentes, formulários e hierarquia atuais. Melhorar apenas:

- login com logo oficial, nome correto e composição mais institucional;
- marca da sidebar e cabeçalho móvel;
- favicon e metadata;
- tokens de cor em `apps/dashboard/app/globals.css`;
- estados de foco, hover, sucesso, erro e vazio;
- consistência de espaçamento, bordas e sombras;
- responsividade já existente.

Priorizar `next/image` ou imagem com dimensões explícitas para evitar layout shift. O dashboard deve continuar rápido na rede local e não depender de fontes ou imagens externas.

Não trocar toda a linguagem visual: o dashboard atual já usa verdes, painéis claros e sidebar escura. Incorporar a paleta oficial sobre essa base.

#### 2.4 Player Android TV

Atualizar `SetupScreen`, `StatusScreen`, `AdminOverlay` e `TvButton` para usar os mesmos tokens e a logo oficial.

Requisitos:

- leitura confortável à distância;
- layout funcional tanto em horizontal quanto vertical;
- logo sem ocupar área exagerada;
- foco do controle remoto mais importante que animações;
- telas de status simples;
- playback em tela limpa, com fundo preto e sem decoração sobre a mídia;
- áudio continuando desligado por padrão;
- botão **Ativar som/Desativar som** preservado.

Centralizar tokens do player em um módulo simples, por exemplo `src/ui/theme.ts`. Não criar pacote compartilhado nem sistema de temas dinâmico.

#### 2.5 Android launcher, banner e splash

Atualizar `apps/player/app.config.js` e os recursos nativos necessários. Como o projeto mantém o diretório `android` versionado:

- não rodar `expo prebuild --clean` sem necessidade;
- se rodar prebuild, revisar todo o diff nativo;
- manter HOME e LEANBACK;
- garantir `android:banner` no `<application>` para o launcher da TV;
- manter o pacote `com.aquatv.player`;
- manter `usesCleartextTraffic` necessário para a API local HTTP;
- não reintroduzir permissões removidas.

Usar a logo completa no banner/splash e o símbolo no ícone. Confirmar que o launcher não mostra o ícone genérico do Expo.

Critério de saída: dashboard e player parecem parte da mesma marca, sem alterar os fluxos já aprovados.

### Fase 3 — corrigir nome e documentação

#### 3.1 Auditoria de nomenclatura

Executar:

```powershell
rg -n -i "grow shop|growshop|aquaflora" README.md AGENTS.md CLAUDE.md INSTALACAO-PC-CHEFE.md docs apps
```

Corrigir as referências de marca atuais, especialmente:

- `README.md`;
- `AGENTS.md`;
- `CLAUDE.md`;
- `docs/01-CONTEXTO.md` onde houver descrição institucional;
- `apps/player/src/ui/SetupScreen.tsx`;
- metadata e textos visíveis do dashboard.

Não alterar URLs, nomes de pacote, nomes de banco, IDs ou caminhos apenas por conterem “aquaflora”.

#### 3.2 README final

O README deve permitir que outro PC reproduza a instalação. Atualizar:

- marca correta;
- arquitetura local atual;
- requisitos e instalação;
- endereço `192.168.0.114` como configuração atual da loja, deixando claro que é ajustável;
- build do APK assinado;
- quatro modos de orientação;
- som configurável;
- instalação e atualização via pendrive;
- preservação do keystore;
- validações automatizadas;
- distinção entre teste inicial aprovado e soak/backup ainda pendentes;
- links apenas para documentos atuais.

Não colocar senha, token, conteúdo de `.env` privado ou APK no README.

#### 3.3 Documentação operacional

Atualizar pelo menos:

- `docs/14-GITHUB-MILESTONES.md` com evidência do APK assinado e do teste físico reportado;
- `docs/15-PLANO-APK-ANDROID-TV.md` com hash/certificado atuais, rotação configurável e resultado real do teste;
- `docs/06-DEVICE-SETUP.md` para remover instruções que afirmem que portrait está fixo no manifest;
- `INSTALACAO-PC-CHEFE.md` se a sequência real de instalação ou atualização mudou.

Não marcar como concluído o que Pedro não testou. Em particular, não declarar soak de 48 horas, backup externo, todos os codecs ou recuperação após todos os reboots sem evidência.

#### 3.4 Documentos históricos

`docs/01` a `docs/13` contêm partes históricas sobre Hostinger, MySQL, player web, SSE e auto-update. Não executar substituição cega e não apagar decisões úteis.

Fazer o mínimo seguro:

1. criar ou atualizar um índice de documentação que separe **documentação atual** de **histórico**;
2. colocar aviso claro no topo dos documentos predominantemente históricos;
3. corrigir apenas afirmações que possam induzir uma operação perigosa hoje;
4. manter referências históricas quando forem apresentadas como histórico;
5. garantir que README, `AGENTS.md`, docs 14, 15 e o guia operacional sejam inequívocos como fonte atual.

`CLAUDE.md` está fortemente obsoleto e contradiz a arquitetura atual. Reduzi-lo a um guia curto alinhado ao `AGENTS.md` ou atualizá-lo por completo. Não deixar afirmações de Hostinger primária, MySQL, SSE e auto-update como estado presente.

### Fase 4 — limpeza segura

Antes de remover qualquer coisa, executar:

```powershell
git status --short --ignored
git ls-files
rg -n "caminho-ou-nome-candidato" . -g '!node_modules/**' -g '!**/build/**'
```

Classificar cada candidato:

- rastreado e usado;
- rastreado e histórico;
- gerado e ignorado;
- credencial/artefato local;
- desconhecido — não remover.

Candidatos já identificados para análise:

- `apps/tv-apk/`: árvore legada ignorada, não é o player atual. Remover somente após confirmar que nenhum arquivo único precisa ser preservado;
- `.claude/worktrees/`: worktrees ignoradas de agentes. Não apagar enquanto houver trabalho ativo; pedir confirmação de Pedro;
- `apps/player/android/app/build/`: saída reproduzível e ignorada. Pode ser limpa localmente quando não for necessário preservar o APK de teste;
- APKs antigos em pastas de build: não versionar e não confundir com o release atual;
- recursos genéricos de ícone/splash: substituir pelos novos somente após verificar o APK.

Não remover migrations, scripts Windows, exemplos de `.env`, testes, banco schema ou documentação atual para “enxugar” o repositório.

Critério de saída: nenhum arquivo importante perdido, nenhum segredo rastreado e nenhuma árvore legada confundida com o produto atual.

### Fase 5 — versão, validação e novo APK

#### 5.1 Versionamento Android

O APK instalado usa `versionCode 1`. Para a atualização final:

- manter `com.aquatv.player`;
- usar a mesma chave `aquatv-release-v2.jks`;
- aumentar `versionCode` para pelo menos `2`;
- definir um `versionName` coerente, preferencialmente `1.0.0` quando todos os critérios deste guia passarem;
- se houver vários APKs físicos intermediários, incrementar `versionCode` em cada entrega que precise instalar sobre a anterior.

Nunca substituir ou recriar o keystore final sem decisão explícita de Pedro.

#### 5.2 Validação de software

Na raiz do monorepo:

```powershell
corepack pnpm peers check
corepack pnpm format
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
git diff --check
```

Se o format check falhar, formatar somente os arquivos alterados e repetir. Não usar formatação global para gerar um diff enorme sem necessidade.

Validar também o smoke Windows conforme o README e os scripts existentes. Não usar `prisma db push`; usar migrations e backup quando houver mudança de schema — esta tarefa não deveria precisar de schema novo.

#### 5.3 APK assinado

Usar as quatro variáveis já suportadas por `apps/player/android/app/build.gradle`:

```text
AQUATV_RELEASE_STORE_FILE
AQUATV_RELEASE_STORE_PASSWORD
AQUATV_RELEASE_KEY_ALIAS
AQUATV_RELEASE_KEY_PASSWORD
```

As senhas devem ser digitadas apenas na máquina de Pedro e nunca registradas em arquivo, comando publicado, issue ou log.

Gerar:

```powershell
Set-Location 'C:\Users\pedro\Documents\Projetos\AquaFlora\AquaFloraTV\apps\player\android'
.\gradlew.bat :app:assembleRelease --console=plain --no-daemon --max-workers=2
```

Aceitar apenas:

```text
apps/player/android/app/build/outputs/apk/release/app-release.apk
```

Não usar `app-release-unsigned.apk`, APK de `apps/tv-apk` ou APK dentro de `.claude/worktrees`.

Verificar:

```powershell
$apk = 'C:\Users\pedro\Documents\Projetos\AquaFlora\AquaFloraTV\apps\player\android\app\build\outputs\apk\release\app-release.apk'
& 'C:\Users\pedro\AppData\Local\Android\Sdk\build-tools\36.0.0\apksigner.bat' verify --verbose --print-certs $apk
Get-FileHash -LiteralPath $apk -Algorithm SHA256
```

Critérios:

- saída contém `Verifies`;
- existe exatamente um signer;
- digest SHA-256 do certificado continua `f0de69f62bb4a348b069275e39cd26930229e5423839f65b99a3a4d387be7005`;
- package continua `com.aquatv.player`;
- manifest não fixa uma única orientação;
- assets finais aparecem no APK;
- URL inicial continua apontando para `192.168.0.114:7741/api`.

#### 5.4 Teste físico obrigatório

Instalar por cima da versão atual para também validar a continuidade da assinatura. Se o Android exigir desinstalar, parar: isso indica package ou certificado incompatível e apagaria configuração/cache.

Testar na STV-3000 Plus:

| Cenário         | Aceite                                                       |
| --------------- | ------------------------------------------------------------ |
| Atualização     | instala sobre o APK anterior sem desinstalar                 |
| Registro        | credenciais e cadastro existentes continuam válidos          |
| Automática      | respeita a orientação do sistema                             |
| Horizontal      | tela e painel ficam legíveis e sem corte                     |
| Vertical A      | ocupa a TV vertical, mídia em `contain`, controle utilizável |
| Vertical B      | gira para o lado oposto e continua utilizável                |
| Persistência    | orientação permanece após fechar e reiniciar a box           |
| Reconectar      | limpa conexão, mas preserva orientação                       |
| Controle        | OK longo abre painel; foco, OK e Voltar funcionam            |
| Som             | inicia mudo; ativar/desativar persiste                       |
| Imagem          | JPG/PNG/WebP respeitam duração e proporção                   |
| Vídeo           | MP4 toca até o fim, com áudio opcional e sem tela preta      |
| Playlist        | ordem e loop continuam iguais ao dashboard                   |
| Cache           | após sincronizar, conteúdo continua com rede desligada       |
| Retorno da rede | sincronização se recupera sem reinstalar                     |
| Reboot          | player e cache retornam conforme comportamento aprovado      |
| Marca           | logo, nome, banner, splash e ícone aparecem corretamente     |

Registrar qual modo corresponde ao topo físico escolhido. Só então substituir “lado A/B” por um rótulo mais intuitivo.

### Fase 6 — GitHub e entrega final

Depois das validações:

1. atualizar issue #10 com versão, hash do APK e digest do certificado; fechar se a geração assinada estiver comprovada;
2. atualizar issue #11 com instalação física, controle, codecs, orientação, cache e reboot realmente executados;
3. atualizar issue #14 com identidade visual e evidências do launcher/splash/banner;
4. não fechar issue #12 sem soak real de 48 horas;
5. não fechar issue #13 sem backup externo e restauração testada;
6. manter issue #15 no backlog se continuar sem bloquear o produto;
7. ajustar milestones conforme issues realmente concluídas, não por aparência de “versão final”.

Preparar commits pequenos e revisáveis, por exemplo:

1. `feat(player): add persistent display orientation controls`
2. `feat(brand): apply AquaFlora Agroshop identity`
3. `docs: finalize AquaTV operation and release guides`
4. `chore: remove verified legacy local artifacts`

Não incluir APK ou keystore nos commits. Não fazer push, tag ou GitHub Release sem autorização final de Pedro.

## 6. Melhorias recomendadas agora

Estas melhorias têm valor alto e cabem nesta finalização:

- rotação dentro do app;
- identidade e nome corretos;
- ícone, splash e banner reais;
- foco do controle remoto mais visível;
- layout administrativo responsivo em portrait;
- README reproduzível;
- documentação histórica claramente separada;
- atualização assinada instalada sobre a versão anterior;
- soak de 48 horas e backup externo depois da entrega visual.

## 7. Ideias para backlog, não implementar agora

- orientação configurada remotamente pelo dashboard;
- preview portrait/landscape no navegador;
- múltiplos perfis visuais por TV;
- telemetria detalhada de temperatura e armazenamento;
- atualização automática de APK;
- acesso público/cloud;
- editor de banners dentro do dashboard;
- transições avançadas entre mídias;
- métricas e analytics.

Essas ideias só entram se aparecer uma necessidade real após uso contínuo. O AquaTV não precisa delas para cumprir sua função atual.

## 8. Relatório obrigatório do Luna

Ao terminar, entregar a Pedro um relatório contendo:

1. resumo objetivo do que mudou;
2. lista de arquivos adicionados, alterados, movidos e removidos;
3. dependência nova e justificativa;
4. resultado de lint, typecheck, testes, build, smoke e Gradle;
5. versão, `versionCode`, tamanho e SHA-256 do APK;
6. digest do certificado de assinatura;
7. confirmação de que nenhum segredo/APK entrou no Git;
8. resultados físicos separados por cenário;
9. itens ainda pendentes, especialmente soak e backup;
10. `git status --short` final;
11. commits preparados e ações GitHub realizadas;
12. instrução de rollback caso a atualização apresente problema.

O relatório deve distinguir claramente:

- **validado automaticamente**;
- **validado fisicamente por Pedro**;
- **não testado**;
- **bloqueado por decisão ou autorização**.

## 9. Definição de pronto

A finalização só está pronta quando:

- o nome visível é AquaFlora Agroshop;
- a logo oficial aparece com boa qualidade;
- o dashboard continua funcional e responsivo;
- o player mantém o fluxo já aprovado;
- a rotação pode ser alterada na própria TV para os dois lados verticais;
- orientação e áudio persistem;
- o controle remoto funciona depois de cada rotação;
- mídia não corta nem distorce;
- a atualização instala sobre o APK anterior com a mesma assinatura;
- todas as validações de software passam;
- o APK final é verificado e permanece fora do Git;
- documentação e milestones refletem somente evidência real;
- soak e backup permanecem explicitamente pendentes até serem executados.

Se qualquer melhoria visual ameaçar reprodução, cache, controle remoto ou atualização assinada, preservar o comportamento funcional e adiar o detalhe visual.
