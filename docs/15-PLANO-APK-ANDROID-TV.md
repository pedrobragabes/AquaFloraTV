# 15 — Plano de APK e validação na STV-3000 Plus

Este documento é o roteiro operacional para o Luna preparar o ambiente Android, gerar um APK release assinado e validar o AquaTV na box real. Ele foi atualizado em **4 de agosto de 2026**. Pedro confirmou a instalação e a reprodução inicial na STV-3000 Plus; a matriz completa e o soak continuam pendentes.

## Resposta direta: como a box recebe as informações

O dashboard não é instalado na Android TV. A arquitetura correta é:

```text
Dashboard no navegador
        |
        v
PC da loja — 192.168.0.114 (IP do servidor confirmado por `/health`)
├── Dashboard :7740
├── API       :7741
├── SQLite
└── Mídias em storage/media
        |
        | HTTP na rede local privada
        v
STV-3000 Plus
└── APK AquaTV Player
    ├── cadastra a TV automaticamente na API
    ├── recebe playlist e programação
    ├── baixa as mídias para o cache local
    ├── envia heartbeat ao dashboard
    └── continua tocando quando a rede cai
```

Na primeira abertura, o app pede o endereço do PC. Pode ser informado apenas `192.168.0.114:7741`; o player normaliza para `http://192.168.0.114:7741/api`, registra a TV e guarda URL, ID e token no armazenamento seguro do Android.

`API_URL` em `apps/player/.env` serve somente como valor inicial preenchido no APK. Não é necessário gerar outro APK quando o IP muda, porque a conexão pode ser redefinida no menu administrativo. Mesmo assim, o IP do PC deve ser reservado para evitar interrupções.

## Políticas ajustáveis na própria TV

- **Som:** começa desligado para não surpreender a operação da loja. No playback, segure o centro da tela por 1,5 segundo para abrir a administração, navegue com o controle até **Ativar som** ou **Desativar som** e confirme. A preferência fica salva no SecureStore da box e vale para os vídeos seguintes.
- **Orientação:** o app inicia em vertical (`90°`) e oferece **Automática**, **Horizontal**, **Vertical lado A** e **Vertical lado B** pelo botão **Girar tela**. A escolha fica no SecureStore, não é enviada à API e não é apagada pelo botão Reconectar. Em portrait, imagens e vídeos usam viewport com dimensões trocadas e `TextureView` para aplicar `90°`/`270°`; a mídia continua em `contain`, preservando a proporção com barras quando necessário.
- **Reconexão:** o mesmo painel administrativo tem **Reconectar**, que limpa as credenciais locais e retorna à tela para informar novamente `192.168.0.114:7741`.

## Estado verificado antes do trabalho

| Item                         | Estado em 04/08/2026                                                                                             |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| API local                    | responde em `http://localhost:7741/health`                                                                       |
| API pelo IPv4 do servidor    | responde em `http://192.168.0.114:7741/health` (`status: ok`)                                                    |
| IPv4 atualmente ativo aqui   | `192.168.0.36`; não é o endereço que será gravado no APK                                                         |
| Rede Windows                 | Ethernet, perfil Privado                                                                                         |
| Firewall                     | regras `AquaTV Local TCP 7740/7741` ativas, perfil Private                                                       |
| Tarefa de backup             | criada                                                                                                           |
| Tarefa de inicialização      | não encontrada; precisa ser instalada/testada                                                                    |
| Último backup encontrado     | antigo, de 28/04/2026; gerar um novo                                                                             |
| Android Studio               | instalado                                                                                                        |
| Android SDK                  | Platform 36, Build Tools 36.0.0 e Platform-Tools instalados; Command-line Tools configuradas                     |
| Java ativo no terminal       | JDK 17 Microsoft instalado para o Gradle; Java 8 continua sendo o padrão global                                  |
| Java do Android Studio       | Java 25; o Gradle 8.13 falhou com `Unsupported class file major version 69`                                      |
| Java necessário              | JDK 17                                                                                                           |
| Android exigido pelo projeto | Platform/compile SDK 36, target SDK 36, Build Tools 36.0.0, min SDK 24                                           |
| `apps/player/.env`           | criado localmente com `192.168.0.114`                                                                            |
| `android/local.properties`   | criado localmente e ignorado pelo Git                                                                            |
| APK release                  | APK anterior `1.0.0`, `versionCode 2`, assinado e verificado; rebuild final pendente de credenciais nesta sessão |

