# Plano — Dividir conta (selecionar lançamentos → link compartilhável)

> Documento de planejamento. Nenhum código foi escrito ainda. Foco deste plano: jornada e decisões de design/UX, com a arquitetura mínima necessária pra sustentar isso.

## Contexto

Hoje a tela de Lançamentos já tem seleção múltipla (usada pra editar em lote — `src/components/transactions/transactions-manager.tsx`, barra fixa que aparece quando `selectedCount > 0`). O pedido é reaproveitar essa seleção pra criar um **link público** (sem login) que mostra a divisão de uma conta entre pessoas, dividida igualmente ou de forma personalizada.

Isso introduz algo novo no produto: a primeira tela **pública** (sem autenticação) do app. Vale tratar com cuidado de design e de dados — quem abre o link não tem conta, não conhece o produto ainda, e só deve ver exatamente o que foi selecionado, nada além disso.

## Decisões de arquitetura

### 1. Link público = rota fora do grupo `(app)`, com o token via query parameter

`src/app/(app)/layout.tsx` chama `auth()` e redireciona pra `/login` se não houver sessão — então a tela pública **não pode** viver dentro de `(app)`. Vai ser uma rota nova fora dos grupos existentes: `src/app/dividir/page.tsx` (usa só o layout raiz, sem o shell autenticado), lendo o token via `?token=...` (query parameter, sem segmento dinâmico) — qualquer pessoa com o link, sem login, acessa direto.

`/dividir` entra na lista de paths liberados em `src/proxy.ts`, sem exigir sessão.

### 2. Snapshot dos lançamentos, não referência viva

Ao gerar o link, eu copio descrição/valor/data dos lançamentos selecionados pra dentro do registro do link (snapshot), em vez de só guardar uma referência (`transactionId`). Por quê: se o usuário editar ou excluir o lançamento depois de compartilhar, o link não deve quebrar nem mudar silenciosamente o valor que a outra pessoa já viu. O link é uma "foto" do momento em que foi criado.

### 3. Token

`crypto.randomUUID()` (já disponível no Node, sem nova dependência) como token único, não sequencial e não adivinhável — guardado em `SharedSplit.token` com `@unique`. URL final: `/dividir?token=<token>`.

### 4. Modelo de dados (1 migration nova)

```prisma
model SharedSplit {
  id        String   @id @default(cuid())
  userId    String
  token     String   @unique
  title     String
  mode      String   // "equal" | "custom"
  createdAt DateTime @default(now())

  user         User                     @relation(fields: [userId], references: [id], onDelete: Cascade)
  items        SharedSplitItem[]
  participants SharedSplitParticipant[]

  @@index([userId])
  @@map("shared_splits")
}

model SharedSplitItem {
  id            String   @id @default(cuid())
  sharedSplitId String
  description   String
  amount        Float
  date          DateTime

  sharedSplit SharedSplit @relation(fields: [sharedSplitId], references: [id], onDelete: Cascade)

  @@index([sharedSplitId])
  @@map("shared_split_items")
}

model SharedSplitParticipant {
  id            String @id @default(cuid())
  sharedSplitId String
  name          String
  amount        Float
  position      Int

  sharedSplit SharedSplit @relation(fields: [sharedSplitId], references: [id], onDelete: Cascade)

  @@index([sharedSplitId])
  @@map("shared_split_participants")
}
```

(+ `sharedSplits SharedSplit[]` em `User`.)

### 5. Só despesas entram na divisão

A seleção hoje permite marcar qualquer lançamento (entrada ou despesa, já que serve pra edição em lote também). Dividir conta só faz sentido pra despesa. Regra: ao abrir a jornada, lançamentos de entrada selecionados são **ignorados automaticamente** (com um aviso de uma linha no passo 1, não um bloqueio) — evita o usuário ter que desmarcar manualmente, mas deixa claro o que foi excluído.

## Jornada (foco do pedido — pensada passo a passo)

### Gatilho: card explicativo no topo de Lançamentos

