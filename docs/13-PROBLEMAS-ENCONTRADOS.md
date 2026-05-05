# Revisão de Código — Problemas Encontrados

**Data:** 2026-05-05  
**Revisão:** estática (sem instalar dependências, sem executar runtime)  
**Cobertura:** todos os pacotes do monorepo (`apps/api`, `apps/dashboard`, `apps/tv-apk`, `apps/player`, `packages/types`, `packages/api-client`, `scripts/`)

---

## Sumário executivo

Foram encontrados **40+ problemas** distribuídos em quatro graus de severidade. Os três mais graves comprometem diretamente a segurança e a funcionalidade principal do produto:

1. **Nenhum endpoint da API exige autenticação** — qualquer dispositivo na rede pode fazer upload, deletar mídia, ou publicar uma APK maliciosa na TV.
2. **Agendamento contextual não está implementado** — o diferencial central do produto retorna sempre a playlist padrão, independente de qualquer regra configurada.
3. **Keystore de produção com senhas em texto plano no repositório** — qualquer pessoa com acesso ao repo pode assinar APKs e forçar instalação na TV.

---

## 🔴 Críticos — exploráveis imediatamente

### C1 · API completamente aberta (zero autenticação)

**Arquivos:** `apps/api/src/middlewares/require-admin.ts`, `apps/api/src/routes/index.ts`

`requireAdmin` é um stub que chama `next()` incondicionalmente e nem sequer está montado nos routers:

```ts
// require-admin.ts
export function requireAdmin(_req: Request, _res: Response, next: NextFunction): void {
  next(); // faz nada
}
```

O `authRouter` existe em `routes/auth.ts` mas nunca é importado nem montado em `routes/index.ts`. Resultado: todos os endpoints são públicos.

**Impacto:** upload, deleção e listagem de mídia; cadastro de devices; upload de APK; force-sync — qualquer máquina na rede pode fazer tudo.

---

### C2 · Dashboard sem proteção de rotas

**Arquivo:** `apps/dashboard/middleware.ts`

O middleware do Next.js retorna `NextResponse.next()` sem verificar autenticação:

```ts
export function middleware() {
  return NextResponse.next(); // nenhuma verificação
}
```

O proxy em `app/api/proxy/[...path]/route.ts` valida o cookie corretamente, mas todas as páginas do dashboard chamam a API diretamente via `resolveApiBaseUrl()` (porta 7741) — sem passar pelo proxy. O mecanismo de auth do proxy nunca é ativado.

**Impacto:** todas as páginas do dashboard acessíveis sem login.

---

### C3 · Agendamento contextual nunca implementado

**Arquivo:** `apps/api/src/services/schedule-resolution.ts`

A função que deveria resolver a playlist ativa pelo horário ignora completamente a tabela `Schedule`:

```ts
export async function resolveCurrentPlayback(): Promise<ResolvedPlayback> {
  const config = await prisma.globalConfig.findUnique({ where: { id: 'singleton' } });
  if (!config?.defaultPlaylistId) return { playlist: null };
  return { playlist: await findDefaultPlaylist(config.defaultPlaylistId) };
}
```

Além disso, a rota `GET /api/schedules` retorna `activeSchedule: null` hardcoded (linha 91–93 de `routes/schedules.ts`).

**Impacto:** o diferencial central do produto — agendamento por dia/hora — não funciona. Configurar qualquer regra de agendamento não tem efeito nenhum.

---

### C4 · Keystore de produção com senhas no repositório

**Arquivo:** `apps/tv-apk/app/build.gradle` (linhas 26–33)

```groovy
signingConfigs {
  release {
    storeFile file("../aquatv-local-release.jks")
    storePassword "aquatv-local-release"
    keyAlias "aquatv"
    keyPassword "aquatv-local-release"
  }
}
```

O arquivo `.jks` e a senha estão commitados. Qualquer pessoa com acesso ao repositório pode assinar APKs com a chave de produção.

---

