# AquaTV

Digital signage próprio para a **Aquaflora Grow Shop**. O AquaTV permite que a loja envie imagens e vídeos, organize playlists, programe conteúdos e acompanhe a TV sem depender de uma assinatura mensal.

O MVP foi desenhado para operar na rede local: o dashboard, a API, o banco e os arquivos ficam no PC da loja; a STV-3000 Plus usa um app Android TV dedicado, com cache para continuar reproduzindo durante falhas de rede.

## Estado do projeto

Em 31 de julho de 2026, a reescrita principal está concluída e validada:

- dashboard responsivo com login, conteúdos, playlists, programação e TVs;
- API protegida para operações administrativas;
- upload validado de MP4, JPG, PNG e WebP, com limite configurável;
- playlist padrão, pausa global e agendamentos, inclusive durante a madrugada;
- player Expo/React Native TV com cache transacional e fallback offline;
- polling com backoff, heartbeat e recuperação de travamentos de vídeo;
- instalação, inicialização, diagnóstico, firewall, backup e smoke test para Windows;
- 14 testes automatizados e 16 verificações no smoke de integração.

O código está pronto como candidato de go-live. A publicação definitiva depende da configuração do PC, do APK assinado e do teste físico na STV-3000 Plus. O acompanhamento está detalhado em [Milestones e issues](docs/14-GITHUB-MILESTONES.md).

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
- Node.js 20.9 ou superior;
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

## Desenvolvimento

```bash
corepack pnpm@11.11.0 install --frozen-lockfile
pnpm dev
```

Comandos de qualidade:

```bash
pnpm peers check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm format
```

Smoke completo no Windows, usando banco e portas isolados:

```powershell
.\scripts\windows\smoke-aquatv.ps1
```

Os logs do smoke são criados em `logs/integration-smoke-*` e permanecem fora do Git.

## Player Android TV

Configure `apps/player/.env` com o endereço real do PC da loja, nunca com `localhost`:

```env
API_URL=http://IP-DO-PC:7741/api
```

Para desenvolvimento:

```bash
pnpm --filter @aquatv/player dev
```

Para gerar um release é necessário instalar o Android SDK e fornecer as quatro credenciais de assinatura esperadas pelo Gradle:

- `AQUATV_RELEASE_STORE_FILE`;
- `AQUATV_RELEASE_STORE_PASSWORD`;
- `AQUATV_RELEASE_KEY_ALIAS`;
- `AQUATV_RELEASE_KEY_PASSWORD`.

Depois:

```powershell
cd apps\player\android
.\gradlew.bat assembleRelease
```

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

## Segurança e limites do MVP

- O sistema usa HTTP porque opera somente na rede privada da loja.
- O dashboard usa senha local e cookie assinado; placeholders fazem a produção falhar de forma segura.
- A API exige um token administrativo nas rotas sensíveis.
- Tokens, senhas, banco, mídias, logs, backups, APKs e chaves não devem ser versionados.
- A TV recebe um token próprio no registro; listagens administrativas não expõem esse token.
- Acesso externo requer HTTPS e uma revisão do modelo de autenticação.

## Planejamento e documentação

- [Milestones e issues do GitHub](docs/14-GITHUB-MILESTONES.md)
- [Arquitetura](docs/02-ARQUITETURA.md)
- [Stack e decisões técnicas](docs/03-STACK.md)
- [Roadmap](docs/05-ROADMAP.md)
- [Configuração do dispositivo](docs/06-DEVICE-SETUP.md)
- [Deploy e operação](docs/07-DEPLOY.md)
- [Modelo de dados](docs/08-DATA-MODEL.md)
- [API](docs/09-API.md)
- [Decisões](docs/11-DECISOES.md)

## Licença e autoria

Projeto privado da Aquaflora Grow Shop, mantido por Pedro Braga.
