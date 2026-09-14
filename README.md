# Retail Digital Signage

Sistema de digital signage desenvolvido para resolver um problema real de operação de varejo. Permite que a loja envie imagens e vídeos, organize playlists, programe conteúdos e acompanhe a TV sem depender de uma assinatura mensal.

O MVP foi desenhado para operar na rede local: o dashboard, a API, o banco e os arquivos ficam no PC da loja; a STV-3000 Plus usa um app Android TV dedicado, com cache para continuar reproduzindo durante falhas de rede.

## Problema, solução e arquitetura

Displays comerciais precisam receber conteúdo atualizado e continuar reproduzindo quando a rede cai. O dashboard organiza mídia, playlists e horários; a API resolve a programação; o player mantém cache local com atualização transacional e recuperação de falhas.

```text
Dashboard Next.js → API Express → SQLite e mídia em disco
                              → manifesto/polling → player Android TV → cache offline
```

O núcleo de cache, o planner de sincronização e os contratos de playlists são candidatos a componentes reutilizáveis. A operação atual é local; exposição pública, distribuição de APK e migração de marca nativa exigem validação própria. `NEXT_PUBLIC_APP_NAME` e `NEXT_PUBLIC_STORE_NAME` configuram o dashboard no build e nunca devem conter segredos.

## Estado do projeto

Em 4 de agosto de 2026, o núcleo local está concluído e o primeiro APK release assinado foi instalado com sucesso na STV-3000 Plus:

- dashboard responsivo com login, conteúdos, playlists, programação e TVs;
- API protegida para operações administrativas;
- upload validado de MP4, JPG, PNG e WebP, com limite configurável;
- playlist padrão, pausa global e agendamentos, inclusive durante a madrugada;
- player Expo/React Native TV com cache transacional e fallback offline;
- polling com backoff, heartbeat e recuperação de travamentos de vídeo;
- áudio configurável e orientação persistente pelo controle remoto;
- identidade visual separada da lógica de playlists e reprodução;
- instalação, inicialização, diagnóstico, firewall, backup e smoke test para Windows;
- 19 testes automatizados (4 da API e 15 do player) e 16 verificações no smoke de integração.

O código é candidato a go-live. A instalação física inicial foi aprovada; ainda é necessário concluir a calibração dos dois lados portrait, o teste completo de codec/cache/reboot, o soak de 48 horas e o backup fora do PC. O acompanhamento está detalhado em [Milestones e issues](docs/14-GITHUB-MILESTONES.md).

## Arquitetura

```text
Operador no navegador
        │
        ▼
PC Windows da loja
├── Dashboard Next.js :7740
├── API Express       :7741
├── SQLite            apps/api/prisma/dev.db
└── Arquivos          storage/media
        │
        │ rede local privada
        ▼
STV-3000 Plus
└── App Android TV
    ├── sincroniza a playlist
    ├── mantém cache local
    └── reproduz mesmo sem rede
```

Manter a API separada do Next.js é intencional: o contrato consumido pela TV continua simples e o backend pode evoluir sem acoplar o runtime Android ao dashboard.

## Stack

| Área          | Tecnologia                             |
| ------------- | -------------------------------------- |
| Monorepo      | pnpm 11, workspaces e Turborepo        |
| Dashboard     | Next.js 15, React e TypeScript estrito |
| API           | Node.js, Express, Prisma e SQLite      |
| Player        | Expo 55, React Native TV e Hermes      |
| Armazenamento | Disco local do PC e cache local na TV  |
| Operação      | Windows PowerShell e Task Scheduler    |

## Instalação no PC da loja

### Pré-requisitos

- Windows 10 ou 11;
- Node.js 22.13 ou superior;
- acesso de administrador para configurar firewall e tarefas automáticas;
- PC e TV box na mesma rede local privada.

### 1. Preparar o sistema

Na raiz do projeto, execute:

```bat
instalar-dependencias.bat
```

O instalador fixa o pnpm 11.11.0, instala as dependências, solicita uma senha administrativa, gera os segredos locais, protege uma migração existente com backup e compila API e dashboard.

Arquivos `.env` reais são locais e nunca devem ser enviados ao Git. Os modelos ficam em:

- `apps/api/.env.example`;
- `apps/dashboard/.env.example`;
- `apps/player/.env.example`.

### 2. Iniciar e verificar

```bat
iniciar-aquatv.bat
diagnostico-aquatv.bat
```

Serviços locais:

- dashboard: `http://localhost:7740`;
- saúde da API: `http://localhost:7741/health`.

Para encerrar com segurança:

```bat
parar-aquatv.bat
```

### 3. Liberar apenas a rede confiável

Confirme primeiro que o perfil da rede do Windows está como **Privado**. Depois, abra como administrador:

```bat
liberar-firewall.bat
```

O script recusa redes públicas e limita as portas 7740 e 7741 à sub-rede local.

### 4. Automatizar inicialização e backup

Execute como administrador:

```bat
instalar-inicializacao.bat
instalar-backup-diario.bat
```

Teste imediatamente:

```bat
backup-agora.bat
```

O backup contém um snapshot consistente do SQLite e do `storage/`. Para proteção contra perda do PC, copie os ZIPs também para outro equipamento ou mídia.

### 5. Deploy automático depois da CI

