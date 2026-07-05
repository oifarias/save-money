# Deduplicação de Lançamentos na Importação de Excel

## Objetivo

Evitar que o usuário crie lançamentos duplicados ao importar um arquivo Excel que já foi importado anteriormente (total ou parcialmente). A solução deve funcionar em dois níveis:

1. **Frontend (UX)**: avisar o usuário *antes* de confirmar a importação, exibir exatamente qual lançamento existente está em conflito (com todos os detalhes), e permitir que ele decida o que fazer linha a linha.
2. **Backend (segurança)**: última barreira que impede a criação de duplicatas mesmo que o frontend falhe.

---

## Estado Atual do Fluxo

```
ImportWizard (client)
  ├─ Step 1 "upload"   → POST /api/import/parse       (lê .xlsx, retorna headers + rows)
  ├─ Step 2 "map"      → buildMappedRows()             (mapeamento + edição inline)
  └─ Step 3 "result"   → importTransactionsAction()    (Server Action — insere no banco)
```

`importTransactionsAction` executa 7 fases:
- **Fase 0**: validação Zod de cada linha
- **Fase 0.5**: resolve cartões de crédito (1 query)
- **Fase 1–3**: resolve/cria categorias e tags em batch
- **Fase 4**: resolve/cria `FixedExpenseTemplate`s
- **Fase 5**: insere linhas parceladas (mini-tx por grupo)
- **Fase 6**: insere linhas simples (`createManyAndReturn`)
- **Fase 7**: vincula tags (`createMany skipDuplicates`)

**Não há nenhuma deduplicação hoje.** Importar o mesmo arquivo duas vezes cria todos os lançamentos novamente.

---

## Critério de Duplicata

Um lançamento é considerado duplicata de outro se os quatro campos a seguir forem idênticos:

| Campo | Normalização |
|---|---|
| `date` | string `"YYYY-MM-DD"` (sem timezone) |
| `amount` | `Math.round(value * 100)` (inteiro de centavos — elimina erros de float) |
| `type` | `"EXPENSE"` ou `"INCOME"` |
| `description` | `.trim().toLowerCase()` |

Propositalmente **não** inclui `categoryId`, `subcategoryId`, `creditCardId`, `tags` — esses podem ter sido alterados após a primeira importação e não devem fazer dois lançamentos "iguais" parecerem diferentes.

### Casos especiais — linhas parceladas

Para uma linha com `installments: "3/12"` e `description: "Notebook"`, a importação criaria as parcelas 3 a 12 com descriptions `"Notebook (N/12)"` em datas sequenciais.

**Estratégia de verificação**: checar apenas se a **parcela do número informado** já existe no banco, usando a chave `(date_da_parcela_N, amount, type, "notebook (n/12)")`. Se a parcela N existe, é altamente provável que o plano inteiro já foi importado.

### Falsos positivos

É possível que um usuário tenha dois lançamentos legítimos idênticos (ex: dois boletos do mesmo valor, mesma data, mesma descrição). A solução **deve permitir que o usuário force a inclusão** de uma linha marcada como duplicata, após revisar o lançamento existente no modal de detalhes.

---

## Arquitetura da Solução

### Visão geral do fluxo atualizado

```
Step 2 "map"
  ├─ buildMappedRows()                     (já existe)
  ├─ POST /api/import/check-duplicates     (NOVO)
  │     → retorna duplicateIndices[] + matches[] (com detalhes completos do existente)
  │
  ├─ Banner de aviso: "X linhas identificadas como duplicata"
  │     └─ botão "Ver detalhes →" → abre DuplicatesModal
  │
  ├─ Tabela: cada linha duplicata tem badge "Duplicata" + ícone de olho (abre modal filtrado)
  │     - duplicatas ficam DESMARCADAS por padrão (não serão importadas)
  │     - usuário pode marcar cada linha para forçar inclusão
  │
  └─ DuplicatesModal  (NOVO)
       - lista cada par: [linha importada] vs [lançamento existente no banco]
       - exibe: descrição, grupo, subgrupo, tags, valor, parcelas, data
       - pode abrir filtrado para uma linha específica ou mostrar todas

Step 3 "result" (importTransactionsAction)
  ├─ Recebe APENAS as linhas que o usuário escolheu (sem as excluídas)
  └─ Fase 0.7 (NOVA): verificação final de duplicatas no backend
       - filtra o que eventualmente passou pelo frontend
       - incrementa `skipped` e retorna `duplicatesSkipped` no resultado
```

