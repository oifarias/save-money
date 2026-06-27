# Plano — Lançamento Manual em Lote e Campos Corretos por Tipo

## Seção 1 — Diagnóstico

### 1.1 Fluxo atual (ponta a ponta)

**Ponto de entrada:** `src/app/(app)/lancamentos/page.tsx` (linha 117) renderiza `<TransactionIntake categories={formCategories} tagSuggestions={tagSuggestions} />`.

**`TransactionIntake`** (`src/components/transactions/transaction-intake.tsx`):
- Dois cards de ação: "Individual" (abre Modal, linhas 33–51) e "Importar planilha" (link para `/lancamentos/importar`, linhas 53–70).
- Estado `formOpen: boolean` (linha 15) controla o Modal.
- Estado `formKey: number` (linha 16) força re-montagem do `TransactionForm` ao fechar via `closeForm()` (linhas 18–21).
- O Modal (`src/components/ui/modal`) envolve `<TransactionForm key={formKey} ...>` (linha 74).

**`TransactionForm`** (`src/components/transactions/transaction-form.tsx`):
- `useActionState` ligado a `createTransactionAction` ou `updateTransactionAction` conforme prop `transaction` (linha 50).
- Estado `type: "EXPENSE" | "INCOME"` (linha 51) — muda apenas a cor do toggle, **não altera os campos exibidos**.
- Estado `isInstallment: boolean` (linha 54) — controla exibição do campo de parcelas.
- Campos sempre visíveis: Tipo (linhas 80–107), Data/Valor (linhas 109–131), Descrição (linhas 133–141), Grupo/Sub-grupo (linhas 143–194).
- **Bloco "Repetição + Despesa fixa"** (linhas 196–225): exibido para **ambos os tipos** sem distinção. O label "Despesa fixa" é hardcoded (linha 222).
- **Bloco "Esta despesa é parcelada?"** (linhas 227–261): exibido apenas em criação (`!transaction`, linha 227), mas sem distinção de tipo — exibe "despesa" mesmo quando `type = INCOME`.
- `TagInput` (linha 263): uncontrolled, serializa tags para `<input type="hidden" name="tags" value={JSON.stringify(tags)} />` (tag-input.tsx linha 57).
- Submit via FormData nativa do `<form action={formAction}>` (linha 76).

**`createTransactionAction`** (`src/app/(app)/lancamentos/actions.ts`, linha 79):
- Recebe `FormData`, parseia via `parseFormData()` (linhas 50–77), valida com `transactionSchema`.
- Se `isInstallment && totalInstallments`: cria `InstallmentPlan` + N transações via `createInstallmentPlanWithTransactions` (linhas 100–124).
- Senão: `prisma.$transaction` criando 1 transação (linhas 126–169).
- Chama `resolveInstallmentPlan` para detectar parcelamento por padrão de texto (linha 127).
- Chama `resolveFixedExpenseTemplate` para QUALQUER tipo quando `isFixed = true` — inclusive INCOME (linha 135). Este é um bug latente: `FixedExpenseTemplate` é semanticamente uma entidade de despesa, usada na checklist de despesas fixas.
- Invalida caches de dashboard, comparativo e insights; `revalidatePath("/dashboard")` e `revalidatePath("/lancamentos")`.

### 1.2 Campos relevantes do schema Prisma

`Transaction` (`prisma/schema.prisma`, linhas 182–222):
- `type: TransactionType` — EXPENSE | INCOME
- `isFixed: Boolean @default(false)` — campo neutro de tipo; a **semântica de "fixo" muda por tipo** (EXPENSE → gera `FixedExpenseTemplate`; INCOME → apenas marca a receita como recorrente)
- `recurrence: Recurrence @default(NONE)` — NONE | WEEKLY | MONTHLY; presente mas semanticamente irrelevante para o fluxo de INCOME conforme pedido
- `installmentPlanId`, `installmentNumber` — só relevante para EXPENSE
- `fixedExpenseTemplateId` — criado por `resolveFixedExpenseTemplate`; semanticamente só faz sentido para EXPENSE

