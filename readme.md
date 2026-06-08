# Save Money

Sistema web de controle de gastos pessoais com dashboard inteligente, lançamentos manuais, grupos/hashtags e insights automáticos. Veja a especificação completa do produto em [`save-money-product-spec.md`](./save-money-product-spec.md).

## Stack

- **Framework**: Next.js 16 (App Router) + TypeScript
- **Estilo**: Tailwind CSS v4 + CSS Variables para tema (light/dark)
- **Banco de dados**: SQLite (local, via Prisma + `@prisma/adapter-better-sqlite3`)
- **ORM**: Prisma 7
- **Autenticação**: Auth.js (NextAuth v5) com Credentials Provider + bcrypt
- **Gráficos**: Recharts
- **Validação**: Zod
- **Notificações**: react-hot-toast

## Pré-requisitos

- Node.js 20+ (recomendado 22+)
- npm

## Como rodar o projeto

1. Instale as dependências:

   ```bash
   npm install
   ```

2. Configure as variáveis de ambiente. Copie o `.env` de exemplo (ou crie um na raiz do projeto) com:

   ```env
   DATABASE_URL="file:./prisma/dev.db"
   NEXTAUTH_SECRET="uma-string-secreta-aleatoria"
   NEXTAUTH_URL="http://localhost:3000"
   ```

   > Em produção, gere um `NEXTAUTH_SECRET` forte, por exemplo com `openssl rand -base64 32`.

3. Crie o banco de dados local e aplique as migrações do Prisma:

   ```bash
   npx prisma migrate dev
   ```

   Isso cria o arquivo `prisma/dev.db` (SQLite) já com todas as tabelas do schema.

4. Gere o Prisma Client (normalmente já é feito pelo passo anterior, mas pode ser repetido a qualquer momento):

   ```bash
   npx prisma generate
   ```

5. Inicie o servidor de desenvolvimento:

   ```bash
   npm run dev
   ```

6. Acesse [http://localhost:3000](http://localhost:3000). Você será redirecionado para a tela de login — clique em "Criar conta" para se cadastrar. Ao se registrar, o sistema cria automaticamente uma carteira padrão e os grupos (categorias) padrão do produto.

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

Por padrão o projeto usa **SQLite local** (zero configuração). Para migrar para PostgreSQL (ex.: Supabase), basta:

1. Trocar o `provider` do datasource em `prisma/schema.prisma` de `sqlite` para `postgresql`;
2. Trocar o adapter em `src/lib/prisma.ts` (de `@prisma/adapter-better-sqlite3` para `@prisma/adapter-pg`, por exemplo);
3. Atualizar `DATABASE_URL` no `.env` com a connection string do novo banco;
4. Rodar `npx prisma migrate dev` novamente para recriar as migrações no novo provider.

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
- Layout responsivo (sidebar, drawer, bottom navigation) com tema light/dark

🚧 Em desenvolvimento (próximas entregas da V1):
- Comparativo mês a mês
- Seção dedicada de Insights e Recomendações

A V2 (metas, orçamentos, assinaturas, alertas, IA financeira, multi-moeda etc.) está descrita na [especificação do produto](./save-money-product-spec.md).