### Progresso executado em 03/08/2026

- JDK 17 Microsoft instalado e validado no Gradle 8.13.
- Command-line Tools oficiais instaladas; SHA-256 do ZIP conferido antes da extração.
- Licenças do SDK aceitas e Platform 36 instalado.
- `pnpm --filter @aquatv/player lint`, `typecheck` e `test` aprovados (15 testes).
- `expo config` confirmou `http://192.168.0.114:7741/api` no `extra.apiUrl`.
- um APK release anterior foi gerado com a chave `aquatv-release-v2.jks` fora do repositório e validado com `apksigner`;
- O certificado release foi verificado com digest `f0de69f62bb4a348b069275e39cd26930229e5423839f65b99a3a4d387be7005`.
- o `extra.apiUrl` do APK anterior contém `192.168.0.114`.
- `.114/health` respondeu `status: ok` nesta máquina; a box já instalou e abriu o APK por pendrive.
- áudio configurável e orientação persistente foram incluídos; o padrão é vertical e mudo.
- logo, splash, ícone e banner da AquaFlora Agroshop foram preparados; validar a aparência final na TV real.

Após as alterações finais de rotação e marca, `assembleRelease` foi executado
com JDK 17 e compilou o APK nativo sem erros. Como as variáveis de assinatura
não estavam carregadas nesta sessão, o resultado foi
`app-release-unsigned.apk`; não instalar esse artefato por cima do APK
assinado. Repetir a tarefa com as quatro variáveis locais do keystore antes de
registrar o hash final ou fazer novo teste físico.

## Regras para o Luna

- Trabalhar na ordem das fases abaixo e registrar a evidência ao final de cada uma.
- Não executar `expo prebuild`, pois `apps/player/android` contém ajustes nativos já versionados.
- Não usar `localhost`, `127.0.0.1` ou o IP da própria box como endereço da API.
- Não versionar `.env`, `local.properties`, APK, AAB, keystore ou senhas.
- Não usar a `debug.keystore` para o release.
- Não publicar o APK nem o keystore em release do GitHub ou no dashboard.
- Não escolher o AquaTV como launcher “Sempre” antes de validar a saída e a recuperação com ADB/controle.
- Não fechar a validação física usando emulador como evidência.

## Fase 1 — Fechar a rede entre PC e box

### Objetivo

Garantir que o endereço usado pelo player continue válido e seja acessível pela STV-3000 Plus.

### Tarefas

1. No roteador, reservar `192.168.0.114` para o MAC da placa Ethernet do servidor. Se o servidor ainda estiver em outra máquina, mover o runtime ou confirmar o novo endereço antes de continuar.
2. Confirmar no Windows:

   ```powershell
   Get-NetConnectionProfile
   .\diagnostico-aquatv.bat
   ```

3. Se a tarefa de inicialização não existir, abrir PowerShell como administrador e executar:

   ```bat
   instalar-inicializacao.bat
   ```

4. Gerar um backup atual:

   ```bat
   backup-agora.bat
   ```

5. Conectar PC e box à mesma rede local. Antes de instalar o app, abrir na box ou em outro aparelho da mesma rede:

   ```text
   http://192.168.0.114:7741/health
   ```

### Evidência obrigatória

- reserva DHCP ou IP estático anotado;
- JSON com `"status":"ok"` visto a partir de outro aparelho, especificamente em `192.168.0.114`;
- tarefa `AquaTV Local Startup` existente e testada após reinício;
- novo ZIP de backup com data atual.

## Fase 2 — Preparar Android SDK e JDK 17

### Objetivo

Fazer o Gradle usar um ambiente compatível e reproduzível.

### Tarefas

1. No Android Studio, abrir **More Actions > SDK Manager**.
2. Confirmar o SDK em `C:\Users\pedro\AppData\Local\Android\Sdk` e instalar (Build Tools 36.0.0 e Platform-Tools já estão presentes nesta máquina):
   - Android SDK Platform 36;
   - Android SDK Build-Tools 36.0.0;
   - Android SDK Platform-Tools;
   - Android SDK Command-line Tools (latest).
