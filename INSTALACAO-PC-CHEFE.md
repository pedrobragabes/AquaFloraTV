# Instalacao do AquaTV no PC do chefe

Este guia e para clonar o repositorio no PC da loja e deixar o AquaTV rodando localmente no IP fixo:

```text
192.168.0.114
```

URLs finais esperadas:

- Dashboard: `http://192.168.0.114:7740/dashboard`
- Player da TV: `http://192.168.0.114:7740/player?rotation=90`
- API health: `http://192.168.0.114:7741/health`

## 1. Premissas obrigatorias

- O PC da loja precisa manter o IP `192.168.0.114`.
- O PC e a TV Box precisam estar na mesma rede local.
- O Windows precisa liberar as portas `7740` e `7741`.
- Node.js LTS precisa estar instalado.
- Git precisa estar instalado.
- O repositorio oficial e `git@github.com:pedrobragabes/AquaFloraTV.git`.

Se o IP do PC mudar, a TV pode abrir o dashboard mas nao conseguir falar com a API. Primeiro fixe o IP no roteador ou no Windows.

## 2. Prompt para colar na IA do PC da loja

Use este texto se for pedir para outra IA operar no PC do chefe:

```text
Voce esta no PC da loja. Configure o AquaTV local-first no Windows usando o IP fixo 192.168.0.114.

Repositorio: git@github.com:pedrobragabes/AquaFloraTV.git
Branch: main
Pasta sugerida: C:\Users\pedro\Documents\Projetos\AquaFlora\AquaFloraTV

Objetivo:
1. Clonar ou atualizar o repo.
2. Instalar dependencias com pnpm.
3. Criar apps/api/.env, apps/dashboard/.env e apps/dashboard/.env.local.
4. Liberar firewall nas portas 7740 e 7741.
5. Subir o sistema com scripts Windows.
6. Validar:
   - http://192.168.0.114:7741/health responde 200
   - http://192.168.0.114:7740/dashboard abre
   - http://192.168.0.114:7740/player?rotation=90 abre na TV
   - a pagina /devices mostra heartbeat do player
7. Se aparecer 502/503, rodar diagnostico-aquatv.bat e ler logs/.

Nao trocar o IP para localhost. Nao usar portas 3000/3001. Nao fazer force push.
```

## 3. Clone ou atualizacao

Abrir PowerShell normal:

```powershell
mkdir C:\Users\pedro\Documents\Projetos\AquaFlora -Force
cd C:\Users\pedro\Documents\Projetos\AquaFlora
git clone git@github.com:pedrobragabes/AquaFloraTV.git
cd .\AquaFloraTV
git switch main
git pull origin main
```

Se o repo ja existir:

```powershell
cd C:\Users\pedro\Documents\Projetos\AquaFlora\AquaFloraTV
git status --short
git switch main
git pull origin main
```

Se `git pull` reclamar de arquivos modificados, nao apagar nada sem antes salvar ou perguntar.

## 4. Instalar dependencias

Na raiz do repo:

```powershell
.\instalar-dependencias.bat
```

Ou manual:

```powershell
corepack enable
corepack prepare pnpm@10.0.0 --activate
pnpm install
```

## 5. Arquivos de ambiente

Gerar um token compartilhado para API e dashboard. No PowerShell:

```powershell
$ApiAdminToken = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | ForEach-Object {[char]$_})
$JwtSecret = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | ForEach-Object {[char]$_})
$SessionSecret = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | ForEach-Object {[char]$_})
$DashboardSecret = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | ForEach-Object {[char]$_})
$ApiAdminToken
```

Criar `apps/api/.env` com o mesmo valor gerado em `$ApiAdminToken`:

```env
PORT=7741
DATABASE_URL=file:./dev.db
JWT_SECRET=COLE_AQUI_O_JWT_SECRET_64_CHARS
SESSION_SECRET=COLE_AQUI_O_SESSION_SECRET_64_CHARS
API_ADMIN_TOKEN=COLE_AQUI_O_API_ADMIN_TOKEN_64_CHARS
STORAGE_PATH=./storage
MAX_UPLOAD_MB=300
STORAGE_WARN_PCT=70
STORAGE_CRITICAL_PCT=85
MEDIA_RETENTION_DAYS=45
ALLOWED_ORIGINS=http://192.168.0.114:7740,http://localhost:7740
ADMIN_EMAILS=pedrobraga855@gmail.com
```

Criar `apps/dashboard/.env` com:

```env
API_INTERNAL_URL=http://192.168.0.114:7741
NEXT_PUBLIC_API_URL=http://192.168.0.114:7741
API_ADMIN_TOKEN=COLE_AQUI_O_MESMO_API_ADMIN_TOKEN_DA_API
```

Criar `apps/dashboard/.env.local` com:

```env
DASHBOARD_AUTH_ENABLED=true
DASHBOARD_ADMIN_PASSWORD=TROCAR_POR_SENHA_FORTE
DASHBOARD_SESSION_SECRET=COLE_AQUI_O_DASHBOARD_SECRET_64_CHARS
DASHBOARD_COOKIE_SECURE=false
```

Importante:

- `API_ADMIN_TOKEN` precisa ser identico em `apps/api/.env` e `apps/dashboard/.env`.
- `ALLOWED_ORIGINS` nao deve ser `*` em producao, porque a API bloqueia isso.
- `NEXT_PUBLIC_API_URL` e `API_INTERNAL_URL` nao devem ser `localhost` no PC da loja.
- Se `DASHBOARD_ADMIN_PASSWORD` faltar em producao, o login pode responder `503`.
- `DASHBOARD_COOKIE_SECURE=false` e correto para HTTP local sem HTTPS.

