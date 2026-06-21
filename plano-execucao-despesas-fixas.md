# Plano de execução — Ações nos candidatos a despesa fixa (Insights)

> Documento de planejamento. Nenhum código foi escrito ainda. Cobre as mudanças pedidas no painel "Despesas fixas" da tela de Insights (`src/components/insights/insight-sections.tsx`, candidatos vindos de `src/lib/insights-data.ts`).

## Pedido (resumo)

No card de candidatos a despesa fixa:
1. Remover a tag "Alta confiança" / "Possível" (e qualquer outra tag de confiança) — não exibir mais isso.
2. Troca do botão "Marcar X lançamentos como fixos" por um botão de **aceitar** (ícone, não texto).
3. Novo botão **"Ver detalhes"** → abre modal com os lançamentos do grupo, em mais detalhe.
4. Novo botão **remover insight** (descartar a sugestão).
5. Regra de negócio ao **aceitar**: o sistema define o mesmo grupo e sub-grupo para **todas** as transações do grupo (hoje `markTransactionsFixedAction` só seta `isFixed = true`, não toca em categoria). O insight some da lista de **pendentes** e passa a aparecer como **realizado** (não desaparece — fica visível pro cliente lembrar que já foi tratado).
6. Regra de negócio ao **remover/descartar**: marca como "não faz sentido" e nunca mais aparece ali (nem como pendente, nem como realizado).
 

## Por que isso precisa de uma tabela nova

Hoje os candidatos são **recalculados do zero a cada carregamento da página** (`detectFixedExpenseCandidates` em `insights-data.ts`), a partir dos lançamentos não-fixos dos últimos 6 meses. Não existe nenhum registro de "essa sugestão já foi aceita" ou "essa sugestão foi descartada" — então, sem persistir essa decisão, ela voltaria a aparecer como pendente na próxima visita (ou, se aceita, simplesmente desapareceria — porque os lançamentos passam a ter `isFixed = true` e saem do filtro — em vez de aparecer como "realizado", que é o que foi pedido).

Solução: **persistir a decisão do usuário por grupo**, junto com um retrato (snapshot) do que foi decidido, pra não precisar reprocessar nada pra exibir o card "Realizado" depois.

### Chave estável do grupo (`groupKey`)

O campo `key` que existe hoje em `FixedExpenseCandidate` é `${confidence}-${index}` — depende da ordem do array, não é estável entre recálculos. Precisa virar uma chave determinística baseada no critério de agrupamento:

- Grupo por descrição + valor (hoje "alta confiança"): `alta::${descricaoNormalizada}::${valor}`
- Grupo só por descrição (valores variam): `possivel-desc::${descricaoNormalizada}`
- Grupo só por valor (descrições variam): `possivel-amount::${valor}`

Essa chave é o que liga um candidato recalculado a uma decisão já tomada no passado.

## Mudança de schema

Novo modelo em `prisma/schema.prisma` (1 migration):

```prisma
model FixedExpenseInsightDecision {
  id             String   @id @default(cuid())
  userId         String
  groupKey       String
  status         String   // "accepted" | "dismissed"
  description    String   // descrição de referência exibida no card (snapshot)
  amount         Float?   // null quando os valores variam dentro do grupo
  categoryId     String?  // grupo aplicado às transações (quando status = "accepted")
  subcategoryId  String?
  transactionIds String[] // ids dos lançamentos no momento da decisão
  createdAt      DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, groupKey])
  @@map("fixed_expense_insight_decisions")
}
```

Guardar o snapshot (`description`, `amount`, `categoryId`/`subcategoryId`, `transactionIds`) evita ter que re-derivar nada pra desenhar o card "Realizado" — é só ler a decisão.

**Decisão assumida**: a supressão é permanente por `groupKey`, não por mês. Ou seja, se um novo lançamento futuro tiver exatamente a mesma descrição+valor de um grupo já aceito ou descartado, ele não vai gerar um novo card pendente. Isso é intencional (bate com "não devemos mais apresentar ali"), mas vale alinhar: se no futuro a mesma assinatura "voltar" depois de meses cancelada, ela não vai ser sugerida de novo automaticamente.