### C5 · Bypass da verificação de integridade da APK

**Arquivo:** `apps/tv-apk/app/src/main/java/com/aquatv/player/MainActivity.java` (linha 193)

```java
if (!expectedSha.isEmpty() && !actualSha.equalsIgnoreCase(expectedSha)) {
```

Se `expectedSha` estiver vazio (campo nulo no banco), a verificação é pulada e a APK é instalada sem checar integridade. Combinado com o endpoint de upload sem autenticação (C1), isso cria um vetor direto para instalar APK arbitrária na TV.

---

### C6 · Campo `apkMd5` armazena SHA-256

**Arquivos:** `apps/api/src/routes/app-releases.ts` (linha 215), `apps/api/prisma/schema.prisma`, `packages/types/src/index.ts`

```ts
// app-releases.ts
const sha256 = createHash('sha256').update(buffer).digest('hex');
// ...
apkMd5: sha256,  // nome errado — armazena SHA-256, não MD5
```

O campo se chama `apkMd5` em todo o stack (banco, tipo compartilhado, API, Java). O valor real é SHA-256. A confusão não quebra o sistema hoje porque a TV também lê o mesmo campo — mas qualquer validação cruzada ou ferramenta externa vai calcular MD5 e comparar com SHA-256, falhando silenciosamente.

---

### C7 · URLs e IP local hardcoded na APK de produção

**Arquivo:** `apps/tv-apk/app/build.gradle` (linhas 19–20)

```groovy
buildConfigField "String", "PLAYER_URL", "\"http://192.168.0.114:7740/player?rotation=90\""
buildConfigField "String", "API_URL",    "\"http://192.168.0.114:7741/api\""
```

O IP `192.168.0.114` é o endereço LAN do PC do Pedro. Qualquer build desta APK vai tentar conectar nesse IP, não no servidor de produção. A APK publicada em produção não funciona fora da rede local do Pedro.

---

### C8 · Orientação landscape na APK, produto é portrait

**Arquivo:** `apps/tv-apk/app/src/main/AndroidManifest.xml` (linha 24)

```xml
<activity android:screenOrientation="landscape" ...>
```

O player web aplica `transform: rotate(90deg)` via CSS para simular portrait, mas a Activity está travada em landscape. Significa que qualquer interface nativa (diálogo de instalação da APK, erros do sistema) aparece em landscape enquanto o conteúdo está rotacionado.

---

## 🟠 Altas — degradam segurança ou funcionalidade significativamente

### A1 · Error handler vaza detalhes internos em produção

**Arquivo:** `apps/api/src/middlewares/error-handler.ts` (linhas 66–72)

```ts
return res.status(500).json({
  error: 'Internal Server Error',
  message: err.message, // stack trace / mensagem interna
  code: (err as PrismaError).code,
  meta: (err as PrismaError).meta, // nome de tabelas, paths
});
```

Em produção, `err.message` de erros Prisma inclui nomes de tabelas, colunas e caminhos de arquivo. Deveria retornar mensagem genérica e logar internamente.

---

### A2 · Open redirect no login do dashboard

**Arquivo:** `apps/dashboard/app/login/login-form.tsx` (linha 11)

```ts
const nextPath = searchParams.get('next');
if (nextPath?.startsWith('/')) router.push(nextPath); // aceita //evil.com
```

`//evil.com` começa com `/` mas é interpretado pelo browser como URL absoluta. Deveria rejeitar qualquer `next` que comece com `//` ou `\/`.

---

### A3 · Um único env var desativa toda a autenticação

**Arquivo:** `apps/dashboard/lib/auth-cookie.ts`

```ts
export function isAuthEnabled(): boolean {
  return process.env.DASHBOARD_AUTH_ENABLED !== 'false';
}
```

Definir `DASHBOARD_AUTH_ENABLED=false` desativa o login completamente. Qualquer acidente de configuração (ou engano no `.env`) expõe o dashboard sem senha.

---