## 6. Liberar firewall

Abrir pelo arquivo:

```powershell
.\liberar-firewall.bat
```

Ele deve pedir permissao de administrador. Se preferir PowerShell como Administrador:

```powershell
.\scripts\windows\configure-firewall.ps1
```

Portas liberadas:

- `7740`: dashboard/player Next.js
- `7741`: API Express

## 7. Subir o AquaTV

Modo visivel, bom para debug:

```powershell
.\iniciar-aquatv.bat
```

Modo segundo plano:

```powershell
.\iniciar-aquatv-segundo-plano.bat
```

Depois testar:

```powershell
.\diagnostico-aquatv.bat
```

O diagnostico deve mostrar:

- API local OK
- API pelo IP fixo OK
- Dashboard local OK
- Dashboard pelo IP fixo OK
- Player pelo IP fixo OK
- portas `7740` e `7741` OK

## 8. Abrir dashboard e player

No PC:

```powershell
.\abrir-dashboard.bat
```

Na TV Box ou no navegador dela:

```text
http://192.168.0.114:7740/player?rotation=90
```

Se ficar virado para o lado errado:

- testar `http://192.168.0.114:7740/player?rotation=270`
- ou usar o botao `Girar` no canto superior direito do player

A rotacao fica salva no navegador da TV.

## 9. Registrar para iniciar com Windows

Quando tudo estiver validado:

```powershell
.\instalar-inicializacao.bat
```

Depois reiniciar o PC e validar de novo:

```powershell
.\diagnostico-aquatv.bat
```

## 10. Backup

Backup manual:

```powershell
.\backup-agora.bat
```

Registrar backup diario:

```powershell
.\instalar-backup-diario.bat
```

Os backups ficam na pasta `backups/`.

## 11. Checklist final na loja

- [ ] PC esta no IP `192.168.0.114`
- [ ] `http://192.168.0.114:7741/health` responde `200`
- [ ] `http://192.168.0.114:7740/dashboard` abre
- [ ] login funciona com a senha configurada
- [ ] upload de midia funciona
- [ ] playlist default esta configurada
- [ ] `http://192.168.0.114:7740/player?rotation=90` abre na TV
- [ ] TV aparece em `/devices`
- [ ] heartbeat atualiza em `/devices`
- [ ] orientacao esta vertical correta
- [ ] firewall liberado
- [ ] inicializacao no Windows registrada
- [ ] backup diario registrado

## 12. Troubleshooting rapido

### 502 ou 503 no dashboard

1. Rodar:

   ```powershell
   .\diagnostico-aquatv.bat
   ```

2. Verificar se `apps/api/.env` existe e tem `JWT_SECRET`, `SESSION_SECRET`, `API_ADMIN_TOKEN` e `ALLOWED_ORIGINS`.
3. Verificar se `apps/dashboard/.env` existe e tem `API_INTERNAL_URL`, `NEXT_PUBLIC_API_URL` e o mesmo `API_ADMIN_TOKEN`.
4. Verificar se `apps/dashboard/.env.local` existe e tem `DASHBOARD_ADMIN_PASSWORD`.
5. Verificar logs em `logs/` com:

   ```powershell
   .\abrir-logs.bat
   ```

6. Reiniciar tudo:

   ```powershell
   .\parar-aquatv.bat
   .\iniciar-aquatv-segundo-plano.bat
   ```

### TV nao conecta no servidor

1. Na TV, nao usar `localhost`.
2. Usar:

   ```text
   http://192.168.0.114:7740/player?rotation=90
   ```

3. No PC, testar:

   ```text
   http://192.168.0.114:7741/health
   ```

4. Se falhar, firewall ou IP estao errados.
5. Rodar `.\liberar-firewall.bat` como admin.

### Player abre, mas nao aparece em devices

1. Abrir o player na TV.
2. Esperar 30 segundos.
3. Abrir `http://192.168.0.114:7740/devices`.
4. Se nao aparecer, limpar dados/site storage do navegador da TV e abrir o player de novo.

### Orientacao errada

1. Testar `rotation=90`.
2. Se ficar para o lado oposto, testar `rotation=270`.
3. Se precisar voltar ao normal, usar `rotation=0`.

URLs:

```text
http://192.168.0.114:7740/player?rotation=90
http://192.168.0.114:7740/player?rotation=270
http://192.168.0.114:7740/player?rotation=0
```

### Pagina sem CSS ou comportamento antigo

1. Parar processos antigos:

   ```powershell
   .\parar-aquatv.bat
   ```

2. Iniciar de novo:

   ```powershell
   .\iniciar-aquatv-segundo-plano.bat
   ```

3. Na TV, limpar cache do navegador ou abrir a URL com `?rotation=90`.

## 13. Comandos de validacao tecnica

Na raiz do repo:

```powershell
pnpm --filter @aquatv/dashboard typecheck
pnpm --filter @aquatv/dashboard lint
pnpm --filter @aquatv/dashboard build
pnpm --filter @aquatv/api typecheck
pnpm --filter @aquatv/api build
```

Se Prisma reclamar depois do clone:

```powershell
pnpm --filter @aquatv/api exec prisma generate --schema prisma/schema.prisma
```

## 14. Estado esperado apos tudo pronto

```text
PC da loja 192.168.0.114
  Dashboard Next.js: http://192.168.0.114:7740
  API Express:       http://192.168.0.114:7741
  SQLite:            apps/api/prisma/dev.db
  Midias:            storage/media

TV Box
  Abre: http://192.168.0.114:7740/player?rotation=90
  Registra device
  Envia heartbeat
  Toca playlist default
```