### Componentes a criar/modificar

| Arquivo | Tipo | O que muda |
|---|---|---|
| `src/app/api/import/check-duplicates/route.ts` | **NOVO** | Recebe linhas, retorna índices + detalhes completos dos existentes |
| `src/app/(app)/lancamentos/import-actions.ts` | **MODIFICAR** | Adiciona Fase 0.7 + novo campo `duplicatesSkipped` no retorno |
| `src/components/transactions/import-wizard.tsx` | **MODIFICAR** | Chama API, exibe badges, controla modal, filtra linhas antes de importar |

---

## Implementação Detalhada

---

### 1. Nova API Route — `POST /api/import/check-duplicates`

**Arquivo**: `src/app/api/import/check-duplicates/route.ts`

#### Tipos da requisição e resposta

```typescript
// Body da requisição
type CheckDuplicatesRequest = {
  rows: {
    date: string;           // "YYYY-MM-DD"
    amount: number;         // valor já normalizado (positivo)
    type: "EXPENSE" | "INCOME";
    description: string;    // descrição original (a rota normaliza internamente)
    installments?: string;  // "3/12" se for parcelada (opcional)
  }[];
};

// Detalhes do lançamento existente — exibidos no modal de comparação
type ExistingTransactionDetail = {
  id: string;
  date: string;                              // "YYYY-MM-DD"
  description: string;
  amount: number;
  type: "EXPENSE" | "INCOME";
  category: { name: string; color: string; icon: string } | null;
  subcategory: { name: string } | null;
  tags: string[];                            // nomes das tags
  installmentNumber: number | null;
  installmentTotal: number | null;
};

// Uma correspondência: linha importada ↔ lançamento existente
type DuplicateMatch = {
  importedRowIndex: number;    // índice (0-based) relativo ao array de linhas válidas enviadas
  importedDescription: string; // descrição como veio na planilha (para o modal)
  importedDate: string;        // "YYYY-MM-DD"
  importedAmount: number;
  importedType: "EXPENSE" | "INCOME";
  importedInstallments: string | null; // "3/12" ou null
  existing: ExistingTransactionDetail;
};

// Resposta
type CheckDuplicatesResponse = {
  duplicateIndices: number[];  // subset de índices que têm match
  matches: DuplicateMatch[];   // detalhes de cada match (mesmo tamanho que duplicateIndices)
};
```

