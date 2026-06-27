# Cenários de criação de despesas

Data: 2026-06-27  
Escopo: todos os caminhos que criam um registro `Transaction` com `type = "EXPENSE"` no banco.

---

## Visão geral dos campos críticos

| Campo DB | Tipo | Quando é preenchido |
|---|---|---|
| `isFixed` | Boolean | Despesa marcada como fixa (assinatura, aluguel etc.) |
| `recurrence` | NONE / WEEKLY / MONTHLY | Repetição; apenas armazena — não gera novas transações |
| `installmentPlanId` | FK | Vincula a um `InstallmentPlan` (parcelado) |
| `installmentNumber` | Int | Número da parcela dentro do plano (1, 2, 3…) |
| `fixedExpenseTemplateId` | FK | Vincula ao template fixo (alimenta o checklist mensal) |
| `referenceMonth` | String YYYY-MM | **Exclusivo do Cenário 4** — identifica mês do pagamento |

---

## Cenário 1 — Lançamento único (formulário de edição)

**Onde:** modal "Editar lançamento" na tela `/lancamentos`  
**Componente:** `src/components/transactions/transaction-form.tsx`  
**Server Action:** `createTransactionAction` (`src/app/(app)/lancamentos/actions.ts`)  
**Schema:** `transactionSchema` (`src/lib/validations/transaction.ts`)

### Subcenários

#### 1A — Despesa simples (variável, sem repetição)
- `isFixed = false`, `recurrence = "NONE"`, `isInstallment = false`
- Fluxo: `resolveInstallmentPlan` (sem match regex) → `resolveFixedExpenseTemplate` (isFixed=false, sem template) → `tx.transaction.create`
- **Banco:** 1 `Transaction` (`isFixed=false`, `fixedExpenseTemplateId=null`, `installmentPlanId=null`)

#### 1B — Despesa fixa (nova)
- `isFixed = true`, `isInstallment = false`
- Fluxo: `resolveFixedExpenseTemplate` detecta que não existe template para a descrição normalizada → cria 1 `FixedExpenseTemplate` (`expectedAmount`, `dueDay` extraído da data) → `tx.transaction.create` com `fixedExpenseTemplateId`
- **Banco:** 1 `FixedExpenseTemplate` + 1 `Transaction` (`isFixed=true`, `fixedExpenseTemplateId` preenchido)

#### 1C — Despesa fixa (reutiliza template existente)
- `isFixed = true`, descrição normalizada já existe em `FixedExpenseTemplate`
- Fluxo: `resolveFixedExpenseTemplate` faz match por descrição → reutiliza template existente → `tx.transaction.create`
- **Banco:** 1 `Transaction` linkada ao template pré-existente (sem criar novo template)

#### 1D — Despesa com repetição
- `isFixed = false/true`, `recurrence = "WEEKLY"` ou `"MONTHLY"`
- Fluxo: igual a 1A ou 1B/1C; `recurrence` é apenas armazenado — não gera transações adicionais automaticamente
- **Banco:** igual a 1A ou 1B conforme `isFixed`

#### 1E — Despesa parcelada (via flag "É parcelada?")
- `isInstallment = true`, `totalInstallments = N` (2–360)
- Fluxo: **ignora** `resolveInstallmentPlan` e `resolveFixedExpenseTemplate` → chama `createInstallmentPlanWithTransactions` → cria 1 `InstallmentPlan` e gera N `Transaction` com datas mensais sequenciais, descrição com sufixo `(x/N)`
- **Banco:** 1 `InstallmentPlan` + N `Transaction` (`installmentPlanId` preenchido em todas, `isFixed=false`, `fixedExpenseTemplateId=null`)

#### 1F — Despesa parcelada (detectada por padrão `(x/N)` na descrição)
- `isInstallment = false`, mas a descrição contém `(x/N)` (ex.: "Netflix (2/6)")
- Fluxo: `resolveInstallmentPlan` detecta padrão regex → encontra ou cria `InstallmentPlan` → vincula a transação
- **Banco:** 1 `Transaction` com `installmentPlanId` (plano criado/reutilizado por regex)

---

## Cenário 2 — Lançamento em lote (batch manual)

**Onde:** tela `/lancamentos/novo`  
**Componente:** `src/components/transactions/transaction-batch-panel.tsx`  
**Server Action:** `createTransactionBatchAction` (`src/app/(app)/lancamentos/actions.ts`)  
**Schema:** `batchCreateTransactionSchema` — array de `transactionSchema` (1–50 itens)