`transactionSchema` (`src/lib/validations/transaction.ts`):
- Valida todos os campos sem distinção de tipo (`isFixed: z.boolean().optional()`, `isInstallment: z.boolean().optional()`, `totalInstallments: z.string().trim().optional()`).
- Não há `superRefine` guardando `isInstallment` para `type = "EXPENSE"` — qualquer payload pode enviar `isInstallment = true` com `type = "INCOME"`.

### 1.3 Padrão de lote existente: `WishBatchModal`

`src/components/wishes/wish-batch-modal.tsx` implementa exatamente o padrão de accordeon solicitado:

- Tipo interno `ItemDraft` com campo `key: string` (timestamp + random, linha 32–41).
- Estado `items: ItemDraft[]` (começa com 1 item, linha 66) e `expandedKey: string | null` (linha 67).
- **Item colapsado** (linhas 207–230): `<button>` exibe nome/valor + ChevronDown; clique chama `toggleExpanded`.
- **Item expandido** (linhas 233–362): `<div>` com formulário controlado por estado React + botão "Remover" (Trash2).
- `addItem()` (linhas 86–90): cria novo item e o expande automaticamente.
- `removeItem()` (linhas 92–99): mantém mínimo de 1 item; redireciona `expandedKey` para o último item restante.
- `toggleExpanded()` (linhas 101–103): toggle simples entre expanded e null.
- **Submit único** via `useTransition` + chamada direta à Server Action `createWishBatchAction` (linhas 108–142) — sem FormData, sem `useActionState`.
- Reseta para estado inicial com `reset()` após submit bem-sucedido (linhas 74–80).

**Diferença principal** em relação ao pedido: no `WishBatchModal` não há botão explícito "Confirmar item" — o item ativo fica expandido e os demais ficam colapsados. Este padrão é mais prático e já validado na UI. A recomendação é adotar o mesmo fluxo em vez de exigir um clique extra de "confirmar".

### 1.4 `TagInput` — modo controlado ausente

`src/components/transactions/tag-input.tsx`:
- Props: `name`, `label`, `defaultTags`, `suggestions`, `error` (linha 7–13). Sem `value`/`onChange`.
- Mantém estado interno `tags: string[]` inicializado com `defaultTags` (linha 16). Completamente uncontrolled.
- Serializa para `<input type="hidden" name={name} value={JSON.stringify(tags)} />` (linha 57).
- No batch panel, onde cada item tem seu próprio array de tags gerenciado no estado pai, o componente precisará de suporte a modo controlado.

---

## Seção 2 — Tarefas detalhadas

### Tarefa 1 — Corrigir campos exibidos por tipo no `TransactionForm`

**Prioridade:** Alta | **Arquivo:** `src/components/transactions/transaction-form.tsx`

**O que muda:**

1. Adicionar estado `isFixedIncome: boolean` (default: `false`), inicializado com `transaction?.isFixed ?? false` quando `type = "INCOME"`.

2. Envolver o bloco inteiro "Repetição + Despesa fixa" (linhas 196–225) em condicional `{type === "EXPENSE" && (...)}`.

3. Envolver o bloco "Esta despesa é parcelada?" (linhas 227–261) em condicional `{type === "EXPENSE" && !transaction && (...)}`.

4. Adicionar novo bloco `{type === "INCOME" && (...)}` com toggle "Fixa / Variável":
   - Dois botões estilo radio-card (mesmo padrão visual do toggle EXPENSE/INCOME, linhas 83–106).
   - "Fixa" → `setIsFixedIncome(true)` → renderiza `<input type="hidden" name="isFixed" value="on" />`.
   - "Variável" → `setIsFixedIncome(false)` → não envia `isFixed` (ou envia `value=""`).
   - Label descritivo abaixo: "Fixa: salário, aluguel recebido — Variável: pix de amigo, venda pontual".

5. No handler `setType`, resetar `isFixedIncome` para `false` quando mudar para INCOME (ou manter o valor do `transaction` se estiver em modo edição).