### A4 · HTTP cleartext habilitado globalmente na APK

**Arquivos:** `apps/tv-apk/app/src/main/AndroidManifest.xml`, `apps/tv-apk/app/src/main/res/xml/network_security_config.xml`

```xml
<!-- AndroidManifest.xml -->
android:usesCleartextTraffic="true"

<!-- network_security_config.xml -->
<base-config cleartextTrafficPermitted="true" />
```

Não há pinning de certificados. Todo o tráfego pode ser interceptado e modificado em ataques man-in-the-middle na rede local.

---

### A5 · Charset não especificado na leitura de JSON (Java)

**Arquivo:** `apps/tv-apk/app/src/main/java/com/aquatv/player/MainActivity.java` (linha 223)

```java
return new String(buffer, 0, read); // charset implícito — depende da JVM/SO
```

Deveria ser `new String(buffer, 0, read, StandardCharsets.UTF_8)`. Caracteres especiais em nomes de release ou URLs podem ser corrompidos silenciosamente.

---

### A6 · Verificação de update chamada apenas uma vez (onCreate)

**Arquivo:** `apps/tv-apk/app/src/main/java/com/aquatv/player/MainActivity.java` (linha 71)

```java
protected void onCreate(Bundle savedInstanceState) {
  // ...
  checkForUpdate();
}
```

Para um kiosk que fica ligado 24/7, atualizar apenas no boot significa que uma nova APK só é instalada se a TV for reiniciada manualmente. Deveria haver verificação periódica (ex: a cada N horas).

---

### A7 · APK baixada nunca é deletada do cache

**Arquivo:** `apps/tv-apk/app/src/main/java/com/aquatv/player/MainActivity.java` (linha 179)

O arquivo temporário da APK é criado no cache mas nunca removido, nem em caso de sucesso nem em falha. Com o tempo, múltiplas versões acumulam-se no storage interno do device.

---

### A8 · Erros de update silenciados

**Arquivo:** `apps/tv-apk/app/src/main/java/com/aquatv/player/MainActivity.java` (linha 218)

```java
} catch (Exception ignored) {
```

Qualquer falha no processo de download/verificação/instalação da APK é descartada silenciosamente. Nenhum log, nenhum alerta, nenhuma tentativa de retry.

---

### A9 · SSE não reconecta após erro

**Arquivo:** `apps/dashboard/app/player/tv-player.tsx` (linhas 311–313)

```ts
eventSource.onerror = () => {
  eventSource.close(); // fecha e não tenta reconectar
};
```

Se a conexão SSE cair (rede instável, restart da API), o player para de receber comandos de force-sync e nunca retoma. Deveria implementar reconexão com backoff exponencial.

---

### A10 · Loop infinito em caso de falha geral de vídeo

**Arquivo:** `apps/dashboard/app/player/tv-player.tsx` (linha 367)

```tsx
<video onError={advance} ...>
```

`advance()` passa para o próximo item da playlist. Se todos os itens falharem (ex: servidor fora), o player entra em loop infinito avançando sem parar, nunca exibindo mensagem de erro.

---

### A11 · Migrações novas nunca são aplicadas automaticamente

**Arquivo:** `scripts/windows/start-aquatv.ps1` (linhas 42–44)

```ps1
if (-not (Test-Path $dbPath)) {
  # executa migration SQL diretamente apenas na primeira vez
}
```

O script só roda a migration inicial se o banco não existir. Novas migrações adicionadas futuramente nunca são aplicadas automaticamente. Deveria usar `prisma migrate deploy` a cada startup.

---

### A12 · CI sem cobertura automática

**Arquivo:** `.github/workflows/ci.yml`

```yaml
on:
  workflow_dispatch: # manual apenas
```

Nenhum CI automático em push ou pull request. Código quebrado pode ser mergeado sem detecção. `--frozen-lockfile=false` permite lockfile desatualizado.

---

## 🟡 Médias — comprometem qualidade ou consistência

### M1 · Validação de MIME type confia no cliente