### Comportamento
- Para cada item do array, aplica a mesma lógica do Cenário 1 (1A–1F) dentro de um único `prisma.$transaction()`
- A operação inteira é atômica: se qualquer item falhar, todos fazem rollback
- Categorias são validadas via `resolveCategoryAndSubcategory` antes de abrir a transação
- `resolveFixedExpenseTemplate` só é chamado quando `type === "EXPENSE"` (entradas não criam templates)

### O que é criado por item
| Tipo de item | Banco |
|---|---|
| Despesa simples | 1 `Transaction` |
| Despesa fixa (nova) | 1 `FixedExpenseTemplate` + 1 `Transaction` |
| Despesa fixa (existente) | 1 `Transaction` (reutiliza template) |
| Despesa parcelada (flag) | 1 `InstallmentPlan` + N `Transaction` |

### Diferença do Cenário 1
- Não usa `FormData` — o payload é um array de objetos tipados
- `isFixed` chega como `boolean` direto (não via `formData.get("isFixed") === "on"`)

---

## Cenário 3 — Importação via planilha

**Onde:** tela `/lancamentos/importar`  
**Componente:** `src/components/transactions/import-wizard.tsx`  
**Server Action:** `importTransactionsAction`  
**Schema:** `importRowSchema` por linha (com normalização prévia de datas, valores, tipos, parcelas e flag fixa)

### Etapas de processamento
1. **Upload** do arquivo `.xlsx` / `.xls`
2. **Mapeamento de colunas** pelo usuário (Data, Tipo, Descrição, Valor, Categoria, Sub-categoria, Tags, Parcelas `x/y`, Despesa fixa `sim/true/x`)
3. **Normalização** de cada linha: `normalizeDate`, `normalizeAmount`, `normalizeType`, `normalizeInstallments`, `normalizeFixedFlag`
4. **Revisão inline** — usuário pode editar campos antes de confirmar
5. **Confirmação** → `importTransactionsAction`

### Subcenários

#### 3A — Linha simples
- Coluna "Parcelas" ausente ou vazia, flag fixa = false
- Fluxo: igual a 1A
- **Banco:** 1 `Transaction`

#### 3B — Linha com flag fixa
- Flag fixa = `sim` / `true` / `x`
- Fluxo: `resolveFixedExpenseTemplate` → igual a 1B ou 1C
- **Banco:** 1 `FixedExpenseTemplate` (se nova) + 1 `Transaction`

#### 3C — Linha parcelada via coluna `x/y`
- Coluna "Parcelas" = "2/6" (parcela atual / total)
- Fluxo: calcula `planStartDate = addMonths(rowDate, -(x-1))` → `createInstallmentPlanWithTransactions` com `startInstallmentNumber = x` (materializa apenas parcelas `x..y`)
- **Banco:** 1 `InstallmentPlan` + (y-x+1) `Transaction`

#### 3D — Criação automática de categoria
- Categoria/subcategoria da linha não existe para o usuário
- Fluxo: `findOrCreateRootCategory` / `findOrCreateSubcategory` antes de criar a transação
- **Banco:** 0–2 `Category` (parent + child) + 1 `Transaction`

---

## Cenário 4 — Marcar despesa fixa como paga (checklist)

**Onde:** componente `FixedExpensesChecklist` em `/lancamentos` e `/dashboard`  
**Server Action:** `payFixedExpensesAction` (`src/app/(app)/lancamentos/actions.ts`)  
**Schema:** array de `{ templateId, paidDate: "YYYY-MM-DD", paidAmount }`

### Comportamento
- **Pré-requisito:** `FixedExpenseTemplate` já existe (criado no Cenário 1B, 2 ou 3B)
- Para cada item: busca o template (`isActive=true`, mesmo `userId`) → cria 1 `Transaction`
- Campo `referenceMonth = paidDate.slice(0, 7)` (ex.: `"2026-06"`) — **único cenário que preenche esse campo**
- Unique constraint `[fixedExpenseTemplateId, referenceMonth]` impede pagamento duplo no mesmo mês

### O que é criado
- 1 `Transaction` por item com:
  - `isFixed = true`
  - `fixedExpenseTemplateId` preenchido
  - `referenceMonth = "YYYY-MM"`
  - `amount = paidAmount` (pode ser diferente do `expectedAmount` do template)
  - `date = paidDate` (pode ser diferente do `dueDay` do template)