## Mudanças em `src/lib/insights-data.ts`

1. `detectFixedExpenseCandidates` passa a receber também as decisões já tomadas pelo usuário (`FixedExpenseInsightDecision[]`) e o `groupKey` deixa de ser baseado em índice.
2. Ao montar os grupos "pendentes" (lançamentos não-fixos, recorrentes em ≥2 meses, igual já funciona hoje): **pular** qualquer `groupKey` que já tenha uma decisão "accepted" ou "dismissed".
3. Adicionar uma segunda lista, `fixedExpenseResolvedInsights`, montada **diretamente a partir das decisões com status "accepted"** (sem reprocessar transações) — vira os cards "Realizado". Tipo:

```ts
export type FixedExpenseResolvedInsight = {
  groupKey: string;
  descriptions: string[];
  amount: number | null;
  categoryName: string | null;
  subcategoryName: string | null;
  transactionsCount: number;
  decidedAt: string; // ISO
};
```

4. `FixedExpenseAlert`/`InsightsPageData` ganha `fixedExpenseResolvedInsights: FixedExpenseResolvedInsight[]` ao lado de `fixedExpenseCandidates`.
5. Remover o campo `confidence` da exibição não significa remover do tipo — ele continua existindo internamente (ainda é usado pra decidir a ordem dos grupos e pra computar `groupKey`), só não aparece mais como tag na UI.

## Novas Server Actions (`src/app/(app)/lancamentos/actions.ts`)

### `acceptFixedExpenseInsightAction(groupKey: string, transactionIds: string[])`

1. `requireUserId()`, valida que `transactionIds` pertence todo ao usuário (`findMany` escopado por `userId`).
2. Calcula o grupo/sub-grupo **canônico**: a combinação `(categoryId, subcategoryId)` mais frequente entre as transações do grupo; em caso de empate, usa a do lançamento mais recente (`date` maior). Pode resultar em "sem grupo" se essa for a combinação mais comum — é um resultado válido.
3. `updateMany` nas `transactionIds`: `isFixed: true`, `categoryId`, `subcategoryId` = os canônicos.
4. `upsert` em `FixedExpenseInsightDecision` (`userId_groupKey`) com `status: "accepted"`, salvando `description`/`amount` (a partir da 1ª transação do grupo), `categoryId`/`subcategoryId` canônicos e `transactionIds`.
5. `revalidatePath("/insights")`, `/lancamentos`, `/dashboard`.
6. Retorna `ActionResult` com mensagem (ex.: `"4 lançamentos marcados como fixos em Moradia › Aluguel"`).

### `dismissFixedExpenseInsightAction(groupKey: string, transactionIds: string[], description: string, amount: number | null)`

1. `requireUserId()`.
2. `upsert` em `FixedExpenseInsightDecision` com `status: "dismissed"` (sem tocar em nenhuma `Transaction`).
3. `revalidatePath("/insights")`.
4. Retorna `ActionResult`.

(`markTransactionsFixedAction`, usado hoje pelo `MarkFixedButton`, deixa de ser usado por este fluxo — pode continuar existindo se houver outro uso, ou ser removido se não houver.)

## Mudanças de UI

### `src/components/insights/fixed-expense-candidate-card.tsx` (novo, client)

Substitui o atual `FixedExpenseCandidateRow` (hoje uma função simples dentro de `insight-sections.tsx`) por um componente client, porque agora precisa de estado (modal aberto/fechado, pending das actions). Por candidato pendente, renderiza:

- Título (descrição ou "N descrições diferentes") + valor (ou "Valores variam") + "recorrente em N meses · todo dia X" — **sem nenhuma tag de confiança**.
- 3 botões, todos só com ícone + `aria-label`/`title` (mesmo padrão já usado nos botões "Filtros" e "Baixar Excel" da tela de lançamentos):
  - **Aceitar** (`Check`, verde/primário) → chama `acceptFixedExpenseInsightAction`. Enquanto pendente, mostra spinner; depois de aceito, o item some da lista de pendentes (a página revalida e o item passa a vir em `fixedExpenseResolvedInsights`).
  - **Ver detalhes** (`Eye` ou `ListChecks`) → abre `Modal` (reaproveita `src/components/ui/modal.tsx`) listando cada lançamento do grupo: data, descrição, valor, grupo/sub-grupo atual — pra o cliente conferir antes de aceitar.
  - **Remover** (`X` ou `Trash2`, neutro/discreto) → confirma (reaproveitar `ConfirmDialog`, já que é uma ação que não tem volta fácil) e chama `dismissFixedExpenseInsightAction`.

### Cards "Realizado"

Logo abaixo da lista de pendentes (ou numa subseção colapsável "Já resolvidos"), renderizar `fixedExpenseResolvedInsights`: mesmo título/valor, badge **"Realizado"** (ícone `CheckCircle2`, tom verde, substituindo a antiga tag de confiança — a única tag que continua existindo, mas com outro significado), mostrando o grupo/sub-grupo aplicado. Mantém só o botão **Ver detalhes** (sem Aceitar/Remover, já que a decisão foi tomada).

### `src/components/insights/insight-sections.tsx`

`FixedExpenseAlertCard` passa a receber `candidates` (pendentes) e `resolved` (realizados), e só compõe a seção — toda a interatividade fica dentro de `FixedExpenseCandidateCard`.

### `src/app/(app)/insights/page.tsx`

Passa `data.fixedExpenseCandidates` e `data.fixedExpenseResolvedInsights` pro `FixedExpenseAlertCard`.

## Arquivos afetados (resumo)

**Criar:**
- Migration do `FixedExpenseInsightDecision`.
- `src/components/insights/fixed-expense-candidate-card.tsx`
- `src/components/insights/fixed-expense-details-modal.tsx` (ou inline no card acima, se ficar pequeno)

**Alterar:**
- `prisma/schema.prisma`
- `src/lib/insights-data.ts` (groupKey estável, exclusão por decisão, lista de resolvidos)
- `src/app/(app)/lancamentos/actions.ts` (`acceptFixedExpenseInsightAction`, `dismissFixedExpenseInsightAction`)
- `src/components/insights/insight-sections.tsx` (remove tags, usa o novo card client, renderiza seção "Realizado")
- `src/app/(app)/insights/page.tsx` (passa os novos dados)

**Possivelmente remover/depreciar:**
- `src/components/insights/mark-fixed-button.tsx` (se nada mais usar o `markTransactionsFixedAction` antigo depois da troca).

## Decisões assumidas (sinalizar antes de implementar se quiser mudar algo)

1. **Critério de grupo/sub-grupo canônico ao aceitar**: combinação mais frequente entre as transações do grupo; empate resolvido pela transação mais recente. Alternativa seria deixar o usuário escolher manualmente no modal de detalhes — não fiz isso pra manter a ação de "Aceitar" em 1 clique, como o pedido sugere.
2. **Supressão permanente por `groupKey`** (tanto aceito quanto descartado), sem reativação automática se o padrão "voltar" meses depois.
3. **Realizados não têm ação de desfazer** nesta primeira versão (só "Ver detalhes"). Se for necessário, dá pra adicionar um botão "Desfazer" que reverte a decisão (apaga a `FixedExpenseInsightDecision` e desmarca `isFixed`) — não está no pedido original, por isso ficou de fora.

## Verificação (depois de implementado)

1. `npx tsc --noEmit`, `npx eslint` nos arquivos tocados, `npm run build`.
2. Manual: aceitar um grupo → some dos pendentes, aparece em "Realizado", lançamentos no `/lancamentos` aparecem com o mesmo grupo/sub-grupo e `isFixed = true`.
3. Manual: remover um grupo → some da lista, não reaparece num novo carregamento da página de Insights.
4. Manual: "Ver detalhes" mostra a lista correta de lançamentos do grupo, tanto pendente quanto realizado.