#### Implementação da rota

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  const userId = session.user.id;

  const body = (await request.json()) as CheckDuplicatesRequest;
  if (!body.rows?.length) {
    return NextResponse.json({ duplicateIndices: [], matches: [] });
  }
  if (body.rows.length > 1000) {
    return NextResponse.json({ error: "Limite excedido" }, { status: 400 });
  }

  // Construir chave de busca para cada linha do wizard
  type CheckKey = {
    date: string;
    amountCents: number;
    type: string;
    description: string;          // normalizada
    originalDescription: string;  // para exibir no modal
    originalDate: string;
    originalAmount: number;
    originalType: "EXPENSE" | "INCOME";
    originalInstallments: string | null;
  };

  const checkKeys: CheckKey[] = body.rows.map((row) => {
    let description = row.description.trim().toLowerCase();
    const installments = row.installments ?? null;

    if (installments) {
      const [current, total] = installments.split("/").map(Number);
      description = `${description} (${current}/${total})`;
    }

    return {
      date: row.date,
      amountCents: Math.round(row.amount * 100),
      type: row.type,
      description,
      originalDescription: row.description,
      originalDate: row.date,
      originalAmount: row.amount,
      originalType: row.type,
      originalInstallments: installments,
    };
  });

  // Janela de datas para limitar o scan (± 1 dia por segurança de timezone)
  const sortedDates = checkKeys.map((k) => k.date).sort();
  const dateFrom = new Date(sortedDates[0]);
  const dateTo = new Date(sortedDates[sortedDates.length - 1]);
  dateFrom.setDate(dateFrom.getDate() - 1);
  dateTo.setDate(dateTo.getDate() + 1);

  // Buscar transações existentes com todos os campos necessários para o modal
  const existingTransactions = await prisma.transaction.findMany({
    where: {
      userId,
      date: { gte: dateFrom, lte: dateTo },
    },
    select: {
      id: true,
      date: true,
      amount: true,
      type: true,
      description: true,
      category: { select: { name: true, color: true, icon: true } },
      subcategory: { select: { name: true } },
      tags: { select: { tag: { select: { name: true } } } },
      installmentNumber: true,
      installmentPlan: { select: { totalInstallments: true } },
    },
  });

  // Construir Map: chave_normalizada → detalhes do existente
  const existingByKey = new Map<string, typeof existingTransactions[number]>();
  for (const t of existingTransactions) {
    const key = `${t.date.toISOString().slice(0, 10)}|${Math.round(t.amount * 100)}|${t.type}|${t.description.trim().toLowerCase()}`;
    existingByKey.set(key, t);
  }

  // Identificar duplicatas e construir o array de matches com detalhes
  const duplicateIndices: number[] = [];
  const matches: DuplicateMatch[] = [];

  checkKeys.forEach((key, index) => {
    const lookup = `${key.date}|${key.amountCents}|${key.type}|${key.description}`;
    const found = existingByKey.get(lookup);
    if (!found) return;

    duplicateIndices.push(index);
    matches.push({
      importedRowIndex: index,
      importedDescription: key.originalDescription,
      importedDate: key.originalDate,
      importedAmount: key.originalAmount,
      importedType: key.originalType,
      importedInstallments: key.originalInstallments,
      existing: {
        id: found.id,
        date: found.date.toISOString().slice(0, 10),
        description: found.description,
        amount: found.amount,
        type: found.type as "EXPENSE" | "INCOME",
        category: found.category ?? null,
        subcategory: found.subcategory ?? null,
        tags: found.tags.map((t) => t.tag.name),
        installmentNumber: found.installmentNumber,
        installmentTotal: found.installmentPlan?.totalInstallments ?? null,
      },
    });
  });

  return NextResponse.json({ duplicateIndices, matches });
}
```

**Considerações de performance:**
- Nunca faz full table scan: sempre filtra por `userId` + range de datas.
- `SELECT` inclui `category`, `subcategory`, `tags` via JOIN — para planilhas com data range curto (ex: 3 meses), isso é eficiente. Para ranges longos (> 12 meses), pode retornar centenas de transações com joins, mas ainda dentro do aceitável.
- O índice `@@index([userId, date])` já existe no schema e cobre esta query.

---

### 2. Modificação em `import-actions.ts`

**Adicionar Fase 0.7 entre Fase 0 e Fase 0.5.**

Mudança no tipo de retorno:

```typescript
export type ImportActionResult = {
  success: boolean;
  message?: string;
  imported?: number;
  skipped?: number;
  duplicatesSkipped?: number;  // NOVO
};
```

**Nova Fase 0.7** — inserir após `parsedRows` estar populado (linha ~104):

```typescript
// Fase 0.7: última barreira de deduplicação — remove linhas que já existem na base.
// O frontend já deve ter filtrado as duplicatas, mas esta fase cobre race conditions e bugs.
let duplicatesSkipped = 0;
{
  const dates = parsedRows.map((r) => r.date);
  const dateFrom = new Date(Math.min(...dates.map((d) => d.getTime())));
  const dateTo = new Date(Math.max(...dates.map((d) => d.getTime())));
  dateFrom.setDate(dateFrom.getDate() - 1);
  dateTo.setDate(dateTo.getDate() + 1);

  const existing = await prisma.transaction.findMany({
    where: { userId, date: { gte: dateFrom, lte: dateTo } },
    select: { date: true, amount: true, type: true, description: true },
  });

  const existingKeys = new Set(
    existing.map(
      (t) =>
        `${t.date.toISOString().slice(0, 10)}|${Math.round(t.amount * 100)}|${t.type}|${t.description.trim().toLowerCase()}`
    )
  );

  const deduped: ParsedRow[] = [];
  for (const row of parsedRows) {
    const dateStr = row.date.toISOString().slice(0, 10);
    let key: string;

    if (row.installments) {
      const descKey = `${row.description.trim().toLowerCase()} (${row.installments.current}/${row.installments.total})`;
      key = `${dateStr}|${Math.round(row.amount * 100)}|${row.type}|${descKey}`;
    } else {
      key = `${dateStr}|${Math.round(row.amount * 100)}|${row.type}|${row.description.trim().toLowerCase()}`;
    }

    if (existingKeys.has(key)) {
      duplicatesSkipped += 1;
    } else {
      deduped.push(row);
    }
  }

  parsedRows.length = 0;
  parsedRows.push(...deduped);
}
```

Atualizar retorno final:

```typescript
return {
  success: true,
  imported,
  skipped,
  duplicatesSkipped,
  message: [
    `${imported} lançamento(s) importado(s)`,
    skipped > 0 ? `${skipped} ignorado(s) por erro` : null,
    duplicatesSkipped > 0 ? `${duplicatesSkipped} duplicata(s) ignorada(s)` : null,
  ]
    .filter(Boolean)
    .join(" · "),
};
```

---

### 3. Modificação em `import-wizard.tsx`

#### 3a. Novos tipos e estados

```typescript
// Tipos (podem ficar num arquivo de tipos ou inline no componente):
type ExistingTransactionDetail = {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: "EXPENSE" | "INCOME";
  category: { name: string; color: string; icon: string } | null;
  subcategory: { name: string } | null;
  tags: string[];
  installmentNumber: number | null;
  installmentTotal: number | null;
};