6. `recurrence` para INCOME: não exibir o select — definir `<input type="hidden" name="recurrence" value="NONE" />` implicitamente quando `type = "INCOME"` (campo existe no schema mas é irrelevante para o fluxo pedido).

**Impacto no backend:** `parseFormData` já trata `isFixed` via `formData.get("isFixed") === "on"` (actions.ts linha 72). Um `<input type="hidden" value="on">` funciona identicamente ao checkbox marcado — sem mudança no servidor.

**Dependências:** Nenhuma. Esta tarefa pode ser implementada de forma independente e testada no formulário de edição/criação individual antes de migrar para o batch panel.

---

### Tarefa 2 — Adicionar guarda de tipo em `createTransactionAction` para `resolveFixedExpenseTemplate`

**Prioridade:** Alta (bug latente) | **Arquivo:** `src/app/(app)/lancamentos/actions.ts`

**O que muda:**

Na função `createTransactionAction` (linha 135) e `updateTransactionAction` (linha 208), a chamada a `resolveFixedExpenseTemplate` deve ser condicionada a `type === "EXPENSE"`:

```typescript
// Antes (linhas 135–143 de createTransactionAction):
const fixedExpenseInfo = await resolveFixedExpenseTemplate(tx, userId, { isFixed: Boolean(isFixed), ... });

// Depois:
const fixedExpenseInfo = type === "EXPENSE"
  ? await resolveFixedExpenseTemplate(tx, userId, { isFixed: Boolean(isFixed), ... })
  : { fixedExpenseTemplateId: null };
```

Mesmo ajuste em `updateTransactionAction` (linhas 208–217). Garantir que `fixedExpenseTemplateId` seja gravado como `null` para lançamentos INCOME.

**Dependências:** Nenhuma. Pode ser implementada antes das demais tarefas.

---

### Tarefa 3 — Adicionar guarda de tipo na `transactionSchema`

**Prioridade:** Média | **Arquivo:** `src/lib/validations/transaction.ts`

**O que muda:**

Adicionar `superRefine` que rejeita `isInstallment = true` quando `type = "INCOME"`:

```typescript
.superRefine((data, ctx) => {
  if (data.isInstallment && !data.totalInstallments) {
    ctx.addIssue({ code: "custom", path: ["totalInstallments"], message: "Informe a quantidade de parcelas" });
  }
  if (data.isInstallment && data.type === "INCOME") {
    ctx.addIssue({ code: "custom", path: ["isInstallment"], message: "Parcelamento não se aplica a entradas" });
  }
});
```

Isso protege o servidor caso um payload manipulado tente criar `InstallmentPlan` para INCOME.

**Dependências:** Nenhuma.

---

### Tarefa 4 — Estender `TagInput` para suportar modo controlado

**Prioridade:** Alta (bloqueante para Tarefa 6) | **Arquivo:** `src/components/transactions/tag-input.tsx`

**O que muda:**

Adicionar props opcionais `value?: string[]` e `onChange?: (tags: string[]) => void`. Quando presentes, o componente opera em modo controlado (sem estado interno `tags`); quando ausentes, mantém o comportamento atual (uncontrolled com `defaultTags`).

```typescript
type TagInputProps = {
  name?: string;         // torna opcional: sem name, não renderiza o hidden input
  label?: string;
  defaultTags?: string[];
  value?: string[];      // novo: modo controlado
  onChange?: (tags: string[]) => void; // novo: callback de mudança
  suggestions?: string[];
  error?: string;
};
```

Internamente:
- `const isControlled = value !== undefined;`
- `const [internalTags, setInternalTags] = useState<string[]>(defaultTags ?? []);`
- `const tags = isControlled ? value! : internalTags;`
- `function setTags(next: string[] | ((prev: string[]) => string[])): void { ... }` — se controlado, chama `onChange`; senão, `setInternalTags`.
- O `<input type="hidden">` só é renderizado quando `name` é fornecido.

