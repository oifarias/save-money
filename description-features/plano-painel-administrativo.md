# Plano — Painel administrativo (KPIs do produto)

> Documento de planejamento. Cobre a jornada, a decisão de autenticação e os KPIs/gráficos do painel interno (uso da equipe, não dos usuários do app).

## Contexto

Hoje não existe nenhuma visão agregada do produto como um todo — só dados por usuário, dentro do app autenticado. O pedido é um painel separado, com login próprio (não é uma conta de usuário comum), mostrando números do produto inteiro: usuários cadastrados, lançamentos cadastrados, médias, valores, insights gerados e links de divisão gerados — em gráficos.

## Decisão de arquitetura: autenticação separada da autenticação de usuário

O painel **não** deve usar o NextAuth/`User` existente — misturar as duas coisas criaria um jeito de "promover" um usuário comum a admin dentro da mesma tabela que guarda dados de clientes, o que é mais risco do que ganho pra um único acesso administrativo. Em vez disso:

- Credencial única (usuário + senha) guardada em variáveis de ambiente: `ADMIN_USERNAME` e `ADMIN_PASSWORD_HASH` (hash bcrypt, nunca a senha em texto puro em lugar nenhum do código ou do banco).
- Sessão própria: depois do login validado, um cookie assinado (HMAC-SHA256 com `ADMIN_SESSION_SECRET`, comparação em tempo constante via `crypto.timingSafeEqual`) com expiração de 12h — sem depender da tabela `Session`/JWT do NextAuth, sem nova dependência (usa só `node:crypto`, já nativo).
- `src/proxy.ts` ganha um branch específico pra `/admin/**`: independente da sessão de usuário comum, verifica esse cookie próprio; se inválido/ausente, redireciona pra `/admin/login`. As rotas de usuário comum (`/dashboard`, `/lancamentos` etc.) continuam exatamente como estão.
- Mesmo padrão de "dupla checagem" que o app já usa hoje (`(app)/layout.tsx` reconfirma a sessão mesmo com o proxy já tendo checado) — o layout do painel reconfirma o cookie de novo, em vez de confiar só no proxy.

**Limitação assumida**: é uma credencial única, não multi-admin com usuários/permissões diferentes. Se no futuro precisar de mais de um admin com identidade própria, vale criar uma tabela `AdminUser` — fora do escopo agora, registrado como possível Fase 2.

## KPIs e gráficos

Mesmo padrão visual já usado no dashboard do usuário (`SummaryCards` = números grandes em card; `MonthlyTrendChart`/`CategoryDonutChart` = gráfico) — o painel reaproveita essa linguagem, não inventa uma nova.

**Cards de número** (linha 1 — visão geral):
- Usuários cadastrados (total)
- Lançamentos cadastrados (total)
- Insights de despesa fixa gerados (`FixedExpenseInsightDecision`, aceitos + descartados — é o único tipo de "insight" que o produto persiste hoje; os outros insights do dashboard são calculados na hora, não guardados)
- Links de divisão gerados (`SharedSplit`)

**Cards de número** (linha 2 — médias e valores):
- Média de lançamentos por usuário (lançamentos ÷ usuários)
- Valor médio por lançamento (ticket médio)
- Volume financeiro total (soma de todos os valores lançados na plataforma)

**Gráficos** (últimos 12 meses, mesma lógica de `date_trunc` já usada em `dashboard-data.ts`):
- Novos usuários por mês (barra)
- Lançamentos cadastrados por mês (barra)

Uso de `createdAt` (quando o registro entrou no sistema) nesses gráficos, não a data do lançamento em si (`date`) — aqui o que importa é atividade real da plataforma mês a mês, diferente da visão pessoal de orçamento do usuário (que usa `date`).

## Arquivos

**Lib:**
- `src/lib/admin-auth.ts` — `verifyAdminCredentials(username, password)` (bcrypt), `createAdminSessionCookieValue()`, `verifyAdminSessionCookieValue(value)` (HMAC + expiração).
- `src/lib/admin-data.ts` — `getAdminKpis()`: usuários, lançamentos, médias, volume, insights, links (aggregate/count em paralelo) + `getMonthlyGrowth()`: novos usuários e lançamentos por mês via `$queryRaw` parametrizado.

**Rotas:**
- `src/app/admin/(auth)/login/page.tsx` + `layout.tsx` — formulário de login, sem o cabeçalho do painel.
- `src/app/admin/(dashboard)/page.tsx` + `layout.tsx` — o painel em si (cabeçalho com título + botão "Sair"), reconfirma o cookie no layout.
- `src/app/admin/actions.ts` — `adminLoginAction`, `adminLogoutAction`.
- `src/proxy.ts` — branch novo pra `/admin/**`.

**Componentes:**
- `src/components/admin/kpi-cards.tsx` — as duas linhas de cards.
- `src/components/admin/growth-charts.tsx` — os 2 gráficos de barra (reaproveita Recharts, já usado no projeto).

**Env:**
- `.env` — `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `ADMIN_SESSION_SECRET` (gerados na implementação; credenciais entregues ao usuário fora deste arquivo, nunca commitadas em texto puro).

## Verificação

1. `npx tsc --noEmit`, `npx eslint`, `npm run build`.
2. `/admin` sem cookie válido → redireciona pra `/admin/login`; com cookie válido → mostra o painel.
3. Login com credencial errada → erro claro, sem dizer se o usuário existe (não que exista múltiplos usuários aqui, mas mantém o hábito de não revelar detalhe de auth).
4. Confirmar que `/dashboard`, `/lancamentos` etc. (usuário comum) continuam funcionando exatamente como antes — o branch novo no proxy não pode afetar o fluxo existente.
5. Conferir os números do painel contra uma contagem manual simples (`SELECT count(*) FROM users`, etc.) pra validar que os KPIs batem.