type DuplicateMatch = {
  importedRowIndex: number;
  importedDescription: string;
  importedDate: string;
  importedAmount: number;
  importedType: "EXPENSE" | "INCOME";
  importedInstallments: string | null;
  existing: ExistingTransactionDetail;
};

// Estados novos (adicionar após os existentes no componente ImportWizard):
const [duplicateIndices, setDuplicateIndices] = useState<Set<number>>(new Set());
const [forcedIndices, setForcedIndices] = useState<Set<number>>(new Set());
const [duplicateMatches, setDuplicateMatches] = useState<DuplicateMatch[]>([]);
const [checkingDuplicates, setCheckingDuplicates] = useState(false);
const [showDuplicatesModal, setShowDuplicatesModal] = useState(false);
const [modalFilterIndex, setModalFilterIndex] = useState<number | null>(null);
// null = mostrar todos; number = filtrar para uma linha específica
```

#### 3b. Função de verificação de duplicatas

Chamar assim que as linhas forem mapeadas (no `useEffect` que reage a `mappedRows`, ou no final de `handleGoToMap`):

```typescript
async function checkForDuplicates(rows: MappedRow[]) {
  const validRows = rows.filter((r) => r.isValid);
  if (validRows.length === 0) return;

  setCheckingDuplicates(true);
  try {
    const payload = validRows.map((r) => ({
      date: r.fields.date ?? "",
      amount: Number(r.fields.amount ?? 0),
      type: (r.fields.type ?? "EXPENSE") as "EXPENSE" | "INCOME",
      description: r.fields.description ?? "",
      installments: r.fields.installments || undefined,
    }));

    const res = await fetch("/api/import/check-duplicates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: payload }),
    });

    if (!res.ok) return;

    const data = (await res.json()) as {
      duplicateIndices: number[];
      matches: DuplicateMatch[];
    };

    // Os índices retornados são relativos ao array de `validRows`.
    // Mapeamos de volta para o índice global em `rows`.
    const validIndicesInFull = rows
      .map((r, i) => (r.isValid ? i : -1))
      .filter((i) => i !== -1);

    const dupSet = new Set(
      data.duplicateIndices.map((relIdx) => validIndicesInFull[relIdx])
    );

    const matchesWithGlobalIndex = data.matches.map((m) => ({
      ...m,
      importedRowIndex: validIndicesInFull[m.importedRowIndex],
    }));

    setDuplicateIndices(dupSet);
    setDuplicateMatches(matchesWithGlobalIndex);
    setForcedIndices(new Set()); // reset ao remapear
  } catch {
    // falha silenciosa — o backend ainda filtra duplicatas
  } finally {
    setCheckingDuplicates(false);
  }
}
```

#### 3c. Banner de aviso acima da tabela do Step 2

```tsx
{checkingDuplicates && (
  <div className="flex items-center gap-2 text-sm text-(--color-text-muted)">
    <Loader2 className="h-4 w-4 animate-spin" />
    Verificando lançamentos duplicados…
  </div>
)}