**Arquivo:** `apps/api/src/routes/media.ts`

O tipo MIME é extraído do `Content-Type` do upload (enviado pelo cliente). Não há magic-byte sniffing. Um arquivo `.exe` renomeado para `.mp4` passa pela validação.

---

### M2 · APK aceita `application/zip` como MIME válido

**Arquivo:** `apps/api/src/routes/app-releases.ts`

```ts
const ALLOWED_APK_MIMETYPES = ['application/vnd.android.package-archive', 'application/zip', ...];
```

`application/zip` é um tipo genérico válido para qualquer arquivo ZIP, incluindo malware. Deveria aceitar apenas o MIME específico de APK.

---

### M3 · Header `x-uploaded-by` controlado pelo cliente

**Arquivo:** `apps/api/src/routes/media.ts` (linha 130)

```ts
uploadedBy: req.header('x-uploaded-by') ?? null,
```

Qualquer cliente pode definir qualquer valor para `x-uploaded-by`. Depois que autenticação for implementada, esse campo deveria vir do usuário autenticado.

---

### M4 · `authRouter` é código morto

**Arquivo:** `apps/api/src/routes/auth.ts`

O router existe com endpoints 501 (Not Implemented), mas nunca é montado. Ocupa espaço e confunde quem lê o código.

---

### M5 · `apps/player` é um pacote abandonado

**Diretório:** `apps/player/`

Tem `app.config.js` com `'http://IP-DO-PC:7741/api'` como placeholder, nenhum `App.tsx`, nenhum entrypoint Expo real. O código TypeScript (`player-api.ts`, `sync-planner.ts`) não é consumido por nenhum runtime. O plano original de Expo foi descartado, mas o pacote ficou.

---

### M6 · Seed reseta config do Diego a cada restart

**Arquivo:** `apps/api/prisma/seed.ts`, `scripts/windows/start-aquatv.ps1` (linha 47)

O script de startup chama `prisma:seed` em todo boot. O seed faz upsert em `globalConfig.defaultPlaylistId` para `"Playlist Padrao"`. Qualquer configuração de playlist padrão feita pelo Diego via dashboard é sobrescrita na próxima vez que o servidor reinicia.

---

### M7 · Parâmetro `resolution` aceito mas ignorado

**Arquivo:** `apps/api/src/routes/devices.ts`

```ts
const resolution = (req.query['resolution'] as string) ?? '1h';
// resolution é recebido mas nunca usado na query ao banco
```

O endpoint aceita `?resolution=5m` mas retorna os mesmos dados independentemente do valor.

---

### M8 · `start-aquatv.ps1` roda build completo a cada startup

**Arquivo:** `scripts/windows/start-aquatv.ps1` (linha 48)

```ps1
& $pnpm.Source build
```

`pnpm build` reconstrói todo o monorepo em toda inicialização. Com Turborepo e cache local isso é mais rápido, mas ainda desnecessariamente lento para um servidor que só precisa ser iniciado.

---

### M9 · `Wait-Process` bloqueia o terminal indefinidamente

**Arquivo:** `scripts/windows/start-aquatv.ps1` (linha 75)

```ps1
Wait-Process -Id $api.Id, $dashboard.Id
```

Fechar a janela PowerShell mata o processo pai, que mata os filhos. O script inicia processos em segundo plano mas depois aguarda por eles — se um cair, o outro continua sem supervisão.

---

### M10 · CLAUDE.md desatualizado

**Arquivo:** `CLAUDE.md`

O arquivo descreve a stack como "MySQL + Hostinger + Expo bare" mas o código atual usa SQLite local + WebView Java + sem Expo. Agentes futuros vão tomar decisões baseados em informação errada.

---

### M11 · `.env.example` incompleto

**Arquivo:** `apps/dashboard/.env.example`

