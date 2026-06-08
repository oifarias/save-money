# Save Money

Sistema web de controle de gastos pessoais com dashboard inteligente, lançamentos manuais, grupos/hashtags e insights automáticos. Veja a especificação completa do produto em [`save-money-product-spec.md`](./save-money-product-spec.md).

## Stack

- **Framework**: Next.js 16 (App Router) + TypeScript
- **Estilo**: Tailwind CSS v4 + CSS Variables para tema (light/dark)
- **Banco de dados**: PostgreSQL (via Prisma + `@prisma/adapter-pg`) — funciona com qualquer provedor (Vercel Postgres, Supabase, Neon, Docker local etc.)
- **ORM**: Prisma 7
- **Autenticação**: Auth.js (NextAuth v5) com Credentials Provider + bcrypt
- **Gráficos**: Recharts
- **Validação**: Zod
- **Notificações**: react-hot-toast

## Pré-requisitos

- Node.js 20+ (recomendado 22+)
- npm
- Um banco PostgreSQL acessível (local via Docker, ou em nuvem: Vercel Postgres, Supabase, Neon...)

## Como rodar o projeto

1. Instale as dependências:

   ```bash
   npm install
   ```

2. Suba um PostgreSQL local (mais simples via Docker) ou crie um banco em algum provedor gerenciado:

   ```bash
   docker run --name save-money-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=save_money -p 5432:5432 -d postgres:17
   ```

3. Configure as variáveis de ambiente. Copie o `.env` de exemplo (ou crie um na raiz do projeto) com:

   ```env
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/save_money?schema=public"
   NEXTAUTH_SECRET="uma-string-secreta-aleatoria"
   NEXTAUTH_URL="http://localhost:3000"
   ```

   > Em produção, gere um `NEXTAUTH_SECRET` forte, por exemplo com `openssl rand -base64 32`. Ajuste `DATABASE_URL` para a connection string do seu provedor (Vercel Postgres, Supabase, Neon etc.).

4. Aplique as migrações do Prisma (na primeira vez, isso cria as tabelas e o histórico de migrações em `prisma/migrations/`):

   ```bash
   npx prisma migrate dev
   ```

5. Gere o Prisma Client (normalmente já é feito pelo passo anterior, mas pode ser repetido a qualquer momento):

   ```bash
   npx prisma generate
   ```

6. Inicie o servidor de desenvolvimento:

   ```bash
   npm run dev
   ```

7. Acesse [http://localhost:3000](http://localhost:3000). Você será redirecionado para a tela de login — clique em "Criar conta" para se cadastrar. Ao se registrar, o sistema cria automaticamente uma carteira padrão e os grupos (categorias) padrão do produto.

## Scripts disponíveis

| Comando | Descrição |
|---|---|
| `npm run dev` | Inicia o servidor de desenvolvimento (Turbopack) |
| `npm run build` | Gera o build de produção |
| `npm run start` | Inicia o servidor em modo produção (após o build) |
| `npm run lint` | Roda o ESLint |
| `npx prisma studio` | Abre uma interface visual para explorar o banco de dados |
| `npx prisma migrate dev` | Cria/aplica migrações em desenvolvimento |

## Banco de dados

O schema completo está em [`prisma/schema.prisma`](./prisma/schema.prisma) e cobre usuários, contas, transações, categorias, tags, orçamentos, metas, assinaturas e notificações (estes três últimos preparados para a V2).

O projeto usa **PostgreSQL** via Prisma com o driver adapter `@prisma/adapter-pg` (ver [`src/lib/prisma.ts`](./src/lib/prisma.ts)), o que funciona com qualquer provedor compatível — Vercel Postgres, Supabase, Neon, RDS, um container Docker local etc. Basta apontar `DATABASE_URL` para a connection string correta.

## Deploy na Vercel

1. Crie um banco **Vercel Postgres** (aba *Storage* do projeto na Vercel, ou via `vercel postgres create`) e conecte-o ao projeto — a Vercel injeta `DATABASE_URL` automaticamente nas variáveis de ambiente.
2. Configure as demais variáveis de ambiente do projeto na Vercel (*Settings → Environment Variables*):
   - `NEXTAUTH_SECRET` — gere um valor forte com `openssl rand -base64 32` (use um valor diferente do de desenvolvimento);
   - `NEXTAUTH_URL` — a URL pública do deploy, ex. `https://seu-projeto.vercel.app`.
3. Rode as migrações contra o banco de produção (uma vez, a partir da sua máquina, com `DATABASE_URL` apontando para o banco da Vercel):

   ```bash
   npx prisma migrate deploy
   ```

4. Faça o deploy normalmente (`git push` para o branch conectado, ou `vercel --prod`). O script `postinstall` do projeto roda `prisma generate` automaticamente após o `npm install`, então o Prisma Client é gerado a cada build — não é necessário nenhum passo extra.

> **Nota**: o adapter `@prisma/adapter-better-sqlite3` usado anteriormente não funciona em ambientes serverless (filesystem efêmero + módulo nativo). Por isso o projeto migrou para PostgreSQL antes do primeiro deploy.

## Estrutura do projeto

```
src/
  app/
    (auth)/        → telas de login, cadastro e recuperação de senha
    (app)/         → área autenticada (dashboard, lançamentos, grupos, etc.)
    api/auth/      → rotas do Auth.js
  components/
    layout/        → sidebar, bottom nav, header, app shell
    theme/         → provider e toggle de tema (light/dark)
    transactions/  → formulário, listagem e chips de hashtags
    groups/        → gestão de grupos/categorias
    dashboard/     → cards de resumo, gráficos e painel de insights
    ui/            → componentes de interface reutilizáveis (botão, input, modal, etc.)
  lib/             → Prisma client, autenticação, validações e regras de negócio
  generated/prisma → Prisma Client gerado (não versionado)
prisma/
  schema.prisma    → schema do banco de dados
  migrations/      → histórico de migrações
```

## Status do desenvolvimento

✅ Implementado (V1 — MVP + Beta):
- Autenticação completa (cadastro, login, recuperação de senha, proteção de rotas)
- Dashboard com cards de resumo, gráficos (donut e evolução mensal) e insights automáticos
- Lançamento manual de transações (com hashtags, recorrência, despesas fixas)
- Gestão de grupos (categorias) com cores e ícones personalizados
- Importação de lançamentos via Excel (.xlsx/.xls) com mapeamento de colunas, pré-visualização, validação de linhas e arquivo modelo para download
- Comparativo mês a mês por grupo, com seleção de períodos, filtro por tipo, variação percentual, gráfico de barras agrupadas e exportação em Excel
- Seção dedicada de Insights e Recomendações: ranking de crescimento de gastos (3 meses), comparação de médias mensais por grupo, sugestões de metas de redução, ranking de hashtags e alerta de despesas fixas
- Layout responsivo (sidebar, drawer, bottom navigation) com tema light/dark

A V1.0 está completa conforme o roadmap da especificação (Autenticação, Dashboard, Importação, Lançamento Manual, Grupos/Hashtags, Comparativo e Insights).

A V2 (metas, orçamentos, assinaturas, alertas, IA financeira, multi-moeda etc.) está descrita na [especificação do produto](./save-money-product-spec.md).