{!checkingDuplicates && duplicateIndices.size > 0 && (
  <div className="flex items-start gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" aria-hidden="true" />
    <div className="flex-1 text-sm text-orange-800">
      <strong>
        {duplicateIndices.size} linha{duplicateIndices.size > 1 ? "s identificadas" : " identificada"} como
        possível duplicata.
      </strong>{" "}
      Por padrão elas não serão importadas. Revise os detalhes e marque as que deseja incluir mesmo assim.
    </div>
    <div className="flex items-center gap-3 shrink-0">
      <button
        type="button"
        className="text-xs font-medium text-orange-700 underline hover:no-underline"
        onClick={() => { setModalFilterIndex(null); setShowDuplicatesModal(true); }}
      >
        Ver detalhes →
      </button>
      <button
        type="button"
        className="text-xs text-orange-600 underline hover:no-underline"
        onClick={() => setForcedIndices(new Set(duplicateIndices))}
      >
        Incluir todas
      </button>
    </div>
  </div>
)}
```

#### 3d. Badge e ícone por linha na tabela

Para cada linha na tabela de mapeamento (Step 2), identificar se é duplicata e adicionar controles:

```tsx
// Variáveis por linha (index = índice global na lista de rows):
const isDuplicate = duplicateIndices.has(index);
const isForced = forcedIndices.has(index);
const willBeSkipped = isDuplicate && !isForced;

// Na célula de status da linha:
{isDuplicate && (
  <div className="flex items-center gap-1.5">
    <span className={clsx(
      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
      isForced
        ? "bg-amber-100 text-amber-700"
        : "bg-orange-100 text-orange-700"
    )}>
      {isForced ? "Incluir mesmo assim" : "Duplicata"}
    </span>
    <button
      type="button"
      title="Ver lançamento existente"
      aria-label="Ver lançamento existente que conflita com esta linha"
      onClick={() => { setModalFilterIndex(index); setShowDuplicatesModal(true); }}
      className="inline-flex items-center justify-center rounded p-0.5 text-orange-500 hover:bg-orange-100"
    >
      <Eye className="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  </div>
)}

// Checkbox da linha — duplicatas ficam desmarcadas por padrão:
<input
  type="checkbox"
  checked={isDuplicate ? isForced : row.isValid}
  disabled={!isDuplicate && !row.isValid}
  onChange={() => {
    if (!isDuplicate) return; // linhas normais não passam por aqui
    setForcedIndices((prev) => {
      const next = new Set(prev);
      if (isForced) next.delete(index);
      else next.add(index);
      return next;
    });
  }}
  className="h-4 w-4 rounded border-(--color-border) accent-(--color-primary)"
/>
```

#### 3e. DuplicatesModal — layout e conteúdo

O modal é aberto tanto pelo botão "Ver detalhes →" do banner (mostra todos) quanto pelo ícone de olho em cada linha (filtra para aquela linha). Usa o componente `Modal` já existente.

```tsx
{/* Modal de detalhes de duplicatas */}
<Modal
  open={showDuplicatesModal}
  title={
    modalFilterIndex !== null
      ? "Lançamento existente — linha " + (modalFilterIndex + 1)
      : `Duplicatas encontradas (${duplicateIndices.size})`
  }
  onClose={() => setShowDuplicatesModal(false)}
>
  <div className="flex flex-col gap-4 max-h-[70vh] overflow-y-auto pr-1">
    {(modalFilterIndex !== null
      ? duplicateMatches.filter((m) => m.importedRowIndex === modalFilterIndex)
      : duplicateMatches
    ).map((match, i) => (
      <DuplicateMatchCard
        key={match.existing.id}
        match={match}
        index={i}
        isForced={forcedIndices.has(match.importedRowIndex)}
        onToggleForce={() => {
          setForcedIndices((prev) => {
            const next = new Set(prev);
            if (next.has(match.importedRowIndex)) next.delete(match.importedRowIndex);
            else next.add(match.importedRowIndex);
            return next;
          });
        }}
      />
    ))}
  </div>