O comportamento de `addTag`, `removeTag` e `handleKeyDown` permanece idêntico — apenas a fonte de verdade de `tags` muda.

**Dependências:** Nenhuma.

---

### Tarefa 5 — Criar `batchCreateTransactionSchema`

**Prioridade:** Alta (bloqueante para Tarefa 7) | **Arquivo:** `src/lib/validations/transaction.ts`

**O que muda:**

Adicionar ao final do arquivo:

```typescript
export const batchCreateTransactionSchema = z.object({
  items: z
    .array(transactionSchema)
    .min(1, "Adicione ao menos um lançamento")
    .max(50, "Limite de 50 lançamentos por lote"),
});

export type BatchCreateTransactionInput = z.infer<typeof batchCreateTransactionSchema>;
```

Reutiliza `transactionSchema` por item, sem duplicação. O limite de 50 é provisório — ver Decisão D5.

**Dependências:** Tarefa 3 (para que o schema já tenha o superRefine de tipo antes de ser composto).

---

### Tarefa 6 — Criar `createTransactionBatchAction`

**Prioridade:** Alta (bloqueante para Tarefa 7) | **Arquivo:** `src/app/(app)/lancamentos/actions.ts`

**O que muda:**

Adicionar nova Server Action exportada `createTransactionBatchAction(items: unknown): Promise<ActionResult>`. Assinatura com dado tipado (não FormData), no padrão de `payFixedExpensesAction` e `bulkUpdateTransactionsAction`.

Lógica:
1. `requireUserId()`
2. `batchCreateTransactionSchema.safeParse(items)` — retorna erro se inválido.
3. `getDefaultAccountId(userId)` — retorna erro se nulo.
4. `prisma.$transaction(async (tx) => { ... })` — toda a operação é atômica:
   - Para cada item do array:
     - `resolveCategoryAndSubcategory` — retorna `fieldErrors` indexado pela posição se houver erro (ex.: `{ "items[2].categoryId": "..." }`).
     - Se `isInstallment && totalInstallments`: `createInstallmentPlanWithTransactions` + `syncTransactionTags`.
     - Senão: `resolveInstallmentPlan`, depois **somente se `type === "EXPENSE"`** `resolveFixedExpenseTemplate`, depois `tx.transaction.create`, depois `syncTransactionTags`.
5. `revalidatePath("/dashboard")`, `revalidatePath("/lancamentos")`, `invalidateAggregateCaches(userId)`.
6. Retorna `{ success: true, message: "X lançamento(s) registrado(s)" }`.

**Erros por item:** Em caso de falha de validação de categoria em um item específico, retornar `fieldErrors` com chave indexada (`"items[1].categoryId"`) para que o batch panel possa abrir o item com erro e realçar o campo. Esta é uma melhoria de UX opcional para a primeira versão — a v1 pode retornar apenas o erro genérico da transação como um todo.

**Dependências:** Tarefas 3, 5.

---

### Tarefa 7 — Criar `TransactionBatchPanel`

**Prioridade:** Alta | **Arquivo a criar:** `src/components/transactions/transaction-batch-panel.tsx`

**O que é:**

Componente client-side (`"use client"`) modelado diretamente no `WishBatchModal`, adaptado para lançamentos com todos os campos do `TransactionForm`.

**Tipo interno:**

