# 06 — Device Setup (STV-3000 Plus) [INCOMPLETO]

## Hardware

**Aquário STV-3000 Plus**

- Android TV 11 (oficial, com Leanback)
- Kernel 5.4.125
- Patch de segurança: 2021-10-01 (desatualizado mas OK pro uso fechado)
- Build: `RD2A.211001.002.R3.20250320 release-keys`
- Launcher padrão do vendor: "Aquário V5.5.5"
- OTA version: 904111003097
- Storage interno: ~16GB (tratar como capacidade máxima do player)

## Política de espaço no device (MVP)

- Cache local limitado a **playlist ativa + fallback**
- Alertar quando uso de disco passar de **70%**
- Marcar crítico quando uso de disco passar de **85%**
- Limpar automaticamente arquivos órfãos ou sem uso no cache local
- Meta operacional: manter pelo menos **2GB livres** no STV-3000 Plus

## Estado do app Android — 2026-04-28

O app Android real ainda nao foi instalado na STV-3000. O que ja existe em `apps/player`:

- tipos compartilhados para device, heartbeat, playlist atual, logs e releases;
- cliente API tipado;
- manifesto local de cache;
- planner de sync que decide quais midias baixar e quais remover antes de trocar a playlist ativa.

Ainda falta implementar a camada Expo/Android:

- storage real com `expo-file-system`;
- MD5 com `expo-crypto`;
- player visual com `expo-video` ou fallback `react-native-video`;
- manifest Android TV/Leanback;
- PackageInstaller para auto-update;
- teste fisico na STV-3000 Plus.

## Passos de setup — primeira vez

### 1. Desativar atualizações automáticas do vendor (**CRÍTICO**)

**Sintoma se não fizer**: vendor pode pushar OTA que reseta "fontes desconhecidas" ou configurações de orientação.

- Configurações → Sobre → Atualização de Software
- Desativar "Verificar atualizações automaticamente"
- Se possível, desativar notificação também

### 2. Ativar modo desenvolvedor

- Configurações → Sobre → clica 7× em "Build" / "Versão do SO do Android TV"
- "Você agora é um desenvolvedor" aparece

### 3. Ativar depuração USB e ADB via rede

- Configurações → Opções do desenvolvedor
- ☑ Depuração USB
- ☑ Depuração sem fio / ADB via rede (se disponível)
- Anote a porta (geralmente 5555)

### 4. Ativar fontes desconhecidas

- Configurações → Segurança e restrições
- ☑ Fontes desconhecidas (permitir cada app individualmente quando solicitado)

### 5. Explorar item "Android TV as config"

**Pendente de investigação** — esse item no menu "Sobre" pode ser um switch entre modo Android TV (Leanback) e modo tablet/phone. Se permitir mudar, simplifica muito (tira o Leanback, portrait vira nativo).

**Pedro, antes de começar Fase 2: entra nesse menu e me conta o que tem.**

### 6. Configurar rede

- Wi-Fi da loja configurado
- Verificar velocidade: idealmente ≥ 10 Mbps pra download de vídeos
- Anotar IP local pra ADB: `adb connect <ip>:5555`

### 7. Ajustes de exibição

- Configurações → Dispositivo → Display
- Resolução: 1080p 60Hz
- Orientação: se menu existir, portrait. Se não, usar `wm rotation` via ADB:
  ```
  adb shell settings put system accelerometer_rotation 0
  adb shell settings put system user_rotation 1
  ```
- Screen saver: desativar (loop contínuo do app cobre)
- Modo de economia de energia: desativar

### 8. Configurar auto-start

Duas estratégias, escolher uma:

**A) App AquaTV como launcher (recomendado)**

- Após instalar APK, Android pergunta qual launcher usar
- Selecionar AquaTV como default
- Benefício: boot direto, auto-restart grátis, botão Home volta pro app

**B) BOOT_COMPLETED receiver + launcher vendor**

- AquaTV lida ao boot via BroadcastReceiver
- Launcher Aquário continua como home
- Usuário vê tela do launcher por alguns segundos antes de abrir AquaTV

Escolha A é mais simples e robusta. Escolhida no plano.

---

## Instalação da APK

### Primeira instalação: via pendrive

1. Copiar `aquatv-v1.0.0.apk` pra um pendrive FAT32
2. Plugar pendrive na STV-3000
3. Abrir app "File Manager" do launcher (ou baixar "X-plore" se não tiver)
4. Navegar até pendrive, clicar na APK
5. Aceitar "Fontes desconhecidas"
6. Instalar
7. Abrir o app
8. Inserir device token (obtido do dashboard ao registrar o device)
9. Selecionar AquaTV como launcher padrão

### Instalações subsequentes: via auto-update

Uma vez instalado, o app cuida de atualizações sozinho via `REQUEST_INSTALL_PACKAGES`:

1. App checa `/api/app/latest` no boot
2. Compara versionCode local × remoto
3. Se remoto for maior, baixa APK
4. Valida MD5
5. Chama `PackageInstaller.createSession()` + `commit()`
6. Android reinstala (mantém dados)
7. App reinicia

### Fallback: ADB via rede

Se auto-update falhar e Pedro estiver fora da loja:

```bash
adb connect <tailscale-ou-ip-publico>:5555
adb install -r aquatv-v1.1.0.apk
```

Requer VPN/Tailscale pra chegar até a TV Box atrás do NAT do router da loja.

---

## Checklist pós-setup

Antes de considerar o device "em produção":

- [ ] OTA automático desativado
- [ ] Wi-Fi estável (24h sem cair)
- [ ] Device token inserido e heartbeat chegando no dashboard
- [ ] APK instalado e rodando
- [ ] AquaTV é launcher default
- [ ] Vídeo de teste baixou e tá tocando em loop
- [ ] Orientação portrait travada
- [ ] Sem som (mute)
- [ ] Reboot completo: app abre sozinho em < 60s
- [ ] Auto-update testado (sobe APK +1 patch, confirma que baixa + instala)
- [ ] Cache local respeita política (ativa + fallback) e mantém folga de disco

---

## Troubleshooting

### TV Box não tá aparecendo como online no dashboard

1. Conferir se Wi-Fi da loja tá conectado (sair do AquaTV temporariamente, ver status no launcher)
2. Conferir se device token está correto no app
3. `adb logcat | grep AquaTV` via rede pra ver erros
4. Conferir se endpoint `/api/devices/:id/heartbeat` tá respondendo 200

### Vídeo não tá tocando / tela preta

1. Conferir se MP4 baixou completo (tamanho bate?)
2. Conferir MD5 (tá corrompido?)
3. Testar o mesmo MP4 abrindo no VLC do Android (tem codec suportado?)
4. Se `expo-video` falhar: recompilar com `react-native-video`

### Orientação voltou a landscape

Provavelmente vendor OTA resetou. Aplicar:

```
adb shell settings put system accelerometer_rotation 0
adb shell settings put system user_rotation 1
```

E verificar `android:screenOrientation="portrait"` no manifest da APK.

### App não abre no boot

1. Confirmar que AquaTV é launcher default
2. Confirmar `RECEIVE_BOOT_COMPLETED` permission concedida
3. Conferir que não tem Doze/App Standby matando o app (desativar em configs do device)

### Disco cheio

1. Dashboard alerta em dois níveis: 70% (warn) e 85% (crítico)
2. Player remove arquivos fora da playlist ativa/fallback e revalida espaço livre
3. Se ainda insuficiente, forçar sync com catálogo mínimo (ativa + fallback)
4. Manual via ADB: `adb shell rm -rf /sdcard/Android/data/com.aquatv.player/files/media/*`