</Modal>
```

#### 3f. Componente `DuplicateMatchCard`

Pode ser definido como função local dentro de `import-wizard.tsx` ou em arquivo separado:

```tsx
function DuplicateMatchCard({
  match,
  index,
  isForced,
  onToggleForce,
}: {
  match: DuplicateMatch;
  index: number;
  isForced: boolean;
  onToggleForce: () => void;
}) {
  return (
    <div className="rounded-xl border border-(--color-border) overflow-hidden">
      {/* Cabeçalho da linha */}
      <div className="flex items-center justify-between bg-(--color-surface) px-4 py-2.5">
        <span className="text-xs font-semibold text-(--color-text-muted) uppercase tracking-wide">
          Linha {match.importedRowIndex + 1} da planilha
        </span>
        <button
          type="button"
          onClick={onToggleForce}
          className={clsx(
            "text-xs font-medium underline hover:no-underline",
            isForced ? "text-(--color-text-muted)" : "text-(--color-primary)"
          )}
        >
          {isForced ? "Não importar esta linha" : "Importar mesmo assim"}
        </button>
      </div>

      {/* Comparação lado a lado */}
      <div className="grid grid-cols-2 divide-x divide-(--color-border)">

        {/* Coluna esquerda: dados da planilha */}
        <div className="p-4 bg-orange-50/50">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-wide text-orange-600">
            Da planilha
          </p>
          <dl className="flex flex-col gap-2 text-sm">
            <DetailRow label="Descrição" value={match.importedDescription} />
            <DetailRow label="Data" value={formatDate(match.importedDate)} />
            <DetailRow
              label="Valor"
              value={formatCurrency(match.importedAmount)}
              highlight
            />
            <DetailRow
              label="Tipo"
              value={match.importedType === "EXPENSE" ? "Despesa" : "Entrada"}
            />
            {match.importedInstallments && (
              <DetailRow label="Parcela" value={match.importedInstallments} />
            )}
          </dl>
        </div>

        {/* Coluna direita: lançamento existente no banco */}
        <div className="p-4">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-wide text-(--color-text-muted)">
            Já existe na base
          </p>
          <dl className="flex flex-col gap-2 text-sm">
            <DetailRow label="Descrição" value={match.existing.description} />
            <DetailRow label="Data" value={formatDate(match.existing.date)} />
            <DetailRow
              label="Valor"
              value={formatCurrency(match.existing.amount)}
              highlight
            />
            <DetailRow
              label="Grupo"
              value={match.existing.category?.name ?? "—"}
            />
            <DetailRow
              label="Subgrupo"
              value={match.existing.subcategory?.name ?? "—"}
            />
            <DetailRow
              label="Tags"
              value={match.existing.tags.length > 0 ? match.existing.tags.join(", ") : "—"}
            />
            {match.existing.installmentNumber && (
              <DetailRow
                label="Parcela"
                value={`${match.existing.installmentNumber}/${match.existing.installmentTotal ?? "?"}`}
              />
            )}
          </dl>
        </div>
      </div>
    </div>
  );
}