3. Instalar um JDK 17 de 64 bits. O Java 8 atual não serve, e o JBR 25 incluído nesta instalação do Android Studio também não deve ser usado por este Gradle.
4. Criar localmente `apps/player/android/local.properties`:

   ```properties
   sdk.dir=C:\\Users\\pedro\\AppData\\Local\\Android\\Sdk
   ```

5. Na sessão de PowerShell usada para o build, apontar `JAVA_HOME` para o JDK 17 e adicionar seu `bin` ao início do `Path`.
6. Validar:

   ```powershell
   java -version
   adb version
   cd apps\player\android
   .\gradlew.bat --version
   ```

### Critério de aceite

- `java -version` e `gradlew --version` mostram JDK 17;
- `adb version` funciona;
- o SDK contém Platform 36 e Build Tools 36.0.0;
- `local.properties` existe apenas localmente e continua ignorado pelo Git.

## Fase 3 — Configurar URL e assinatura do release

### Objetivo

Gerar um APK que abra sem Metro, já sugira o PC correto e tenha identidade criptográfica própria.

### Tarefas

1. Depois de reservar o IP, criar `apps/player/.env`:

   ```env
   API_URL=http://192.168.0.114:7741/api
   ```

2. Confirmar a configuração pública que será embutida:

   ```powershell
   corepack pnpm --filter @aquatv/player exec expo config --type public
   ```

3. Criar uma pasta de segredos fora do repositório e gerar um keystore exclusivo. Exemplo de comando, usando o `keytool` do JDK 17:

   ```powershell
   keytool -genkeypair -v -storetype PKCS12 -keystore C:\AquaTV-Secrets\aquatv-release.jks -alias aquatv-release -keyalg RSA -keysize 2048 -validity 10000
   ```

4. Guardar o keystore e as senhas em dois locais seguros. Perder essa chave impede atualizar o app já instalado com o mesmo pacote.
5. Na mesma sessão de PowerShell, definir as quatro variáveis esperadas por `apps/player/android/app/build.gradle`:

   ```powershell
   $env:AQUATV_RELEASE_STORE_FILE='C:\AquaTV-Secrets\aquatv-release.jks'
   $env:AQUATV_RELEASE_STORE_PASSWORD='<senha do keystore>'
   $env:AQUATV_RELEASE_KEY_ALIAS='aquatv-release'
   $env:AQUATV_RELEASE_KEY_PASSWORD='<senha da chave>'
   ```

As senhas nunca devem ser gravadas em arquivo do projeto, comentário do GitHub, log ou captura de tela.

## Fase 4 — Gerar e verificar o APK

### Tarefas

1. Na raiz do projeto, executar as validações do player:

   ```powershell
   corepack pnpm --filter @aquatv/player lint
   corepack pnpm --filter @aquatv/player typecheck
   corepack pnpm --filter @aquatv/player test
   ```

2. Gerar o release:

   ```powershell
   cd apps\player\android
   .\gradlew.bat clean assembleRelease
   ```

3. Localizar o artefato:

   ```text
   apps/player/android/app/build/outputs/apk/release/app-release.apk
   ```

4. Verificar assinatura e hash com as ferramentas do SDK:

   ```powershell
   apksigner verify --verbose --print-certs .\app\build\outputs\apk\release\app-release.apk
   Get-FileHash .\app\build\outputs\apk\release\app-release.apk -Algorithm SHA256
   Get-Item .\app\build\outputs\apk\release\app-release.apk | Select-Object FullName,Length,LastWriteTime
   ```

5. Copiar o APK para uma pasta de entrega fora do repositório. Não fazer commit do arquivo.

### Critério de aceite

- `assembleRelease` termina com `BUILD SUCCESSFUL`;
- `apksigner` confirma a assinatura `aquatv-release`;
- SHA-256 e tamanho são registrados na issue #10;
- o APK abre sem Metro e sem servidor de desenvolvimento.

## Fase 5 — Instalar e validar na STV-3000 Plus

### Instalação

Preferir ADB durante os testes, pois permite reinstalar e coletar logs:

1. Ativar opções do desenvolvedor e depuração USB/rede na box.
2. Confirmar a conexão:

   ```powershell
   adb devices
   ```

3. Instalar ou atualizar:

   ```powershell
   adb install -r C:\CAMINHO-SEGURO\app-release.apk
   ```

Se o ADB não for viável, instalar por pendrive e habilitar temporariamente a instalação de fontes desconhecidas apenas para o gerenciador de arquivos usado.