O servidor da loja pode receber automaticamente cada commit da `main` que passar pela
CI. O workflow `Deploy production` usa um runner privado apenas para colocar o bundle
Git validado em uma fila local. A tarefa `AquaTV-Deploy`, executada como `SYSTEM`, faz
backup, aplica somente fast-forward, instala dependências, executa migrations e build,
reinicia API/dashboard e confirma a saúde nas portas 7741 e 7740. Configurações, banco,
mídias, logs e backups permanecem fora do Git e não são enviados ao runner.

## Desenvolvimento

```bash
corepack pnpm@11.11.0 install --frozen-lockfile
pnpm dev
```

Comandos de qualidade:

```bash
pnpm peers check
pnpm prisma:generate
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm format
pnpm format:write # aplique a formatação somente quando necessário
```

Smoke completo no Windows, usando banco e portas isolados:

```powershell
.\scripts\windows\smoke-aquatv.ps1
```

Os logs do smoke são criados em `logs/integration-smoke-*` e permanecem fora do Git.

## Player Android TV

Configure `apps/player/.env` com o endereço real do PC da loja, nunca com `localhost`:

```env
API_URL=http://192.0.2.10:7741/api
# Exemplo reservado para documentação; substitua pelo endereço do seu servidor.
```

Para desenvolvimento:

```bash
pnpm --filter @aquatv/player dev
```

Para gerar um release é necessário usar JDK 17, Android SDK e fornecer as quatro credenciais de assinatura esperadas pelo Gradle:

- `AQUATV_RELEASE_STORE_FILE`;
- `AQUATV_RELEASE_STORE_PASSWORD`;
- `AQUATV_RELEASE_KEY_ALIAS`;
- `AQUATV_RELEASE_KEY_PASSWORD`.

Depois:

```powershell
cd apps\player\android
.\gradlew.bat assembleRelease
```

O APK final é `app/build/outputs/apk/release/app-release.apk`. Verifique-o antes de instalar:

```powershell
& "$env:ANDROID_HOME\build-tools\36.0.0\apksigner.bat" verify --verbose --print-certs .\app\build\outputs\apk\release\app-release.apk
Get-FileHash .\app\build\outputs\apk\release\app-release.apk -Algorithm SHA256
```

O pacote é `com.aquatv.player`, a versão final em preparação é `1.0.0` (`versionCode 2`) e atualizações de uma instalação existente devem manter o certificado autorizado dessa instalação. Nunca envie a senha ou o keystore para o GitHub.

### Controles do player

- segure OK/centro por aproximadamente 1,5 segundo para abrir o painel administrativo;
- o som começa desligado e pode ser ativado/desativado;
- `Girar tela` alterna Automática, Horizontal, Vertical lado A e Vertical lado B;
- a orientação é salva na própria TV e não é enviada à API;
- a configuração da API pode ser redefinida pelo botão **Reconectar**.

Keystores de release, APKs e AABs são artefatos privados e estão bloqueados pelo `.gitignore`.

## Estrutura do repositório

```text
apps/
├── api/          API Express, Prisma e migrations
├── dashboard/    painel administrativo Next.js
└── player/       aplicativo Expo/React Native para Android TV
packages/
└── types/        contratos TypeScript compartilhados
scripts/windows/  instalação, execução, backup e diagnóstico
storage/          mídias locais; não versionado
docs/             arquitetura, operação e decisões
```

A geração de APK usa exclusivamente `apps/player/android`. As pastas locais
`apk/` e `apps/tv-apk/` pertenciam a builds antigos e ficam ignoradas para
evitar que artefatos ou o player WebView legado voltem a ser confundidos com
o aplicativo atual.

## Segurança e limites do MVP

- O sistema usa HTTP porque opera somente na rede privada da loja.
- O dashboard usa senha local e cookie assinado; placeholders fazem a produção falhar de forma segura.
- A API exige um token administrativo nas rotas sensíveis.
- Tokens, senhas, banco, mídias, logs, backups, APKs e chaves não devem ser versionados.
- A TV recebe um token próprio no registro; listagens administrativas não expõem esse token.
- Acesso externo requer HTTPS e uma revisão do modelo de autenticação.

## Planejamento e documentação

- [Milestones e issues do GitHub](docs/14-GITHUB-MILESTONES.md)
- [Plano de APK e validação na STV-3000 Plus](docs/15-PLANO-APK-ANDROID-TV.md)
- [Guia de finalização para o Luna](docs/16-GUIA-LUNA-FINALIZACAO-AQUATV.md)
- [Instalação no PC da loja](INSTALACAO-PC-CHEFE.md)
- [Contexto atual para agentes](AGENTS.md)
- [CI no GitHub](.github/workflows/ci.yml)

Os documentos numerados de `docs/01` a `docs/13` preservam decisões e planos anteriores; alguns descrevem a arquitetura WebView/Hostinger abandonada e devem ser lidos como histórico. O estado executável atual está neste README, no `AGENTS.md` e no guia de milestones.

## Origem, compatibilidade e direitos

Developed to solve a real production retail problem. Os registros anteriores documentam teste em hardware; soak, reboot, codecs e aceite operacional continuam exigindo o dispositivo real. Um build local não comprova esses resultados.

O repositório foi encontrado público, embora a documentação anterior o descrevesse como projeto privado do cliente, mantido por Pedro Braga. Esta manutenção não altera titularidade, atribuições ou licença: revisar os direitos sobre código e ativos antes de promovê-lo como projeto-base distribuível.

IDs Android, namespaces `@aquatv`, chaves de armazenamento, cookie e scripts mantêm nomes legados para preservar atualizações, sessões e configurações existentes. O nome apresentado no dashboard é configurável. Assets nativos e assinatura de release exigem uma migração separada, validada no hardware.
