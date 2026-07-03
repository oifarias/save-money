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

## Como executar este plano

1. Rodar cada seção isoladamente, documentando resultado (reproduziu / não
   reproduziu) e evidência (request/response, screenshot, log).
2. Priorizar 7 (SQLi/IDOR) e 1 (rate limit) primeiro — maior impacto.
3. Depois de cada verificação, abrir uma tarefa de correção separada por item
   (não misturar fix de vários achados no mesmo commit/PR).
4. Repetir os testes de IDOR para **todo** domínio com recursos por usuário
   (lançamentos, metas, desejos, cartões, grupos/categorias, split/dividir) —
   não basta testar um e assumir os outros.