Antes até de selecionar qualquer coisa, um card novo no topo da tela (acima de "Novo lançamento"), só pra apresentar a função pra quem nunca viu:

- Ícone `HandCoins` (dinheiro passando de mão em mão — mais específico que um ícone genérico de "compartilhar").
- Título: "Divida uma conta com alguém"
- Texto: "Marque lançamentos na lista abaixo e gere um link pra dividir o valor com quem participou — sem precisar criar conta."

Esse card é só informativo (sem botão) — a ação de verdade só aparece depois que o usuário já selecionou algo, que é onde a intenção já existe.

### Gatilho real: botão na barra de seleção

Na barra fixa que já aparece com `selectedCount > 0` (mesmo lugar do botão "Editar em lote"), novo botão **"Dividir conta"** (ícone `Share2`). Abre a jornada num `Modal` (não navega pra outra página) — mantém o usuário ancorado na lista, sem perder a seleção/contexto, mesmo padrão já usado pelo `BulkEditForm`.

### Passo 1 — Título

- Pergunta direta: **"Como você quer chamar essa conta?"**
- Input com placeholder de exemplo real, não genérico: *"Ex.: Jantar de sexta, Viagem à praia..."*
- Mostra, abaixo do campo, um resuminho de contexto pra confirmar que é a seleção certa: "X lançamentos selecionados · R$ total" (e, se algum lançamento de entrada foi ignorado pela regra do item 5, o aviso de uma linha aqui).

### Passo 2 — Como dividir

Dois cards grandes, lado a lado (mesmo padrão visual de escolha usado em `transaction-intake.tsx` e nos botões-ícone de `allocation-step.tsx` — ícone + título + descrição curta, fica colorido o que estiver selecionado):

- **Igualmente entre todos** (ícone `Users`) — "O valor total é dividido em partes iguais"
- **Valores personalizados** (ícone `SlidersHorizontal`) — "Você define quanto cada pessoa paga"

Ao escolher, aparece a lista de participantes (comum aos dois modos):

- Lista editável de nomes, com **"Você" já incluído por padrão** na primeira posição (editável/removível) — botão "+ Adicionar pessoa".
- **Modo igual**: cada linha só tem o nome; o valor por pessoa (total ÷ nº de pessoas) é calculado e mostrado ao vivo, atualizando a cada pessoa adicionada/removida — feedback visual imediato, sem precisar de outro clique (mesma filosofia de pré-cálculo ao vivo já usada na tela de Metas).
- **Modo personalizado**: cada linha tem nome + campo de valor. Mostra o total já distribuído vs. o total da conta, com aviso (não bloqueio) se não bater — mesmo padrão de validação suave do passo de valores por grupo em Metas.

### Passo 3 — Resumo (confirmação)

Tudo que vai pro link, revisável antes de confirmar:

- Título da conta
- Lista dos lançamentos incluídos (descrição, data, valor — só leitura)
- Total
- A divisão final, pessoa por pessoa, com valor
- Texto de transição: "Ao confirmar, vamos gerar um link pra você compartilhar."
- Botão primário **"Confirmar e gerar link"** (com estado de carregamento) + botão "Voltar".

### Tela final — Parabéns

Mesma linguagem visual da tela de parabéns de Metas (`goals-congrats.tsx` — ícone `PartyPopper`, mesma estrutura), pra manter consistência de "momento de sucesso" no produto inteiro:

- "Pronto! Sua conta foi dividida."
- Card com o link gerado, já no formato final (`.../dividir?token=<token>`), com botão **"Copiar link"** (feedback de "Copiado!" por 2s) e botão secundário **"Compartilhar no WhatsApp"** (`https://wa.me/?text=` com o link e o título da conta — gesto pequeno mas que faz sentido pro público brasileiro, sem precisar de integração nenhuma).
- Link terciário "Ver meus links" (lista simples dos links já criados — ver "Fase 2" abaixo; se não quiser isso na v1, o "Fechar" simples já basta).