Só documenta `NEXT_PUBLIC_API_URL`. Faltam ao menos: `DASHBOARD_PASSWORD`, `DASHBOARD_AUTH_ENABLED`, `COOKIE_SECRET`, `INTERNAL_API_URL`, e configurações de proxy. Um novo desenvolvedor não consegue configurar o projeto a partir desse arquivo.

---

### M12 · Rate limiting em memória

**Arquivo:** `apps/dashboard/app/api/auth/login/route.ts`

O rate limiting de tentativas de login usa `Map` em memória. Reiniciar o processo reseta todos os contadores. Em produção, deveria usar Redis ou persistência em banco.

---

### M13 · Login sem senha quando `isAuthEnabled()` = false

**Arquivo:** `apps/dashboard/app/api/auth/login/route.ts` (linhas 57–59)

```ts
if (!isAuthEnabled()) {
  // emite cookie de sessão sem verificar nenhuma senha
}
```

Mesmo que seja intencional para desenvolvimento, combinar isso com um `.env` mal configurado em produção expõe o sistema completamente (ver A3).

---

## 🔵 Baixas — qualidade de código e manutenibilidade

### B1 · `void _next` desnecessário no error handler

**Arquivo:** `apps/api/src/middlewares/error-handler.ts` (linha 18)

```ts
void _next; // desnecessário
```

O parâmetro `_next` com prefixo `_` já sinaliza que é intencional. `void _next` é ruído.

---

### B2 · `sendDeviceLog` descarta o retorno

**Arquivo:** `packages/api-client/src/index.ts`

```ts
await requestJson<unknown>(/* ... */); // retorno descartado
```

Poderia usar um método `requestNoContent` para deixar explícito que não há corpo de resposta esperado.

---

### B3 · `appVersion` hardcoded no player web

**Arquivo:** `apps/dashboard/app/player/tv-player.tsx` (linha 218)

```ts
appVersion: 'web-player-0.1.0',
```

A versão nunca atualiza. O dashboard de devices sempre vai mostrar essa string para devices web, independente de qualquer atualização real.

---

### B4 · Tipo compartilhado propaga nome errado

**Arquivo:** `packages/types/src/index.ts`

```ts
export interface AppRelease {
  apkMd5: string; // na verdade SHA-256
}
```

O erro de nomenclatura do C6 está incorporado no contrato público da API. Corrigir depois vai exigir breaking change em todos os consumidores.

---

### B5 · Boot failure no player não tem retry

**Arquivo:** `apps/dashboard/app/player/tv-player.tsx`

Se a chamada inicial para `getCurrentPlaylist()` falhar, o player fica travado em estado "offline" indefinidamente, sem tentar novamente.

---

### B6 · `query.resolution` sem tipo seguro

**Arquivo:** `apps/api/src/routes/devices.ts`

```ts
const resolution = (req.query['resolution'] as string) ?? '1h';
```

Cast direto de `req.query` para `string` sem validação Zod. O padrão do projeto usa Zod em todas as outras rotas.

---

## Prioridades de correção

| Prioridade | Item                                  | Esforço estimado |
| ---------- | ------------------------------------- | ---------------- |
| 1          | C1 + C2: autenticação API + dashboard | Alto             |
| 2          | C4: remover keystore do repo          | Baixo            |
| 3          | C5: nunca pular verificação de hash   | Baixo            |
| 4          | C7: URLs via variável de ambiente     | Baixo            |
| 5          | C3: implementar schedule-resolution   | Alto             |
| 6          | A1: error handler seguro              | Baixo            |
| 7          | A2: corrigir open redirect            | Baixo            |
| 8          | A6: verificação periódica de update   | Médio            |
| 9          | A9: reconexão SSE                     | Médio            |
| 10         | M6: seed não sobrescrever config      | Baixo            |
| 11         | M10: atualizar CLAUDE.md              | Baixo            |
| 12         | M11: completar .env.example           | Baixo            |
| 13         | A11: usar `prisma migrate deploy`     | Baixo            |

---

_Revisão estática — não substitui testes de integração ou auditoria de segurança com dependências instaladas._