### Falhas silenciosas por item
| Situação | Resultado |
|---|---|
| Template não encontrado ou inativo | Item ignorado, `notFoundCount++` |
| Já pago no mesmo mês (unique constraint P2002) | Item ignorado, `alreadyPaidCount++` |
| Qualquer outro erro | Toda a transação é abortada (throw) |

---

## Cenário 5 — Aceitar insight de despesa fixa

**Onde:** tela `/insights` — sugestões automáticas de padrões recorrentes  
**Server Action:** `acceptFixedExpenseInsightAction` (`src/app/(app)/lancamentos/actions.ts`)  
**Payload:** `{ groupKey: string, transactionIds: string[] }`

### Comportamento
- **Não cria novas transações** — modifica transações já existentes
- Seleciona a combinação `(categoryId, subcategoryId)` mais frequente entre as transações do grupo
- Para cada transação: chama `resolveFixedExpenseTemplate` com `isFixed=true` → cria ou reutiliza template
- Atualiza cada `Transaction` com `isFixed=true` + `fixedExpenseTemplateId` + categoria canonizada
- Grava `FixedExpenseInsightDecision` (status="accepted") para suprimir a sugestão

### O que é criado / atualizado
- 1–N `FixedExpenseTemplate` (criados ou reutilizados)
- N `Transaction` atualizadas (`UPDATE`, não `INSERT`)
- 1 `FixedExpenseInsightDecision`

---

## Matriz de campos por cenário

| Cenário | `isFixed` | `fixedExpenseTemplateId` | `installmentPlanId` | `referenceMonth` | Novas linhas DB |
|---|---|---|---|---|---|
| 1A — Simples | false | null | null | null | 1 Transaction |
| 1B — Fixa (nova) | true | preenchido | null | null | 1 Template + 1 Transaction |
| 1C — Fixa (existente) | true | preenchido | null | null | 1 Transaction |
| 1E — Parcelada (flag) | false | null | preenchido | null | 1 Plan + N Transaction |
| 1F — Parcelada (regex) | false | null | preenchido | null | 1 Transaction |
| 2 — Lote | varia | varia | varia | null | N × (cenário 1A/B/C/E) |
| 3A — Import simples | false | null | null | null | 1 Transaction |
| 3B — Import fixa | true | preenchido | null | null | 1 Template + 1 Transaction |
| 3C — Import parcelada | false | null | preenchido | null | 1 Plan + (y-x+1) Transaction |
| 4 — Checklist pago | true | preenchido | null | **preenchido** | 1 Transaction |
| 5 — Insight aceito | true | preenchido | inalterado | null | 1 Template + UPDATE N Transaction |

---

## Pontos de atenção / edge cases documentados

1. **`resolveFixedExpenseTemplate` só roda para `type === "EXPENSE"`** — INCOME nunca cria `FixedExpenseTemplate` (corrigido em `createTransactionAction`, `updateTransactionAction` e `createTransactionBatchAction`)

2. **Parcelada (`isInstallment=true`) nunca é fixa simultaneamente** — o schema (`superRefine`) e o fluxo do formulário não permitem `isInstallment=true` com `isFixed=true` no mesmo item

3. **`recurrence` não gera transações futuras** — é apenas um atributo da transação; o app não tem um job de geração automática baseado nesse campo

4. **Import `x/y`: materializa somente as parcelas restantes** — ao importar a linha "3/6", cria o plano e gera as parcelas 3 a 6 (não reconstrói as 1 e 2 passadas, salvo se já existirem no arquivo)

5. **`referenceMonth` é preenchido exclusivamente pelo Cenário 4** — nas demais criações fica `null`; a constraint `[fixedExpenseTemplateId, referenceMonth]` impede que `payFixedExpensesAction` seja chamada duas vezes para o mesmo mês

6. **Rollback atômico no lote** — no Cenário 2, se o item 3 de 5 falhar, os itens 1 e 2 também são desfeitos; o usuário perde o lote inteiro e precisa reenviar

7. **Template "órfão" ao mudar EXPENSE → INCOME na edição** — ao editar uma transação EXPENSE com `fixedExpenseTemplateId` e alterar o tipo para INCOME, o `updateTransactionAction` seta `fixedExpenseTemplateId=null` na transação, mas o `FixedExpenseTemplate` no banco permanece ativo (limpeza pendente)
