# Instalação do AquaTV no PC da loja

Este é o guia operacional para preparar o PC Windows que hospeda o dashboard, a API, o banco SQLite e as mídias da AquaFlora Agroshop.

## Antes de começar

Confirme:

- Windows 10 ou 11 atualizado;
- Node.js 22.13 ou superior instalado;
- acesso de administrador ao Windows e ao roteador;
- PC conectado à rede da loja por cabo, quando possível;
- STV-3000 Plus na mesma rede;
- uma pasta definitiva para o projeto, que não será movida depois.

Não use o APK ou o player WebView antigos. O player atual está em `apps/player` e precisa de um APK release assinado com a keystore privada `aquatv-release-v2.jks`.

## 1. Preparar o projeto

Na raiz, dê duplo clique em:

```text
instalar-dependencias.bat
```

O instalador:

1. verifica Node.js e Corepack;
2. usa pnpm 11.11.0;
3. pede uma senha administrativa de pelo menos 12 caracteres;
4. gera tokens e segredo de sessão sem exibi-los;
5. cria backup antes de migrar um banco existente;
6. aplica migrations e seed;
7. compila API e dashboard.

Os segredos ficam somente em `apps/api/.env` e `apps/dashboard/.env`. Nunca copie o conteúdo desses arquivos para issues, commits ou mensagens.

## 2. Iniciar e diagnosticar

Execute:

```text
iniciar-aquatv.bat
```

Depois confira:

- dashboard: `http://localhost:7740/dashboard`;
- API: `http://localhost:7741/health`.

Para conferir portas, processos, IP, perfil de rede e URLs configuradas:

```text
diagnostico-aquatv.bat
```

Para encerrar:

```text
parar-aquatv.bat
```

## 3. Fixar o endereço do PC

A TV precisa encontrar sempre o mesmo IP. A opção preferida é criar uma **reserva DHCP** no roteador usando o endereço MAC do PC. IP estático no Windows também funciona, desde que fique fora da faixa distribuída automaticamente pelo roteador.

Depois, crie `apps/player/.env` a partir do exemplo:

```env
API_URL=http://IP-DO-PC:7741/api
```

Substitua `IP-DO-PC` pelo endereço reservado. `localhost` não funciona na TV, pois apontaria para a própria TV box.

## 4. Proteger e liberar a rede local

Abra as propriedades da conexão ativa no Windows e confirme que o perfil está como **Privado**. O script aborta se encontrar uma rede pública ativa.

Depois execute como administrador:

```text
liberar-firewall.bat
```

As regras liberam as portas 7740 e 7741 somente no perfil Privado e somente para `LocalSubnet`.

Em outro aparelho da mesma rede, teste:

```text
http://IP-DO-PC:7740/dashboard
http://IP-DO-PC:7741/health
```

## 5. Iniciar automaticamente com o Windows

Execute como administrador:

```text
instalar-inicializacao.bat
```

A tarefa `AquaTV Local Server` roda no boot como `SYSTEM`, sem depender de login. Reinicie o PC e confirme que dashboard e health check voltam sozinhos.

Para remover a tarefa:

```text
remover-inicializacao.bat
```

## 6. Configurar e testar backup

Primeiro faça um backup manual:

```text
backup-agora.bat
```

O ZIP é publicado em `backups/` somente depois de validar o snapshot do banco, as referências de mídia e a leitura do arquivo compactado.

Depois execute como administrador:

```text
instalar-backup-diario.bat
```

A tarefa `AquaTV Local Backup` roda diariamente às 03:00 e mantém 14 dias por padrão.

O diretório `backups/` ainda está no mesmo PC. Configure também uma cópia para outro computador, NAS ou mídia externa e faça uma restauração de teste antes de considerar o backup concluído.

## 7. Gerar o APK nativo

Instale Android Studio/SDK e configure `ANDROID_HOME` ou `apps/player/android/local.properties`.

Crie um keystore novo e guarde-o fora do repositório. Configure no ambiente ou em `~/.gradle/gradle.properties`:

```text
AQUATV_RELEASE_STORE_FILE=C:\caminho\privado\aquatv-release.jks
AQUATV_RELEASE_STORE_PASSWORD=SEGREDO
AQUATV_RELEASE_KEY_ALIAS=aquatv
AQUATV_RELEASE_KEY_PASSWORD=SEGREDO
```

Gere o release:

```powershell
cd apps\player\android
.\gradlew.bat assembleRelease
```

Antes de instalar, calcule o hash:

```powershell
Get-FileHash .\app\build\outputs\apk\release\app-release.apk -Algorithm SHA256
```

APKs e keystores são ignorados pelo Git. A chave legada que já apareceu no histórico do repositório deve ser considerada exposta e nunca reutilizada.

## 8. Aceite na STV-3000 Plus

Na TV box:

1. instale o APK por ADB ou pendrive;
2. configure a URL do PC;
3. registre o dispositivo;
4. teste o controle remoto;
5. reproduza MP4 H.264/AAC, JPG, PNG e WebP usados pela loja;
6. teste landscape e portrait;
7. pause e retome pelo dashboard;
8. desligue a rede e confirme o cache offline;
9. reinicie TV e PC;
10. valide HOME/launcher/kiosk conforme o firmware permitir.

O checklist completo está na [issue #11](https://github.com/pedrobragabes/AquaFloraTV/issues/11).

## Solução rápida de problemas

### Dashboard não abre

1. Execute `diagnostico-aquatv.bat`.
2. Confira se as portas 7740 e 7741 estão ouvindo.
3. Pare e inicie novamente.
4. Leia os arquivos em `logs/`.

### Funciona no PC, mas não em outro aparelho

1. Confirme o IP atual.
2. Confirme que a rede está como Privada.
3. Execute `liberar-firewall.bat` como administrador.
4. Confirme que os aparelhos estão na mesma sub-rede e sem isolamento de clientes no Wi-Fi.

### TV não sincroniza

1. Confirme que `API_URL` usa o IP atual e termina em `/api`.
2. Abra `http://IP-DO-PC:7741/health` em outro aparelho.
3. Abra o menu administrativo do player e confira a URL.
4. Exclua o dispositivo no dashboard e registre novamente somente se o token tiver sido perdido.

### Atualização quebrou o banco

Não use `prisma db push`. Pare os serviços, preserve o banco atual e restaure um backup validado. A preparação normal usa `prisma migrate deploy` e cria backup antes de alterar um banco existente.

## Critério de instalação concluída

- [ ] PC reinicia e os serviços sobem sem login.
- [ ] Dashboard abre no PC e em outro aparelho da LAN.
- [ ] Firewall está limitado a perfil Privado e sub-rede local.
- [ ] Backup manual e tarefa diária foram testados.
- [ ] Existe cópia do backup fora do PC.
- [ ] APK release novo está assinado e seu SHA-256 foi registrado.
- [ ] STV-3000 toca a playlist, funciona offline e se recupera após reboot.
- [ ] Diego aprovou a operação e a aparência.