### Primeiro cadastro

1. Abrir o AquaTV pelo launcher Android TV.
2. Usar somente o controle remoto para chegar ao campo da API.
3. Confirmar ou digitar `192.168.0.114:7741`.
4. Selecionar **Conectar TV**.
5. No dashboard, confirmar que a nova TV apareceu e recebeu heartbeat.
6. Associar uma playlist padrão com conteúdo real da loja.

### Matriz de testes físicos

| Teste                       | Resultado esperado                                                        |
| --------------------------- | ------------------------------------------------------------------------- |
| Controle remoto             | foco visível, edição da URL e botão Conectar utilizáveis sem mouse        |
| Registro                    | TV aparece uma única vez no dashboard e não expõe o token                 |
| MP4 H.264/AAC               | inicia, termina e avança sem tela preta persistente                       |
| JPG, PNG e WebP             | respeitam duração e avançam corretamente                                  |
| Automática                  | respeita a orientação fornecida pelo Android TV                           |
| Horizontal                  | ocupa a tela e mantém o painel navegável                                  |
| Vertical lado A             | ocupa a TV vertical sem cortar ou deformar a mídia                        |
| Vertical lado B             | corrige o sentido oposto da montagem sem perder o controle remoto         |
| Playlist                    | ordem e loop iguais ao dashboard                                          |
| Pausa global                | player interrompe e mostra estado sem conteúdo                            |
| Retomada                    | nova sincronização baixa e toca a playlist                                |
| Rede desligada após cache   | conteúdo continua tocando do cache local                                  |
| Rede restabelecida          | player volta a sincronizar sem reiniciar o app                            |
| Reboot da box               | AquaTV reabre/é selecionável e recupera o cache                           |
| Reboot do PC                | serviços voltam pela tarefa e a box se reconecta                          |
| HOME/launcher               | comportamento é conhecido e existe caminho de recuperação                 |
| Som                         | começa mudo; **Ativar som** no painel libera áudio e persiste após reboot |
| Persistência de orientação  | escolha continua após fechar/reiniciar e não é apagada por Reconectar     |
| Temperatura e armazenamento | sem aquecimento anormal nem crescimento descontrolado                     |

Durante a primeira validação de HOME, escolher **Somente uma vez** se o Android perguntar pelo launcher. Selecionar **Sempre** somente depois de confirmar como voltar às configurações ou usar ADB para recuperação.

Para falhas, coletar:

```powershell
adb logcat -c
adb logcat | Select-String -Pattern 'aquatv|ReactNativeJS|AndroidRuntime|ExoPlayer'
```

### Critério de aceite

A issue #11 só pode ser fechada quando a STV-3000 Plus:

- instala e abre o APK release;
- cadastra na API e aparece online no dashboard;
- baixa e toca a playlist real em loop;
- continua tocando após perda de rede;
- recupera após retorno da rede e reinicialização;
- funciona com o controle remoto e orientação física escolhida.

## Fase 6 — Soak e go-live

Depois do aceite inicial, manter a box reproduzindo por 48 horas. Registrar horário inicial/final, mudanças de playlist, quedas de rede, reinícios, telas pretas, crashes, temperatura e uso de armazenamento. O go-live só está comprovado após concluir a issue #12; identidade visual e backup externo permanecem entregas explícitas da estabilização.

## Ordem das issues no GitHub

1. [#9 — Configurar o PC e a rede local](https://github.com/pedrobragabes/AquaFloraTV/issues/9)
2. [#10 — Preparar Android SDK e gerar APK release assinado](https://github.com/pedrobragabes/AquaFloraTV/issues/10)
3. [#11 — Validar APK e integração na STV-3000 Plus](https://github.com/pedrobragabes/AquaFloraTV/issues/11)
4. [#12 — Executar soak test de 48 horas e validar recuperação](https://github.com/pedrobragabes/AquaFloraTV/issues/12)
5. [#13 — Configurar backup fora do PC e testar restauração](https://github.com/pedrobragabes/AquaFloraTV/issues/13)
6. [#14 — Aplicar identidade visual final no app](https://github.com/pedrobragabes/AquaFloraTV/issues/14)

O alerta de dependência da issue #15 não bloqueia o APK nem o go-live e pertence ao backlog técnico pós-MVP.