// Helper de linha de detalhe
function DetailRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="w-20 shrink-0 text-xs text-(--color-text-muted)">{label}</dt>
      <dd className={clsx("font-medium text-(--color-text)", highlight && "font-numeric font-semibold")}>
        {value}
      </dd>
    </div>
  );
}
```

#### 3g. Filtrar linhas antes de chamar a action

```typescript
async function handleImport() {
  const rowsToImport = mappedRows
    .filter((row, index) => {
      if (!row.isValid) return false;
      const isDuplicate = duplicateIndices.has(index);
      const isForced = forcedIndices.has(index);
      return !isDuplicate || isForced;
    })
    .map((row) => row.payload);

  if (rowsToImport.length === 0) {
    toast.error("Nenhuma linha para importar após remover duplicatas.");
    return;
  }

  const result = await importTransactionsAction(rowsToImport);
  // ...exibir resultado
}
```

#### 3h. Resultado da importação (Step 3)

```tsx
{result.duplicatesSkipped != null && result.duplicatesSkipped > 0 && (
  <p className="text-sm text-(--color-text-muted)">
    {result.duplicatesSkipped} lançamento(s) ignorado(s) por já existirem na base.
  </p>
)}
```

---

## Casos Extremos e Como São Tratados

| Cenário | Comportamento |
|---|---|
| Reimportar o mesmo arquivo | Todas as linhas marcadas como duplicata → nenhuma importada por padrão → usuário pode forçar via modal |
| Dois lançamentos legítimos idênticos no mesmo dia | Falso positivo — usuário abre modal, vê que é diferente, marca "Importar mesmo assim" |
| Parcela X/N já criada, mas X+1 a N não | Linha marcada como duplicata (parcela X existe). O backend não criaria X+1..N de qualquer forma (toda importação de "X/N" gera X..N) |
| Importar "8/12" quando "1/12" a "7/12" existem | NÃO é duplicata — "Notebook (8/12)" não existe no banco |
| Race condition: dois imports simultâneos | Fase 0.7 do backend re-verifica; pode criar duplicata em cenário extremamente raro — aceitável |
| Planilha grande (1000 linhas, 2 anos de dados) | Query usa índice `(userId, date)` — eficiente; comparação in-memory de ≤ 1000 chaves |
| Descrição com casing diferente | `.trim().toLowerCase()` resolve: "Mercado Livre" == "mercado livre" |
| Amount com variação de float (1.9999 vs 2.00) | `Math.round(amount * 100)` converte para centavos inteiros antes de comparar |
| Range de datas muito grande (planilha de 5 anos) | Query retorna mais registros mas ainda filtrada por `userId + date`. Se performance for problema, adicionar cache client-side do resultado da API |

---

## Plano de Implementação (ordem de execução)

### Etapa 1 — Backend isolado (sem UI)
1. Criar `src/app/api/import/check-duplicates/route.ts` com a query e lógica de matching
2. Adicionar Fase 0.7 em `import-actions.ts`
3. Atualizar `ImportActionResult` para incluir `duplicatesSkipped`
4. **Verificar**: chamar a API via Postman/curl com um arquivo já importado → confirmar que `matches[]` retorna os campos corretos

### Etapa 2 — Frontend básico (sem modal ainda)
5. Adicionar estados `duplicateIndices`, `forcedIndices`, `duplicateMatches`, `checkingDuplicates` no wizard
6. Implementar `checkForDuplicates()` e chamá-la ao avançar para Step 2
7. Adicionar banner de aviso (sem o link "Ver detalhes" ainda)
8. Adicionar badge "Duplicata" por linha
9. Implementar toggle por linha (checkbox + `forcedIndices`)
10. Filtrar `rowsToImport` antes de chamar a action
11. **Verificar**: importar arquivo → Step 2 deve mostrar badges nas linhas corretas; confirmar que duplicatas não são importadas

### Etapa 3 — Modal de comparação
12. Implementar `DuplicateMatchCard` e `DetailRow`
13. Adicionar `Modal` controlado por `showDuplicatesModal` e `modalFilterIndex`
14. Adicionar botão "Ver detalhes →" no banner e ícone `Eye` por linha
15. Conectar botão "Importar mesmo assim" dentro do modal ao estado `forcedIndices`
16. Exibir `duplicatesSkipped` no resultado (Step 3)
17. **Verificar**: fluxo completo — abrir modal, ver detalhes, forçar inclusão, confirmar que foi importado

---

## Riscos e Decisões

| Risco | Decisão |
|---|---|
| Fase 0.7 rejeita linhas que o usuário forçou | As linhas forçadas são enviadas normalmente (o frontend já as filtra); a Fase 0.7 voltará a bloqueá-las. Para MVP, aceitável. Se necessário depois: adicionar `forceIncludeKeys: string[]` na action |
| API lenta para planilhas com range longo | Chamar assincronamente com spinner; o Step 2 já fica visível enquanto carrega |
| Usuário abre modal com 200 duplicatas | Modal com `max-h-[70vh] overflow-y-auto` — scrollável. Se a lista for muito grande, paginar no futuro |
| `installmentTotal` pode ser null se o plano foi deletado | Exibir `match.existing.installmentTotal ?? "?"` no modal |

---

## Schema — Nenhuma Migração Necessária

A deduplicação é puramente em código. O índice `@@index([userId, date])` já existe e cobre a query de verificação. Nenhuma nova coluna ou migration é necessária.