```typescript
type ItemDraft = {
  key: string;
  type: "EXPENSE" | "INCOME";
  date: string;
  description: string;
  amount: string;
  categoryId: string;
  subcategoryId: string;
  isFixed: boolean;
  recurrence: "NONE" | "WEEKLY" | "MONTHLY";
  tags: string[];
  isInstallment: boolean;
  totalInstallments: string;
};

function createItem(): ItemDraft {
  return {
    key: `item-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type: "EXPENSE",
    date: todayISODate(),
    description: "",
    amount: "",
    categoryId: "",
    subcategoryId: "",
    isFixed: false,
    recurrence: "NONE",
    tags: [],
    isInstallment: false,
    totalInstallments: "",
  };
}
```

**Estado:**

```typescript
const [items, setItems] = useState<ItemDraft[]>([createItem()]);
const [expandedKey, setExpandedKey] = useState<string | null>(items[0]?.key ?? null);
const [isPending, startTransition] = useTransition();
const [itemErrors, setItemErrors] = useState<Record<string, Record<string, string>>>({});
// chave: item.key → fieldErrors daquele item
```

**Funções:** `addItem`, `removeItem` (mínimo 1), `updateItem`, `toggleExpanded`, `reset`.

**Item colapsado** mostra:
- Ícone colorido por tipo (TrendingDown vermelho para EXPENSE, TrendingUp verde para INCOME).
- Descrição (ou "Item N" se vazia) + valor formatado.
- Badge "Fixa" se `isFixed = true`.
- Badge "Nx" se `isInstallment = true` e `totalInstallments` preenchido.
- ChevronDown + botão Trash2 inline (Trash2 só visível se `items.length > 1`).

**Item expandido** contém o formulário completo controlado por estado React (sem `<form>` com server action):
- Toggle Tipo: mesma aparência do `TransactionForm` (linhas 82–106 do transaction-form.tsx).
- Campos Data, Valor, Descrição.
- Selects Grupo/Sub-grupo (com o botão "Novo grupo" que abre `CategoryForm` em Modal aninhado).
- **Para EXPENSE**: bloco Repetição + Despesa fixa + Parcelada? (igual ao `TransactionForm` pós-Tarefa 1).
- **Para INCOME**: bloco Fixa/Variável (igual ao adicionado na Tarefa 1).
- `TagInput` em modo controlado (`value={item.tags}` `onChange={(tags) => updateItem(item.key, { tags })}`).
- Erros de campo exibidos por `itemErrors[item.key]`.

**Submit:**

```typescript
function handleSubmit(event: React.FormEvent) {
  event.preventDefault();

  // Validação client-side prévia com Zod
  const parsed = batchCreateTransactionSchema.safeParse({
    items: items.map((item) => ({
      type: item.type,
      date: item.date,
      description: item.description,
      amount: item.amount,
      categoryId: item.categoryId,
      subcategoryId: item.subcategoryId,
      isFixed: item.isFixed,
      recurrence: item.recurrence,
      tags: item.tags,
      isInstallment: item.isInstallment,
      totalInstallments: item.totalInstallments,
    })),
  });

  if (!parsed.success) {
    // mapear erros por item e exibir; expandir o primeiro item com erro
    return;
  }

  startTransition(async () => {
    const result = await createTransactionBatchAction(parsed.data.items);
    if (!result.success) {
      toast.error(result.message ?? "Erro ao salvar lançamentos");
      return;
    }
    toast.success(result.message ?? "Lançamentos salvos");
    reset();
    onDone();
  });
}
```

**Props:**

```typescript
type TransactionBatchPanelProps = {
  open: boolean;
  categories: TransactionFormCategory[];
  tagSuggestions: string[];
  onClose: () => void;
};
```

Abre dentro de `<Modal size="lg" title="Novo lançamento" ...>`.

**Dependências:** Tarefas 4 (TagInput controlado), 5, 6.

---

### Tarefa 8 — Atualizar `TransactionIntake` para usar o batch panel

**Prioridade:** Alta | **Arquivo:** `src/components/transactions/transaction-intake.tsx`

**O que muda:**

- Substituir `import { TransactionForm }` por `import { TransactionBatchPanel }`.
- Remover estado `formKey` (o batch panel gerencia seu próprio reset internamente via `reset()`).
- Substituir `<Modal>` + `<TransactionForm>` (linha 73–75) por `<TransactionBatchPanel open={formOpen} ... onClose={closeForm} />`.
- O batch panel internamente já contém o Modal — `TransactionIntake` passa apenas `open`, `categories`, `tagSuggestions` e `onClose`.
- Label do botão "Individual" (linha 42): ajustar para "Manual" ou "Lançamento manual" — ver Decisão D6.

**Dependências:** Tarefa 7.

---

### Ordem de execução recomendada

```
Tarefa 2 (bug fix: guarda de tipo no resolver)          ← sem dependências, mergear primeiro
Tarefa 3 (superRefine no schema)                        ← sem dependências
Tarefa 1 (campos por tipo no TransactionForm)           ← sem dependências; pode ir junto com 2 e 3
─────────────────────────────────────────────────────────────
Tarefa 4 (TagInput controlado)                          ← sem dependências
Tarefa 5 (batchCreateTransactionSchema)                 ← depende de Tarefa 3
─────────────────────────────────────────────────────────────
Tarefa 6 (createTransactionBatchAction)                 ← depende de Tarefas 3, 5
─────────────────────────────────────────────────────────────
Tarefa 7 (TransactionBatchPanel)                        ← depende de Tarefas 1, 4, 5, 6
─────────────────────────────────────────────────────────────
Tarefa 8 (TransactionIntake)                            ← depende de Tarefa 7
```

As Tarefas 2, 3 e 1 podem entrar em PR separado (corretivo de UX/bug). As Tarefas 4–8 formam o PR da feature de lote.

---

## Seção 3 — Decisões de produto pendentes

**D1 — Modal ou seção inline para o batch panel?**
O padrão existente (`WishBatchModal`) usa Modal `size="lg"`. O pedido menciona "tela/seção de lançamento em lote". Opções:
- (a) Modal grande — consistente com `WishBatchModal`, sem mudar o layout da página de lançamentos.
- (b) Seção que expande inline na tela — mais espaço disponível, mas altera estrutura visual da página.

Recomendação: Modal grande (opção a), consistente com o padrão já existente.

**D2 — "Confirmar item" explícito ou padrão de expansão automática?**
O pedido descreve um botão "Confirmar" por item. O `WishBatchModal` usa abordagem diferente: o item mais recente fica expandido; clicar em outro item colapsa o atual e expande o clicado.
- (a) Botão "Confirmar item" explícito: adiciona passo extra, mas deixa o fluxo mais guiado.
- (b) Padrão de expansão automática (como wishes): menos cliques, mais fluido.

Recomendação: padrão de expansão automática (opção b), pois já está validado na UI de desejos.

**D3 — O que mostrar no accordion colapsado?**
Proposta: `[ícone tipo] Descrição · R$ valor · [badge "Fixa" se aplicável] · [badge "Nx" se parcelado]`. Confirmar se esse resumo é suficiente para identificar o item sem expandir.

**D4 — Campo "Repetição" (recurrence) para INCOME**
O campo existe no schema mas não é mencionado nos requisitos para INCOME. Opções:
- (a) Remover de INCOME, fixar `recurrence = "NONE"` no backend.
- (b) Manter para INCOME (mais completo, mas fora do escopo pedido).

Recomendação: remover para INCOME (opção a), simplificar UX conforme pedido. O campo `recurrence` para INCOME tem pouca utilidade prática no fluxo atual do app.

**D5 — Limite de itens por lote**
O schema proposto tem `max(50)`. Para lançamentos manuais em lote, este número é razoável?

**D6 — Label do botão "Individual" em `TransactionIntake`**
Com o batch panel, o botão "Individual" passa a abrir um formulário de múltiplos itens. O label fica semanticamente errado. Sugestões: "Manual", "Lançamento manual", "Inserir manualmente". Confirmar preferência.

**D7 — Comportamento após "Salvar todos" com sucesso**
Após submit bem-sucedido: fechar o Modal e resetar o batch panel (padrão `WishBatchModal`)? Ou manter o Modal aberto com o painel vazio para incentivar novo lote? Recomendação: fechar (padrão wishes).

---

## Seção 4 — Riscos e edge cases

**R1 — Atomicidade do lote com installment plans**
`createTransactionBatchAction` usa `prisma.$transaction()` externo. Cada item com `isInstallment = true` chama `createInstallmentPlanWithTransactions`, que internamente cria 1 `InstallmentPlan` + N `Transaction`. Se o item 3 de 5 falhar, o rollback desfaz os itens 1 e 2 também. Este é o comportamento correto para consistência, mas o usuário perde tudo. Considerar estratégia de retry ou submit parcial (fora do escopo v1 — registrar como limitação conhecida).

**R2 — `resolveFixedExpenseTemplate` com múltiplos itens fixos de mesma descrição no mesmo lote**
Se o usuário adicionar dois itens com `isFixed = true` e mesma descrição no mesmo lote, dentro da `prisma.$transaction()` o segundo item encontrará o template criado pelo primeiro (pela busca por descrição normalizada em `fixed-expense-resolver.ts`, linhas 87–99). Ambos serão vinculados ao mesmo template — comportamento esperado (é a mesma despesa fixa). Se for comportamento indesejado, documentar como limitação.

**R3 — Tela vazia do batch panel (0 itens)**
`removeItem` deve manter mínimo de 1 item (mesmo padrão do `WishBatchModal`, linha 94: `if (current.length <= 1) return current`). O botão "Remover" deve ser ocultado ou desabilitado quando há apenas 1 item.

**R4 — Validação client-side por item com Zod**
O batch panel não usa `useActionState` por item, então sem validação client-side o usuário só vê erros após o round-trip ao servidor. Implementar validação com `batchCreateTransactionSchema.safeParse()` antes de chamar a action (incluído na Tarefa 7) e mapear erros para cada item via `itemErrors[item.key]`. O primeiro item com erro deve ser expandido automaticamente.

**R5 — TagInput em modo controlado (re-montagem ao expandir/colapsar)**
O `TagInput` atual inicializa estado interno com `defaultTags` em `useState` (linha 16 do tag-input.tsx). Se o componente for re-montado ao expandir/recolher o accordeon, os drafts de tags em andamento (texto digitado mas não confirmado) se perdem. A Tarefa 4 (modo controlado) resolve isso: o estado de tags fica no item draft do pai, sobrevivendo a re-montagem.

**R6 — `isFixed = true` para INCOME não deve criar `FixedExpenseTemplate`**
`resolveFixedExpenseTemplate` (`src/lib/fixed-expense-resolver.ts`) cria templates independente do tipo de transação — a guarda de tipo (Tarefa 2) no `createTransactionAction` é obrigatória antes de disponibilizar o formulário de INCOME com `isFixed = true`.

**R7 — `isInstallment = true` enviado para INCOME via payload manipulado**
O `superRefine` da Tarefa 3 protege o servidor. Sem ele, um payload malicioso poderia criar `InstallmentPlan` para uma entrada — inconsistência estrutural que contamina o histórico de parcelamentos.

**R8 — `CategoryForm` dentro do batch panel (Modal aninhado)**
O `TransactionForm` atual abre `<CategoryForm>` em Modal aninhado (`src/components/groups/category-form.tsx`) ao clicar em "Novo grupo". O batch panel precisará do mesmo comportamento, mas o Modal aninhado opera sobre o item expandido no momento. Após criar a categoria, `router.refresh()` é chamado (transaction-form.tsx linha 70) — isso força o re-fetch dos dados do servidor e atualiza as opções do select. Verificar se `router.refresh()` dentro de um Modal aninhado em outro Modal funciona corretamente na versão atual do Next.js App Router.

**R9 — Revalidação de cache ao salvar lote de 0 itens válidos**
Se `createTransactionBatchAction` for chamada com array vazio (edge case de race condition no client), o schema `min(1)` retorna erro de validação antes de qualquer mutação — sem revalidação desnecessária de cache. Correto.

**R10 — Performance do `prisma.$transaction` com lote grande**
Cada item dentro da transação faz múltiplas queries (resolveInstallmentPlan, resolveFixedExpenseTemplate, transaction.create, syncTransactionTags). Para 50 itens, isso pode acumular latência perceptível. Não é bloqueante para v1, mas é candidato a otimização (ex.: batch insert, consultas de templates antecipadas fora do loop).