## Tela pública (`/dividir?token=...`)

Quem abre não tem conta, pode estar vindo de um link no WhatsApp no celular — mobile-first, carregamento rápido, sem nenhuma ação que pareça phishing:

- Cabeçalho com a marca Save Money (mesmo selo usado em `(auth)/layout.tsx`: ícone `Wallet` em gradiente + nome) — deixa claro de onde vem o link, sem pedir nada.
- Título da conta em destaque + valor total.
- Lista dos lançamentos incluídos (reaproveita a linguagem visual de `transaction-row.tsx`, sem os botões de editar/excluir — só leitura).
- A divisão por pessoa como elemento principal da tela (cards com nome + valor, esse é o motivo de a pessoa ter aberto o link).
- Estado de erro tratado como conteúdo, não como crash: link inexistente/excluído → "Esse link não está mais disponível", sem stack trace, sem tela em branco.

## Arquivos (visão de implementação futura)

**Schema:** `prisma/schema.prisma` (3 modelos acima) + migration.

**Lib:**
- `src/lib/split-data.ts` — `getSplitByToken(token)` (leitura pública, sem escopo de `userId` — o token já é a "senha"), `getUserSplits(userId)` (pra "Ver meus links").

**Server Actions** (`src/app/(app)/lancamentos/split-actions.ts`):
- `createSplitAction(input)` — valida que todos os `transactionIds` pertencem ao `userId`, filtra só `EXPENSE`, grava snapshot + participantes, gera o token, retorna o link.
- `deleteSplitAction(id)` — exclusão escopada por `userId` (pra "Ver meus links").

**Rotas:**
- `src/app/dividir/page.tsx` — tela pública, lê `token` de `searchParams`.
- `src/proxy.ts` — adicionar `/dividir` aos paths liberados sem login.

**Componentes** (`src/components/split/`):
- `share-split-button.tsx` — botão na barra de seleção, abre o `Modal`.
- `split-wizard.tsx` — orquestrador (mesmo padrão de `goals-wizard.tsx`), com `split-stepper.tsx` (3 passos: Título / Divisão / Resumo).
- `title-step.tsx`, `divide-step.tsx`, `summary-step.tsx`, `split-congrats.tsx`.
- `public-split-view.tsx` — conteúdo da tela pública.

**Tela de lançamentos:**
- `src/components/transactions/share-explainer-card.tsx` — card novo no topo.
- `transactions-manager.tsx` — novo botão na barra de seleção.

## Decisões assumidas (sinalizar se quiser mudar)

1. **Um link só, visível por igual pra todo mundo que abrir** (sem destacar "sua parte" pra cada pessoa) — gerar um link por pessoa exigiria N tokens e complica a jornada; deixei como Fase 2 abaixo.
2. **Sem cobrança/confirmação de pagamento** — o link é só pra comunicar a divisão, não pra rastrear quem já pagou. Também Fase 2.
3. **Links não expiram e não têm limite de acesso** — qualquer pessoa com o link consegue ver enquanto o dono não excluir. Razoável pro caso de uso (dividir conta com amigos), mas é uma decisão de produto que vale confirmar.
4. **Lançamentos de entrada selecionados são ignorados silenciosamente** (com aviso), em vez de bloquear a jornada.

## Fase 2 (fora deste plano, só registrado)

- Link individual por pessoa, com a parte dela em destaque.
- Marcar participante como "já pagou" (rastreamento simples, sem gateway de pagamento).
- Tela "Meus links compartilhados" com histórico completo, não só o link da última criação.

## Verificação (quando for implementar)

1. `npx tsc --noEmit`, `npx eslint`, `npm run build`.
2. Testar os dois modos de divisão (igual e personalizado), incluindo o aviso de valores que não somam no modo personalizado.
3. Testar o aviso de lançamentos de entrada ignorados.
4. Testar link inexistente/excluído na tela pública (estado de erro).
5. Confirmar que excluir ou editar um lançamento depois de gerado o link **não** muda o que aparece no link (snapshot).
