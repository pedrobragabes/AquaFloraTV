# 06 — Configuração do dispositivo (STV-3000 Plus)

Este é o procedimento atual para instalar e operar o player **AquaTV** na
STV-3000 Plus. A arquitetura vigente é local: o PC da loja hospeda o
dashboard e a API, e a TV Box acessa a API pela rede privada.

## Hardware conhecido

- Android TV 11 com Leanback;
- launcher do fabricante: Aquário V5.5.5;
- armazenamento interno de aproximadamente 16 GB;
- TV Box usada em modo de sinalização, sem necessidade de acesso público.

## Endereços da instalação atual

| Serviço       | Endereço                           |
| ------------- | ---------------------------------- |
| Dashboard     | `http://192.168.0.114:7740`        |
| API do player | `http://192.168.0.114:7741/api`    |
| Health check  | `http://192.168.0.114:7741/health` |

O endereço `192.168.0.114` é a configuração atual da loja, não um valor
embutido no aplicativo. Em outra rede, informe o endereço correspondente na
tela inicial do player.

## Preparar a rede e o PC

1. Conecte o PC e a TV Box à mesma rede Wi-Fi ou Ethernet privada.
2. Confirme no PC que a rede do Windows está marcada como **Privada**.
3. Inicie o AquaTV com `iniciar-aquatv.bat` e confirme a saúde com
   `diagnostico-aquatv.bat`.
4. Abra o firewall somente para a sub-rede local com `liberar-firewall.bat`.
5. No navegador do PC, valide o dashboard em `http://192.168.0.114:7740`.

Se a API não responder, corrija o PC e a rede antes de mexer no APK. Não use
`localhost` na TV Box: nesse dispositivo, `localhost` aponta para a própria TV.

## Instalação inicial por pendrive

1. Gere e verifique o APK release assinado conforme
   [15-PLANO-APK-ANDROID-TV.md](15-PLANO-APK-ANDROID-TV.md).
2. Copie somente o APK para um pendrive FAT32.
3. Conecte o pendrive à STV-3000 Plus e abra o gerenciador de arquivos.
4. Se o Android pedir, permita a instalação para o gerenciador de arquivos.
5. Instale o APK. Para uma atualização, use **instalar por cima**; não
   desinstale antes de confirmar que a assinatura é compatível.
6. Abra **AquaTV** pelo launcher.
7. Na tela inicial, informe `192.168.0.114:7741` (ou a URL completa da API) e
   selecione **Conectar TV**.
8. Aguarde o cadastro automático e a primeira sincronização da playlist.

O aplicativo é `com.aquatv.player`, usa HOME/LEANBACK e não implementa
auto-update de APK. Atualizações futuras são instaladas manualmente com um
APK assinado pela mesma chave.

## Configuração no primeiro uso

### Orientação

A instalação começa em **Vertical — lado A** porque a TV será posicionada em
portrait. Segure OK/centro por aproximadamente 1,5 segundo em uma tela de
status ou playback para abrir o painel administrativo. O botão **Girar tela**
alterna:

1. Automática / sistema;
2. Horizontal;
3. Vertical — lado A (`90°`);
4. Vertical — lado B (`270°`).

A mesma opção existe antes do cadastro, na tela de setup. A escolha é salva
localmente na TV Box, permanece após **Reconectar** e é reaplicada no boot. Os
rótulos lado A/B são deliberadamente neutros até a confirmação física de qual
lado corresponde ao topo desejado.

### Áudio

O player inicia com o som desligado. No painel administrativo, use **Ativar
som** ou **Desativar som**. A preferência fica salva localmente; a mídia não
é alterada.

### Launcher e energia

O APK declara HOME e LEANBACK para poder ser escolhido como launcher. Se o
Android perguntar, escolha AquaTV somente depois de confirmar que o botão
Voltar do controle ainda permite retornar ao launcher para manutenção.

Desative protetores de tela e economia de energia que interrompam a
reprodução. Não é necessário configurar `RECEIVE_BOOT_COMPLETED`: o projeto
atual não usa receiver de boot nem instala APK sozinho.

## Matriz de aceite físico

Registrar data, versão do APK e resultado de cada item:

- [ ] instalação por cima da versão anterior sem erro de assinatura;
- [ ] cadastro/heartbeat aparecem no dashboard;
- [ ] Automática, Horizontal, Vertical lado A e Vertical lado B ficam legíveis;
- [ ] orientação permanece após fechar o app, reiniciar a TV Box e usar
      Reconectar;
- [ ] foco, OK longo, OK normal e Voltar funcionam em horizontal e portrait;
- [ ] som começa mudo e alterna corretamente;
- [ ] JPG, PNG, WebP e MP4 são reproduzidos sem corte ou deformação;
- [ ] playlist mantém ordem, duração e loop;
- [ ] cache continua reproduzindo com a rede desligada;
- [ ] sincronização retorna quando a rede volta;
- [ ] reboot retorna ao comportamento esperado;
- [ ] logo, nome AquaFlora Agroshop, splash, ícone e banner aparecem;
- [ ] soak de 48 horas concluído (pendente até haver registro);
- [ ] backup externo e restauração testados (pendente até haver registro).

O teste inicial de instalação e reprodução foi reportado como aprovado em
4 de agosto de 2026. Isso não substitui os itens ainda não executados acima.

## Diagnóstico rápido

### TV não aparece online

1. Confira se o PC ainda está em `192.168.0.114` e na rede privada.
2. Abra `http://192.168.0.114:7741/health` em outro dispositivo da mesma rede.
3. No painel do player, confirme a URL da API e use **Reconectar**.
4. Rode `diagnostico-aquatv.bat` no PC e verifique o firewall.

### Tela preta ou mídia sem reprodução

1. Confira no dashboard se a playlist está ativa e contém mídia.
2. Use **Sincronizar agora** no painel administrativo.
3. Confirme que a mídia foi baixada e que há espaço livre na TV Box.
4. Teste o arquivo no VLC para separar problema de codec de problema do app.
5. Preserve a evidência e o nome do arquivo antes de trocar o APK.

### Orientação não muda

1. Aguarde a mensagem de aplicação no painel.
2. Tente Automática e depois os dois modos verticais.
3. Reinicie a TV Box para confirmar se o firmware aceitou o lock nativo.
4. Se somente um portrait funcionar, registre o sentido físico e use esse
   modo; não aplique `wm rotation` como correção permanente sem evidência.

### Atualização recusada

Pare e não desinstale o aplicativo. Verifique o pacote
`com.aquatv.player`, o `versionCode` maior e o digest do certificado com
`apksigner`. Uma instalação que exige desinstalação indica APK incompatível
com o instalado e pode apagar credenciais e cache.

## Manutenção e segurança

- mantenha pelo menos 2 GB livres na TV Box;
- não coloque APK, keystore, senha, token, banco, mídia, logs ou backups no
  Git;
- execute `backup-agora.bat` e copie o ZIP para outro equipamento ou mídia;
- não use comandos destrutivos para limpar o cache sem registrar a evidência;
- faça mudanças de firmware, launcher ou permissões somente com a TV Box
  disponível para teste.

O plano completo de release e a definição de pronto estão em
[16-GUIA-LUNA-FINALIZACAO-AQUATV.md](16-GUIA-LUNA-FINALIZACAO-AQUATV.md).
