# Plano de Refatoração de Componentes — Save Money

Data: 2026-06-27  
Objetivo: eliminar repetição de estrutura HTML/Tailwind no frontend, componentizando padrões que já existem em múltiplos lugares. O modelo de referência é `summary-cards.tsx` — o padrão de extração de tipos, objeto de variantes e componente interno reutilizável.

---

## Modelo de referência: `summary-cards.tsx`

O que está certo nesse arquivo:
- Componente interno `SummaryCard` recebe apenas props tipadas — zero HTML duplicado.
- `CARD_COLORS` é um objeto literal com `satisfies Record<...>`, garantindo autocompletar sem perder type narrowing.
- O pai `SummaryCards` monta um array de dados e itera — não repete JSX.
- Nenhuma classe Tailwind aparece duas vezes no arquivo.

Esse é o padrão a replicar em todos os novos componentes.

---

## Componentes a criar

### 1. `<PageHeader>` — Cabeçalho de seção

**Problema:** A estrutura título + subtítulo + botão direito aparece idêntica em pelo menos 5 lugares.

**Ocorrências atuais:**

`src/components/groups/category-manager.tsx` (linhas 63–73):
```tsx
<div className="flex items-center justify-between">
  <div>
    <h1 className="font-display text-2xl font-semibold text-(--color-text)">Grupos</h1>
    <p className="mt-1 text-sm text-(--color-text-muted)">
      Organize seus lançamentos por categoria com cores e ícones personalizados
    </p>
  </div>
  <Button onClick={() => setFormMode({ kind: "create" })}>
    <Plus className="h-4 w-4" aria-hidden="true" />
    Novo grupo
  </Button>
</div>
```

`src/components/transactions/transaction-list.tsx` (linhas 104–122):
```tsx
<div className="flex items-center justify-between gap-3">
  <div>
    <h1 className="font-display text-2xl font-semibold text-(--color-text)">{title}</h1>
    <p className="mt-1 text-sm text-(--color-text-muted)">{description}</p>
  </div>
  <div className="flex shrink-0 items-center gap-2">
    {viewAllHref && <Link href={viewAllHref}>Ver todos</Link>}
    {showHeaderAction && <Button onClick={openCreate}>Novo lançamento</Button>}
  </div>
</div>
```

Também em: `dashboard/page.tsx`, `metas/page.tsx`, `insights/page.tsx`, `wishes-manager.tsx`.

**Arquivo a criar:** `src/components/ui/page-header.tsx`

**API proposta:**
```tsx
type PageHeaderProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;    // qualquer botão/link à direita
  level?: "h1" | "h2" | "h3"; // default: "h1"
};

export function PageHeader({ title, description, action, level = "h1" }: PageHeaderProps) {
  const Tag = level;
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <Tag className="font-display text-2xl font-semibold text-(--color-text)">{title}</Tag>
        {description && <p className="mt-1 text-sm text-(--color-text-muted)">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}
```

---

### 2. `<IconBadge>` — Ícone em fundo colorido

**Problema:** O padrão `span flex h-10 w-10 rounded-xl + style inline com cor` aparece em pelo menos 8 lugares, com tamanhos e border-radius variando inconsistentemente.

**Ocorrências atuais:**

`src/components/transactions/transaction-row.tsx` (linhas 39–49) — fixo `h-10 w-10 rounded-xl`, cor por tipo:
```tsx
<span className={clsx(
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
  isExpense ? "bg-(--color-danger)/10 text-(--color-danger)" : "bg-(--color-success)/10 text-(--color-success)"
)}>
  <ArrowUpRight className="h-4.5 w-4.5" aria-hidden="true" />
</span>
```

`src/components/groups/category-manager.tsx` (linhas 95–99) — cor dinâmica via inline style:
```tsx
<span
  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
  style={{ backgroundColor: `${category.color}1F`, color: category.color }}
>
  <Icon className="h-5 w-5" aria-hidden="true" />
</span>
```

`src/components/wishes/wish-intake.tsx` (linhas 26–27 e 46–47) — duas variantes de cor:
```tsx
<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-(--color-primary)/10 text-(--color-primary)">
<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-(--color-accent)/15 text-(--color-accent)">
```

`src/components/wishes/wish-detail-view.tsx` (linhas 93–98) — `h-12 w-12 rounded-2xl`:
```tsx
<span
  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
  style={{ backgroundColor: `${wish.subcategory.color}1F`, color: wish.subcategory.color }}
>
```

`src/components/dashboard/summary-cards.tsx` (linhas 45–47) — `h-10 w-10 rounded-xl` com classe estática.

Também em: `wish-card.tsx`, `insight-sections.tsx`, `budget-progress-view.tsx`.

**Arquivo a criar:** `src/components/ui/icon-badge.tsx`

**API proposta:**
```tsx
import { type LucideIcon } from "lucide-react";
import { clsx } from "clsx";

const SIZE_CLASSES = {
  sm:  "h-8  w-8  rounded-lg  [&>svg]:h-4   [&>svg]:w-4",
  md:  "h-10 w-10 rounded-xl  [&>svg]:h-5   [&>svg]:w-5",
  lg:  "h-12 w-12 rounded-2xl [&>svg]:h-5.5 [&>svg]:w-5.5",
  xl:  "h-14 w-14 rounded-2xl [&>svg]:h-6   [&>svg]:w-6",
} as const;

type IconBadgeProps = {
  icon: LucideIcon;
  size?: keyof typeof SIZE_CLASSES;
  // Cor por token CSS (ex.: "--color-primary") — usa alpha 15% no fundo
  colorToken?: string;
  // Cor hex livre (ex.: "#A855F7") — usa inline style com alpha hex 1F
  colorHex?: string;
  className?: string;
};

export function IconBadge({ icon: Icon, size = "md", colorToken, colorHex, className }: IconBadgeProps) {
  const style = colorHex
    ? { backgroundColor: `${colorHex}1F`, color: colorHex }
    : undefined;

  return (
    <span
      className={clsx(
        "flex shrink-0 items-center justify-center",
        SIZE_CLASSES[size],
        !colorHex && colorToken && `bg-(${colorToken})/15 text-(${colorToken})`,
        className
      )}
      style={style}
      aria-hidden="true"
    >
      <Icon aria-hidden="true" />
    </span>
  );
}
```

**Uso após refatoração:**
```tsx
// transaction-row.tsx
<IconBadge icon={isExpense ? ArrowUpRight : ArrowDownLeft}
  colorToken={isExpense ? "--color-danger" : "--color-success"} />

// category-manager.tsx
<IconBadge icon={Icon} colorHex={category.color} />

// wish-detail-view.tsx
<IconBadge icon={Icon} colorHex={wish.subcategory.color} size="lg" />
```

---

### 3. `<EmptyState>` — Tela de estado vazio

**Problema:** O padrão Card centralizado com título, descrição e botão de criação é copiado literalmente.

**Ocorrências atuais:**

`src/components/groups/category-manager.tsx` (linhas 77–86):
```tsx
<Card className="flex flex-col items-center gap-2 py-12 text-center">
  <p className="font-display text-lg font-semibold text-(--color-text)">Nenhum grupo ainda</p>
  <p className="max-w-sm text-sm text-(--color-text-muted)">
    Crie grupos para organizar seus gastos e entradas...
  </p>
  <Button onClick={() => setFormMode({ kind: "create" })} className="mt-2">
    <Plus className="h-4 w-4" aria-hidden="true" />
    Criar primeiro grupo
  </Button>
</Card>
```

`src/components/transactions/transaction-list.tsx` (linhas 125–134):
```tsx
<Card className="flex flex-col items-center gap-2 py-12 text-center">
  <p className="font-display text-lg font-semibold text-(--color-text)">Nenhum lançamento ainda</p>
  <p className="max-w-sm text-sm text-(--color-text-muted)">
    Comece registrando suas despesas e entradas...
  </p>
  <Button onClick={openCreate} className="mt-2">
    <Plus className="h-4 w-4" aria-hidden="true" />
    Criar primeiro lançamento
  </Button>
</Card>
```

Também em: `wishes-manager.tsx`, `insight-sections.tsx` (sem botão), `budget-progress-view.tsx`.

**Arquivo a criar:** `src/components/ui/empty-state.tsx`

**API proposta:**
```tsx
type EmptyStateProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
};

export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <Card className={clsx("flex flex-col items-center gap-2 py-12 text-center", className)}>
      <p className="font-display text-lg font-semibold text-(--color-text)">{title}</p>
      {description && <p className="max-w-sm text-sm text-(--color-text-muted)">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </Card>
  );
}
```

---

### 4. `<ToggleGroup>` — Botões de alternância (2 ou mais opções)

**Problema:** O padrão `grid grid-cols-N gap-2 rounded-xl border bg p-1` com botões `aria-pressed` é implementado em pelo menos 4 lugares com lógica idêntica.

**Ocorrências atuais:**

`src/components/transactions/transaction-form.tsx` (linhas 83–113) — toggle DESPESA/ENTRADA:
```tsx
<fieldset className="flex flex-col gap-1.5">
  <legend className="text-sm font-medium text-(--color-text)">Tipo</legend>
  <div className="grid grid-cols-2 gap-2 rounded-xl border border-(--color-border) bg-(--color-bg) p-1">
    {[{ value: "EXPENSE", label: "Despesa" }, { value: "INCOME", label: "Entrada" }].map((option) => (
      <button
        key={option.value}
        type="button"
        onClick={() => setType(option.value)}
        aria-pressed={type === option.value}
        className={clsx(
          "rounded-lg py-2 text-sm font-medium transition-all duration-200",
          type === option.value
            ? option.value === "EXPENSE"
              ? "bg-(--color-danger) text-white shadow-sm"
              : "bg-(--color-success) text-white shadow-sm"
            : "text-(--color-text-muted) hover:text-(--color-text)"
        )}
      >
        {option.label}
      </button>
    ))}
  </div>
</fieldset>
```

`src/components/transactions/transaction-form.tsx` — toggle "Fixa/Variável" para INCOME (mesmo padrão com `--color-success`).

Também em: `wish-purchase-modal.tsx` (Lançar/Marcar), `wishes-manager.tsx` (Prioridade/Grupo).

**Arquivo a criar:** `src/components/ui/toggle-group.tsx`

**API proposta:**
```tsx
type ToggleOption<T extends string> = {
  value: T;
  label: string;
  activeColor?: string; // token CSS, ex.: "--color-danger". Default: "--color-primary"
};

type ToggleGroupProps<T extends string> = {
  legend?: string;
  value: T;
  onChange: (value: T) => void;
  options: ToggleOption<T>[];
  columns?: 2 | 3 | 4;
};

const COLS = { 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4" } as const;

export function ToggleGroup<T extends string>({
  legend, value, onChange, options, columns = 2
}: ToggleGroupProps<T>) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      {legend && <legend className="text-sm font-medium text-(--color-text)">{legend}</legend>}
      <div className={`grid ${COLS[columns]} gap-2 rounded-xl border border-(--color-border) bg-(--color-bg) p-1`}>
        {options.map((option) => {
          const active = value === option.value;
          const color = option.activeColor ?? "--color-primary";
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              aria-pressed={active}
              className={clsx(
                "rounded-lg py-2 text-sm font-medium transition-all duration-200",
                active
                  ? `bg-(${color}) text-white shadow-sm`
                  : "text-(--color-text-muted) hover:text-(--color-text)"
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
```

**Uso após refatoração em `transaction-form.tsx`:**
```tsx
<ToggleGroup
  legend="Tipo"
  value={type}
  onChange={(v) => { setType(v); if (v === "INCOME") setIsInstallment(false); }}
  options={[
    { value: "EXPENSE", label: "Despesa", activeColor: "--color-danger" },
    { value: "INCOME",  label: "Entrada", activeColor: "--color-success" },
  ]}
/>
```

---

### 5. `<IntakeOption>` — Botão de entrada (CTA grande com ícone)

**Problema:** `transaction-intake.tsx` e `wish-intake.tsx` têm estrutura HTML **byte-a-byte idêntica**. É o caso mais claro de duplicação no projeto.

**Ocorrências atuais:**

`src/components/transactions/transaction-intake.tsx` (as two `Link` elements):
```tsx
<Link
  href="/lancamentos/novo"
  className="group flex items-start gap-3 rounded-2xl border border-(--color-border) bg-(--color-surface)
             px-4 py-3.5 text-left transition-colors duration-200
             hover:border-(--color-primary)/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-primary)/40"
>
  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-(--color-primary)/10 text-(--color-primary)">
    <PenLine className="h-5 w-5" aria-hidden="true" />
  </span>
  <span className="flex-1">
    <span className="block font-display text-sm font-semibold text-(--color-text)">Manual</span>
    <span className="mt-0.5 block text-xs text-(--color-text-muted)">Adicione um ou mais lançamentos...</span>
  </span>
  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-(--color-text-muted) transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
</Link>
```

`src/components/wishes/wish-intake.tsx` — exatamente o mesmo HTML, mas com `<button onClick>` em vez de `<Link href>`.

**Arquivo a criar:** `src/components/ui/intake-option.tsx`

**API proposta:**
```tsx
import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { IconBadge } from "@/components/ui/icon-badge";

type IntakeOptionBase = {
  icon: LucideIcon;
  title: string;
  description: string;
  colorToken?: string; // default: "--color-primary"
};

type IntakeOptionAsLink   = IntakeOptionBase & { href: string; onClick?: never };
type IntakeOptionAsButton = IntakeOptionBase & { onClick: () => void; href?: never };
type IntakeOptionProps    = IntakeOptionAsLink | IntakeOptionAsButton;

const SHARED = "group flex items-start gap-3 rounded-2xl border border-(--color-border) bg-(--color-surface) px-4 py-3.5 text-left transition-colors duration-200 hover:border-(--color-primary)/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-primary)/40";

function IntakeOptionContent({ icon, title, description, colorToken = "--color-primary" }: IntakeOptionBase) {
  return (
    <>
      <IconBadge icon={icon} colorToken={colorToken} />
      <span className="flex-1">
        <span className="block font-display text-sm font-semibold text-(--color-text)">{title}</span>
        <span className="mt-0.5 block text-xs text-(--color-text-muted)">{description}</span>
      </span>
      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-(--color-text-muted) transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
    </>
  );
}

export function IntakeOption(props: IntakeOptionProps) {
  if (props.href) {
    return (
      <Link href={props.href} className={SHARED}>
        <IntakeOptionContent {...props} />
      </Link>
    );
  }
  return (
    <button type="button" onClick={props.onClick} className={`cursor-pointer ${SHARED}`}>
      <IntakeOptionContent {...props} />
    </button>
  );
}
```

**Uso após refatoração em `transaction-intake.tsx`:**
```tsx
<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
  <IntakeOption icon={PenLine}        title="Manual"           description="Adicione um ou mais lançamentos com categoria e tags" href="/lancamentos/novo" />
  <IntakeOption icon={FileSpreadsheet} title="Importar planilha" description="Várias linhas de uma vez, a partir de um .xlsx ou .xls" href="/lancamentos/importar" colorToken="--color-accent" />
</div>
```

**Uso após refatoração em `wish-intake.tsx`:**
```tsx
<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
  <IntakeOption icon={UserRound}      title="Individual"  description="Um ou mais itens do mesmo grupo, com plano de compra" onClick={onIndividual} />
  <IntakeOption icon={FileSpreadsheet} title="Em lote"    description="Várias linhas de uma vez, a partir de um arquivo .csv" onClick={onBulk} colorToken="--color-accent" />
</div>
```

---

### 6. `<StatusBadge>` — Pill de status/tipo

**Problema:** Badges inline com `rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide` são montadas com classes hardcoded em 4+ componentes.

**Ocorrências atuais:**

`src/components/transactions/transaction-row.tsx` (linhas 55–64):
```tsx
<span className="shrink-0 rounded-full bg-(--color-accent)/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-(--color-accent)">
  Fixa
</span>
<span className="shrink-0 rounded-full bg-(--color-primary)/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-(--color-primary)">
  Parcela {transaction.installment.number}/{transaction.installment.total}
</span>
```

`src/components/wishes/wish-detail-view.tsx` (linhas 113–125) — badges PURCHASED/ABANDONED com ícone:
```tsx
<span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-(--color-success)/10 px-3 py-1.5 text-sm font-medium text-(--color-success)">
  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
  Comprado em ...
</span>
```

Também em: `insight-sections.tsx` (VariationBadge com TrendingUp/Down), `wish-card.tsx`, `budget-progress-view.tsx`.

**Arquivo a criar:** `src/components/ui/status-badge.tsx`

**API proposta:**
```tsx
const VARIANT_CLASSES = {
  accent:  "bg-(--color-accent)/15  text-(--color-accent)",
  primary: "bg-(--color-primary)/15 text-(--color-primary)",
  success: "bg-(--color-success)/10 text-(--color-success)",
  danger:  "bg-(--color-danger)/10  text-(--color-danger)",
  muted:   "bg-(--color-text-muted)/10 text-(--color-text-muted)",
} as const;

type StatusBadgeProps = {
  label: string;
  variant?: keyof typeof VARIANT_CLASSES;
  icon?: LucideIcon;
  size?: "xs" | "sm"; // xs = text-[10px] uppercase tracking-wide, sm = text-xs
};

export function StatusBadge({ label, variant = "primary", icon: Icon, size = "xs" }: StatusBadgeProps) {
  return (
    <span className={clsx(
      "inline-flex shrink-0 items-center gap-1.5 rounded-full font-semibold",
      size === "xs" ? "px-2 py-0.5 text-[10px] uppercase tracking-wide" : "px-2.5 py-1 text-xs",
      VARIANT_CLASSES[variant]
    )}>
      {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
      {label}
    </span>
  );
}
```

---

### 7. `<SelectField>` — Select com label e mensagem de erro

**Problema:** O `<select>` tem exatamente a mesma classe CSS longa em todos os formulários. Não há componente equivalente ao `<Input>` para selects.

**Ocorrências atuais:**

`src/components/transactions/transaction-form.tsx` (linha 164–177) — dois `select` com a mesma classe:
```tsx
<select
  id="categoryId"
  name="categoryId"
  className="rounded-xl border border-(--color-border) bg-(--color-surface) px-3.5 py-2.5 text-sm text-(--color-text) outline-none transition-colors focus:border-(--color-primary) focus:ring-2 focus:ring-(--color-primary)/20"
>
```

```tsx
<select
  id="subcategoryId"
  name="subcategoryId"
  className="rounded-xl border border-(--color-border) bg-(--color-surface) px-3.5 py-2.5 text-sm text-(--color-text) outline-none transition-colors focus:border-(--color-primary) focus:ring-2 focus:ring-(--color-primary)/20 disabled:cursor-not-allowed disabled:opacity-50"
>
```

Também em: `category-form.tsx`, `wishes-manager.tsx` (filtro de grupo), `import-wizard.tsx` (mapeamento de colunas).

**Arquivo a criar:** `src/components/ui/select-field.tsx`

**API proposta:**
```tsx
type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string;
  hint?: React.ReactNode; // conteúdo extra ao lado do label (ex.: "Novo grupo")
};

export function SelectField({ label, error, hint, id, className, children, ...props }: SelectFieldProps) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={inputId} className="text-sm font-medium text-(--color-text)">{label}</label>
        {hint}
      </div>
      <select
        id={inputId}
        className={clsx(
          "rounded-xl border border-(--color-border) bg-(--color-surface) px-3.5 py-2.5 text-sm text-(--color-text) outline-none transition-colors",
          "focus:border-(--color-primary) focus:ring-2 focus:ring-(--color-primary)/20",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-xs text-(--color-danger)">{error}</p>}
    </div>
  );
}
```

---

### 8. `<Alert>` — Caixa de mensagem contextual

**Problema:** Caixas de alerta/informação aparecem em 3 variantes (success/info/default) com estrutura quase idêntica, mas sem nenhum componente comum. O código fica ilegível dentro de `wish-detail-view.tsx`.

**Ocorrências atuais (`wish-detail-view.tsx`, linhas 172–196):**

```tsx
// Variante success/accent
<div className={`flex items-start gap-2 rounded-xl px-4 py-3 text-sm ${
  wish.readiness?.cashTimeline === "now"
    ? "bg-(--color-success)/10 text-(--color-success)"
    : "bg-(--color-accent)/10 text-(--color-text)"
}`}>
  <Sparkles className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
  <p>{timelineMessage}</p>
</div>

// Variante info
<div className="flex items-start gap-2 rounded-xl bg-(--color-bg) px-4 py-3 text-sm text-(--color-text-muted)">
  <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
  <p>Orçamento do grupo...</p>
</div>

// Variante default/neutral
<div className="flex items-start gap-2 rounded-xl border border-(--color-border) px-4 py-3 text-sm text-(--color-text)">
  <PiggyBank className="mt-0.5 h-4 w-4 shrink-0 text-(--color-primary)" aria-hidden="true" />
  <div>...</div>
</div>
```

Também em: `insight-sections.tsx` (AlertTriangle), `wish-card.tsx`.

**Arquivo a criar:** `src/components/ui/alert.tsx`

**API proposta:**
```tsx
const ALERT_VARIANTS = {
  success: { bg: "bg-(--color-success)/10",  text: "text-(--color-success)",      border: "" },
  info:    { bg: "bg-(--color-accent)/10",   text: "text-(--color-text)",          border: "" },
  warning: { bg: "bg-(--color-danger)/5",    text: "text-(--color-text)",          border: "border border-(--color-danger)/30" },
  neutral: { bg: "bg-(--color-bg)",          text: "text-(--color-text-muted)",    border: "" },
  default: { bg: "bg-(--color-surface)",     text: "text-(--color-text)",          border: "border border-(--color-border)" },
} as const;

type AlertProps = {
  variant?: keyof typeof ALERT_VARIANTS;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
};

export function Alert({ variant = "default", icon: Icon, children, className }: AlertProps) {
  const v = ALERT_VARIANTS[variant];
  return (
    <div className={clsx("flex items-start gap-2 rounded-xl px-4 py-3 text-sm", v.bg, v.text, v.border, className)}>
      {Icon && <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}
      <div className="flex-1">{children}</div>
    </div>
  );
}
```

---

### 9. `<ProgressBar>` — Barra de progresso com milestones

**Problema:** A barra com marcadores em 25/50/75% é duplicada em `wish-card.tsx` e `wish-detail-view.tsx` com HTML idêntico.

**Ocorrências atuais:**

`src/components/wishes/wish-detail-view.tsx` (linhas 140–153):
```tsx
<div className="relative h-3 w-full overflow-hidden rounded-full bg-(--color-bg)">
  <div
    className="h-full rounded-full bg-(--color-primary) transition-all duration-300"
    style={{ width: `${Math.min(100, progressPercent)}%` }}
  />
  {[25, 50, 75].map((milestone) => (
    <span
      key={milestone}
      className="absolute top-0 h-3 w-px bg-(--color-surface)/70"
      style={{ left: `${milestone}%` }}
      aria-hidden="true"
    />
  ))}
</div>
```

`src/components/wishes/wish-card.tsx` — exatamente o mesmo HTML.

`src/components/insights/insight-sections.tsx` (linhas 147–152) — variante sem milestones, cor variável.

`src/components/goals/budget-progress-view.tsx` — variante "stacked" (dois segmentos de cor).

**Arquivo a criar:** `src/components/ui/progress-bar.tsx`

**API proposta:**
```tsx
const COLOR_CLASSES = {
  primary: "bg-(--color-primary)",
  success: "bg-(--color-success)",
  danger:  "bg-(--color-danger)",
  accent:  "bg-(--color-accent)",
} as const;

const HEIGHT_CLASSES = {
  sm: "h-1.5",
  md: "h-2.5",
  lg: "h-3",
} as const;

type ProgressBarProps = {
  value: number;          // 0–100
  color?: keyof typeof COLOR_CLASSES;
  height?: keyof typeof HEIGHT_CLASSES;
  showMilestones?: boolean;
  className?: string;
};

export function ProgressBar({
  value,
  color = "primary",
  height = "md",
  showMilestones = false,
  className,
}: ProgressBarProps) {
  const h = HEIGHT_CLASSES[height];
  return (
    <div className={clsx(`relative w-full overflow-hidden rounded-full bg-(--color-bg)`, h, className)}>
      <div
        className={clsx("h-full rounded-full transition-all duration-300", COLOR_CLASSES[color])}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
      />
      {showMilestones &&
        [25, 50, 75].map((m) => (
          <span key={m} className={clsx("absolute top-0 w-px bg-(--color-surface)/70", h)} style={{ left: `${m}%` }} aria-hidden="true" />
        ))}
    </div>
  );
}
```

---

### 10. `<IconActionButton>` — Botão de ação com ícone (editar/excluir)

**Problema:** Botões de ação com ícone `h-8 w-8 flex rounded-lg` são implementados manualmente com variantes de hover em todo componente que tem lista com edição. O mesmo hover `hover:text-(--color-primary)` e `hover:text-(--color-danger)` é repetido em pelo menos 10 lugares.

**Ocorrências atuais:**

`src/components/transactions/transaction-row.tsx` (linhas 96–111):
```tsx
<button
  type="button"
  onClick={() => onEdit(transaction)}
  aria-label={`Editar lançamento ${transaction.description}`}
  className="flex h-8 w-8 items-center justify-center rounded-lg text-(--color-text-muted) transition-colors hover:bg-(--color-bg) hover:text-(--color-primary)"
>
  <Pencil className="h-4 w-4" aria-hidden="true" />
</button>
<button
  type="button"
  onClick={() => onDelete(transaction)}
  aria-label={`Excluir lançamento ${transaction.description}`}
  className="flex h-8 w-8 items-center justify-center rounded-lg text-(--color-text-muted) transition-colors hover:bg-(--color-bg) hover:text-(--color-danger)"
>
  <Trash2 className="h-4 w-4" aria-hidden="true" />
</button>
```

`src/components/groups/category-manager.tsx` (linhas 112–130) — exato mesmo padrão.

`src/components/groups/category-manager.tsx` (linhas 140–156) — mesmo padrão em tamanho `h-7 w-7` para sub-grupos.

Também em: `wish-card.tsx`, `wishes-manager.tsx`, `modal.tsx` (botão fechar).

**Arquivo a criar:** `src/components/ui/icon-action-button.tsx`

**API proposta:**
```tsx
const HOVER_VARIANTS = {
  primary: "hover:text-(--color-primary)",
  danger:  "hover:text-(--color-danger)",
  default: "hover:text-(--color-text)",
} as const;

const SIZE_CLASSES = {
  sm: "h-7 w-7",
  md: "h-8 w-8",
} as const;

type IconActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: LucideIcon;
  label: string;
  hoverVariant?: keyof typeof HOVER_VARIANTS;
  size?: keyof typeof SIZE_CLASSES;
};

export function IconActionButton({
  icon: Icon,
  label,
  hoverVariant = "default",
  size = "md",
  className,
  ...props
}: IconActionButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      className={clsx(
        "flex items-center justify-center rounded-lg text-(--color-text-muted) transition-colors hover:bg-(--color-bg)",
        SIZE_CLASSES[size],
        HOVER_VARIANTS[hoverVariant],
        className
      )}
      {...props}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}
```

---

### 11. `<CardSection>` — Card com cabeçalho padronizado e empty state integrado

**Problema:** O padrão "card com ícone + título + subtítulo no header, seguido de lista ou empty state" é duplicado 6 vezes dentro de `insight-sections.tsx` e em outros lugares.

**Ocorrências atuais:**

`src/components/insights/insight-sections.tsx` — 6 cards com estrutura idêntica:
```tsx
<Card>
  <div className="flex items-center gap-2.5">
    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-(--color-primary)/10 text-(--color-primary)">
      <TrendingUp className="h-4.5 w-4.5" aria-hidden="true" />
    </span>
    <div>
      <h3 className="font-display text-base font-semibold text-(--color-text)">Maior crescimento de gastos</h3>
      <p className="mt-0.5 text-xs text-(--color-text-muted)">Comparação entre jan e mar</p>
    </div>
  </div>

  {data.length === 0 ? (
    <p className="py-4 text-center text-sm text-(--color-text-muted)">Ainda não há dados suficientes.</p>
  ) : (
    <ul className="flex flex-col gap-3">{data.map(...)}</ul>
  )}
</Card>
```

Também em: `budget-progress-view.tsx`, `comparative-explorer.tsx`.

**Arquivo a criar:** `src/components/ui/card-section.tsx`

**API proposta:**
```tsx
import { type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { IconBadge } from "@/components/ui/icon-badge";

type CardSectionProps = {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  colorToken?: string; // default: "--color-primary"
  empty?: boolean;
  emptyMessage?: string;
  children: React.ReactNode;
  className?: string;
};

export function CardSection({
  icon,
  title,
  subtitle,
  colorToken = "--color-primary",
  empty = false,
  emptyMessage = "Ainda não há dados suficientes.",
  children,
  className,
}: CardSectionProps) {
  return (
    <Card className={clsx("flex flex-col gap-4", className)}>
      <div className="flex items-center gap-2.5">
        <IconBadge icon={icon} size="sm" colorToken={colorToken} />
        <div>
          <h3 className="font-display text-base font-semibold text-(--color-text)">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-(--color-text-muted)">{subtitle}</p>}
        </div>
      </div>
      {empty ? (
        <p className="py-4 text-center text-sm text-(--color-text-muted)">{emptyMessage}</p>
      ) : (
        children
      )}
    </Card>
  );
}
```

**Uso após refatoração:**
```tsx
// insight-sections.tsx — 6 cards passam a ser:
<CardSection icon={TrendingUp} title="Maior crescimento de gastos" subtitle="Comparação entre jan e mar" empty={data.length === 0}>
  <ul className="flex flex-col gap-3">{data.map(...)}</ul>
</CardSection>
```

---

### 12. `<CollapsibleSection>` — Seção expansível com chevron

**Problema:** O padrão de header clicável com `aria-expanded` + chevron rotacionado + conteúdo que anima com `max-h` é implementado manualmente em 3 componentes.

**Ocorrências atuais:**

`src/components/transactions/fixed-expenses-checklist.tsx` (linhas 61–88):
```tsx
<button
  type="button"
  onClick={() => setExpanded((c) => !c)}
  aria-expanded={expanded}
  className="flex w-full items-center justify-between gap-3 text-left"
>
  <div>
    <h2 className="font-display text-xl font-semibold text-(--color-text)">Despesas fixas</h2>
    <p className="mt-1 text-sm text-(--color-text-muted)">Acompanhe...</p>
  </div>
  <ChevronDown
    className={`h-5 w-5 shrink-0 text-(--color-text-muted) transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
    aria-hidden="true"
  />
</button>
<div className={`flex flex-col gap-4 overflow-hidden transition-all duration-200 ${expanded ? "max-h-[10000px] opacity-100" : "max-h-0 opacity-0"}`}>
  {content}
</div>
```

Também em: `budget-progress-view.tsx`, `wish-detail-view.tsx`.

**Arquivo a criar:** `src/components/ui/collapsible-section.tsx`

**API proposta:**
```tsx
"use client";
import { useState } from "react";
import { ChevronDown } from "lucide-react";

type CollapsibleSectionProps = {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  level?: "h2" | "h3";
  children: React.ReactNode;
};

export function CollapsibleSection({
  title,
  description,
  defaultOpen = true,
  level: Tag = "h2",
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => setOpen((c) => !c)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div>
          <Tag className="font-display text-xl font-semibold text-(--color-text)">{title}</Tag>
          {description && <p className="mt-1 text-sm text-(--color-text-muted)">{description}</p>}
        </div>
        <ChevronDown
          className={clsx("h-5 w-5 shrink-0 text-(--color-text-muted) transition-transform duration-200", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>
      <div className={clsx("flex flex-col gap-4 overflow-hidden transition-all duration-200", open ? "max-h-[10000px] opacity-100" : "max-h-0 opacity-0")}>
        {children}
      </div>
    </div>
  );
}
```

---

### 13. `<SelectionBar>` — Barra de ação flutuante para seleção em lote

**Problema:** A barra sticky de "X selecionado(s)" com botões de ação em lote tem HTML quase idêntico em 3 componentes, com apenas os labels e handlers variando.

**Ocorrências atuais:**

`src/components/transactions/transaction-list.tsx` (linhas 145–165):
```tsx
{selectedCount > 0 && (
  <div className="sticky top-2 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-(--color-primary)/30 bg-(--color-primary)/10 px-4 py-3">
    <p className="text-sm font-medium text-(--color-text)">
      {selectedCount} selecionado(s)
    </p>
    <div className="flex flex-wrap gap-2">
      <Button variant="ghost" size="sm" onClick={clearSelection}>Cancelar</Button>
      <Button size="sm" onClick={openBulkEdit}>Editar ({selectedCount})</Button>
    </div>
  </div>
)}
```

Também em: `fixed-expenses-checklist.tsx`, `category-manager.tsx`.

**Arquivo a criar:** `src/components/ui/selection-bar.tsx`

**API proposta:**
```tsx
type SelectionBarProps = {
  count: number;
  label?: string; // default: "selecionado(s)"
  children: React.ReactNode; // botões de ação
};

export function SelectionBar({ count, label = "selecionado(s)", children }: SelectionBarProps) {
  if (count === 0) return null;
  return (
    <div className="sticky top-2 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-(--color-primary)/30 bg-(--color-primary)/10 px-4 py-3">
      <p className="text-sm font-medium text-(--color-text)">
        {count} {label}
      </p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
```

**Uso após refatoração:**
```tsx
<SelectionBar count={selectedCount}>
  <Button variant="ghost" size="sm" onClick={clearSelection}>Cancelar</Button>
  <Button size="sm" onClick={openBulkEdit}>Editar ({selectedCount})</Button>
</SelectionBar>
```

---

## Padrões e componentes que JÁ estão bem feitos — não mexer

| Componente / Padrão | Arquivo(s) | Por que está bom |
|---|---|---|
| `<Card>` | `ui/card.tsx` | Wrapper simples, aceita `className`, zero lógica |
| `<Button>` | `ui/button.tsx` | `forwardRef`, variantes por objeto, `isLoading` integrado |
| `<Modal>` | `ui/modal.tsx` | Escape key, focus trap, aria-modal, dois tamanhos |
| `<ConfirmDialog>` | `ui/confirm-dialog.tsx` | Variantes danger/primary, loading state, mensagem customizável |
| `<Input>` | `ui/input.tsx` | label + input + error em um componente só |
| `<Money>` | `ui/money.tsx` | Formatação isolada, consistência em todo o app |
| `<Skeleton>` | `ui/skeleton.tsx` | Animação padronizada |
| Manager pattern | `category-manager.tsx`, `transactions-manager.tsx`, `wishes-manager.tsx` | Estado de CRUD isolado no manager, modal para form, ConfirmDialog para delete |
| Wizard pattern | `goals/goals-wizard.tsx`, `split/split-wizard.tsx` | Union type para steps, stepper visual, congrats screen, estado limpo |

---

## Onde criar os arquivos

Todos os novos componentes vão em `src/components/ui/`, seguindo o padrão já estabelecido:

```
src/components/ui/
  card.tsx               ✓ existente
  button.tsx             ✓ existente
  modal.tsx              ✓ existente
  confirm-dialog.tsx     ✓ existente
  input.tsx              ✓ existente
  money.tsx              ✓ existente
  skeleton.tsx           ✓ existente
  page-header.tsx        ← novo (Fase 1)
  icon-badge.tsx         ← novo (Fase 1)
  empty-state.tsx        ← novo (Fase 1)
  intake-option.tsx      ← novo (Fase 1)
  status-badge.tsx       ← novo (Fase 1)
  icon-action-button.tsx ← novo (Fase 1)
  select-field.tsx       ← novo (Fase 2)
  toggle-group.tsx       ← novo (Fase 2)
  card-section.tsx       ← novo (Fase 2)
  selection-bar.tsx      ← novo (Fase 2)
  collapsible-section.tsx ← novo (Fase 3)
  alert.tsx              ← novo (Fase 3)
  progress-bar.tsx       ← novo (Fase 3)
```

---

## Prioridade de execução

### Fase 1 — Alto impacto, baixo risco (fazer primeiro)
Puramente estruturais — sem estado, sem lógica. Migração mecânica e segura.

1. `<IntakeOption>` — duplicação exata entre `transaction-intake.tsx` e `wish-intake.tsx`
2. `<EmptyState>` — 5+ ocorrências com código 100% idêntico
3. `<IconBadge>` — 8+ ocorrências; elimina inline styles espalhados
4. `<StatusBadge>` — 4+ ocorrências; padroniza tamanhos e cores de badges
5. `<IconActionButton>` — 10+ botões quase idênticos em 4 arquivos
6. `<PageHeader>` — header título + descrição + action em 7+ páginas

### Fase 2 — Médio impacto, requer atenção
Têm lógica simples ou precisam integrar com forms/cards.

7. `<SelectField>` — equivalente ao `<Input>` já existente, mas para `<select>`
8. `<ToggleGroup>` — requer testar `aria-pressed` e cores por variante
9. `<CardSection>` — 6 cards idênticos em `insight-sections.tsx`
10. `<SelectionBar>` — barra sticky de seleção em lote em 3 componentes

### Fase 3 — Refatoração mais profunda
Componentes com estado interno ou que exigem refatoração em vários arquivos ao mesmo tempo.

11. `<CollapsibleSection>` — extrair de `fixed-expenses-checklist.tsx`, `budget-progress-view.tsx`, `wish-detail-view.tsx`
12. `<Alert>` — refatorar `wish-detail-view.tsx` que tem a maior concentração
13. `<ProgressBar>` — criar e migrar `wish-card.tsx` + `wish-detail-view.tsx` primeiro

---

## Regras para a implementação

1. **Nenhum componente novo deve ter estado interno** — todos são presentacionais. Estado fica no componente pai. Exceção: `<CollapsibleSection>`, que encapsula o toggle por design.
2. **Classes Tailwind devem ser literais estáticas** — Tailwind v4 analisa estaticamente; não concatenar strings de classe dinamicamente (usar `clsx` com branches completos).
3. **`satisfies Record<...>`** no objeto de variantes para garantir type safety + autocomplete (padrão do `CARD_COLORS` em `summary-cards.tsx`).
4. **`aria-hidden="true"` em todos os ícones** — o label de acessibilidade vem do contexto, não do ícone.
5. **`forwardRef` apenas se o componente for usado em libs externas** (ex.: Radix) — no momento, nenhum novo componente precisa.
6. **Não criar abstração para "um lugar só"** — se o padrão aparece em menos de 3 lugares, avaliar se vale a pena antes de componentizar.

---

## Plano de testes

### Contexto atual

O projeto usa **Vitest** com dois tipos de teste já estabelecidos:

| Tipo | Exemplos | Ambiente |
|---|---|---|
| Funções puras (`lib/`) | `transaction-filters.test.ts`, `fixed-expense-resolver.test.ts` | `node` (sem DOM) |
| Server actions | `lancamentos/actions.test.ts`, `desejos/actions.test.ts` | `node` + Prisma + banco real |

**O que não existe ainda:** testes de componentes React. A refatoração é o momento certo para criar essa camada — cada componente novo entra testado, e cada migração é verificada por regressão.

---

### Setup necessário (fazer uma vez, antes da Fase 1)

**Instalar dependências:**
```bash
npm install -D @testing-library/react @testing-library/user-event @testing-library/jest-dom happy-dom
```

**Atualizar `vitest.config.ts`** — o ambiente `node` atual não tem DOM; os testes de componente precisam do ambiente `happy-dom`:
```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
    // Ambiente padrão continua node (testes de actions e lib não mudam)
    environment: "node",
    environmentMatchGlobs: [
      // Apenas arquivos de componentes rodam em happy-dom
      ["src/components/**/*.test.tsx", "happy-dom"],
    ],
    setupFiles: ["src/test-setup.ts"],
  },
});
```

**Criar `src/test-setup.ts`:**
```ts
import "@testing-library/jest-dom";
```

**Convenção de localização:** testes de componente ficam no mesmo diretório do componente, com sufixo `.test.tsx`. Seguindo o padrão já usado nos arquivos de `lib/` e `actions`.

```
src/components/ui/
  page-header.tsx
  page-header.test.tsx   ← co-localizado
  icon-badge.tsx
  icon-badge.test.tsx
  ...
```

---

### Testes por componente

#### `page-header.test.tsx`

```tsx
import { render, screen } from "@testing-library/react";
import { PageHeader } from "./page-header";
import { Button } from "./button";

describe("PageHeader", () => {
  it("renderiza o título", () => {
    render(<PageHeader title="Lançamentos" />);
    expect(screen.getByRole("heading", { name: "Lançamentos" })).toBeInTheDocument();
  });

  it("usa h1 por padrão", () => {
    render(<PageHeader title="Lançamentos" />);
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });

  it("usa o nível de heading informado via prop", () => {
    render(<PageHeader title="Seção" level="h2" />);
    expect(screen.getByRole("heading", { level: 2 })).toBeInTheDocument();
  });

  it("renderiza a descrição quando fornecida", () => {
    render(<PageHeader title="X" description="Subtítulo da página" />);
    expect(screen.getByText("Subtítulo da página")).toBeInTheDocument();
  });

  it("não renderiza parágrafo quando description é omitida", () => {
    render(<PageHeader title="X" />);
    expect(screen.queryByRole("paragraph")).not.toBeInTheDocument();
  });

  it("renderiza o slot de action à direita", () => {
    render(<PageHeader title="X" action={<Button>Novo</Button>} />);
    expect(screen.getByRole("button", { name: "Novo" })).toBeInTheDocument();
  });

  it("não renderiza o slot de action quando omitido", () => {
    render(<PageHeader title="X" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
```

---

#### `icon-badge.test.tsx`

```tsx
import { render } from "@testing-library/react";
import { Wallet } from "lucide-react";
import { IconBadge } from "./icon-badge";

describe("IconBadge", () => {
  it("renderiza sem crash com props mínimas", () => {
    const { container } = render(<IconBadge icon={Wallet} />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it("o span raiz tem aria-hidden pois é decorativo", () => {
    const { container } = render(<IconBadge icon={Wallet} />);
    expect(container.firstChild).toHaveAttribute("aria-hidden", "true");
  });

  it("aplica inline style quando colorHex é fornecido", () => {
    const { container } = render(<IconBadge icon={Wallet} colorHex="#A855F7" />);
    const span = container.firstChild as HTMLElement;
    expect(span.style.backgroundColor).toBeTruthy();
    expect(span.style.color).toBe("rgb(168, 85, 247)");
  });

  it("não aplica inline style quando usa colorToken", () => {
    const { container } = render(<IconBadge icon={Wallet} colorToken="--color-primary" />);
    const span = container.firstChild as HTMLElement;
    expect(span.style.backgroundColor).toBe("");
  });

  it.each(["sm", "md", "lg", "xl"] as const)("renderiza sem crash no tamanho %s", (size) => {
    const { container } = render(<IconBadge icon={Wallet} size={size} />);
    expect(container.firstChild).toBeInTheDocument();
  });
});
```

---

#### `empty-state.test.tsx`

```tsx
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { EmptyState } from "./empty-state";
import { Button } from "./button";

describe("EmptyState", () => {
  it("renderiza o título", () => {
    render(<EmptyState title="Nenhum item ainda" />);
    expect(screen.getByText("Nenhum item ainda")).toBeInTheDocument();
  });

  it("renderiza a descrição quando fornecida", () => {
    render(<EmptyState title="X" description="Crie seu primeiro item." />);
    expect(screen.getByText("Crie seu primeiro item.")).toBeInTheDocument();
  });

  it("não renderiza descrição quando omitida", () => {
    const { container } = render(<EmptyState title="X" />);
    // Apenas o título existe — nenhum parágrafo extra
    expect(container.querySelectorAll("p")).toHaveLength(1);
  });

  it("renderiza o action slot quando fornecido", () => {
    render(<EmptyState title="X" action={<Button>Criar</Button>} />);
    expect(screen.getByRole("button", { name: "Criar" })).toBeInTheDocument();
  });

  it("action slot é clicável", async () => {
    const handler = vi.fn();
    render(<EmptyState title="X" action={<Button onClick={handler}>Criar</Button>} />);
    await userEvent.click(screen.getByRole("button", { name: "Criar" }));
    expect(handler).toHaveBeenCalledOnce();
  });
});
```

---

#### `toggle-group.test.tsx`

```tsx
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { ToggleGroup } from "./toggle-group";

const OPTIONS = [
  { value: "EXPENSE" as const, label: "Despesa", activeColor: "--color-danger" },
  { value: "INCOME"  as const, label: "Entrada", activeColor: "--color-success" },
];

describe("ToggleGroup", () => {
  it("renderiza todas as opções", () => {
    render(<ToggleGroup value="EXPENSE" onChange={vi.fn()} options={OPTIONS} />);
    expect(screen.getByRole("button", { name: "Despesa" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Entrada" })).toBeInTheDocument();
  });

  it("a opção ativa tem aria-pressed=true", () => {
    render(<ToggleGroup value="EXPENSE" onChange={vi.fn()} options={OPTIONS} />);
    expect(screen.getByRole("button", { name: "Despesa" })).toHaveAttribute("aria-pressed", "true");
  });

  it("as opções inativas têm aria-pressed=false", () => {
    render(<ToggleGroup value="EXPENSE" onChange={vi.fn()} options={OPTIONS} />);
    expect(screen.getByRole("button", { name: "Entrada" })).toHaveAttribute("aria-pressed", "false");
  });

  it("chama onChange com o valor da opção clicada", async () => {
    const onChange = vi.fn();
    render(<ToggleGroup value="EXPENSE" onChange={onChange} options={OPTIONS} />);
    await userEvent.click(screen.getByRole("button", { name: "Entrada" }));
    expect(onChange).toHaveBeenCalledWith("INCOME");
  });

  it("renderiza a legend quando fornecida", () => {
    render(<ToggleGroup value="EXPENSE" onChange={vi.fn()} options={OPTIONS} legend="Tipo" />);
    expect(screen.getByText("Tipo")).toBeInTheDocument();
  });

  it("não renderiza legend quando omitida", () => {
    render(<ToggleGroup value="EXPENSE" onChange={vi.fn()} options={OPTIONS} />);
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
  });
});
```

---

#### `intake-option.test.tsx`

```tsx
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { PenLine } from "lucide-react";
import { IntakeOption } from "./intake-option";

describe("IntakeOption — como link", () => {
  it("renderiza um link com href", () => {
    render(<IntakeOption icon={PenLine} title="Manual" description="Descrição" href="/lancamentos/novo" />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/lancamentos/novo");
  });

  it("exibe título e descrição", () => {
    render(<IntakeOption icon={PenLine} title="Manual" description="Descrição" href="/x" />);
    expect(screen.getByText("Manual")).toBeInTheDocument();
    expect(screen.getByText("Descrição")).toBeInTheDocument();
  });
});

describe("IntakeOption — como botão", () => {
  it("renderiza um button quando onClick é fornecido", () => {
    render(<IntakeOption icon={PenLine} title="Lote" description="Via CSV" onClick={vi.fn()} />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("chama onClick ao clicar", async () => {
    const handler = vi.fn();
    render(<IntakeOption icon={PenLine} title="Lote" description="Via CSV" onClick={handler} />);
    await userEvent.click(screen.getByRole("button"));
    expect(handler).toHaveBeenCalledOnce();
  });

  it("não renderiza link quando onClick é fornecido", () => {
    render(<IntakeOption icon={PenLine} title="Lote" description="Via CSV" onClick={vi.fn()} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
```

---

#### `status-badge.test.tsx`

```tsx
import { render, screen } from "@testing-library/react";
import { CheckCircle2 } from "lucide-react";
import { StatusBadge } from "./status-badge";

describe("StatusBadge", () => {
  it("renderiza o label", () => {
    render(<StatusBadge label="Fixa" />);
    expect(screen.getByText("Fixa")).toBeInTheDocument();
  });

  it("renderiza o ícone quando fornecido", () => {
    const { container } = render(<StatusBadge label="Comprado" icon={CheckCircle2} />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("não renderiza ícone quando omitido", () => {
    const { container } = render(<StatusBadge label="Fixa" />);
    expect(container.querySelector("svg")).not.toBeInTheDocument();
  });

  it.each(["accent", "primary", "success", "danger", "muted"] as const)(
    "renderiza sem crash na variante %s",
    (variant) => {
      const { container } = render(<StatusBadge label="X" variant={variant} />);
      expect(container.firstChild).toBeInTheDocument();
    }
  );

  it("usa tamanho xs por padrão (uppercase tracking-wide)", () => {
    const { container } = render(<StatusBadge label="Fixa" />);
    const span = container.firstChild as HTMLElement;
    expect(span.className).toContain("uppercase");
    expect(span.className).toContain("tracking-wide");
  });

  it("tamanho sm não aplica uppercase", () => {
    const { container } = render(<StatusBadge label="Comprado em jan" size="sm" />);
    const span = container.firstChild as HTMLElement;
    expect(span.className).not.toContain("uppercase");
  });
});
```

---

#### `select-field.test.tsx`

```tsx
import { render, screen } from "@testing-library/react";
import { SelectField } from "./select-field";

describe("SelectField", () => {
  it("renderiza o label vinculado ao select", () => {
    render(
      <SelectField label="Categoria">
        <option value="1">Alimentação</option>
      </SelectField>
    );
    expect(screen.getByLabelText("Categoria")).toBeInTheDocument();
  });

  it("renderiza os filhos como opções do select", () => {
    render(
      <SelectField label="Categoria">
        <option value="1">Alimentação</option>
        <option value="2">Transporte</option>
      </SelectField>
    );
    expect(screen.getByRole("option", { name: "Alimentação" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Transporte" })).toBeInTheDocument();
  });

  it("renderiza a mensagem de erro quando fornecida", () => {
    render(<SelectField label="Categoria" error="Campo obrigatório" />);
    expect(screen.getByText("Campo obrigatório")).toBeInTheDocument();
  });

  it("não renderiza mensagem de erro quando omitida", () => {
    render(<SelectField label="Categoria" />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renderiza o hint quando fornecido", () => {
    render(<SelectField label="Categoria" hint={<button>+ Novo grupo</button>} />);
    expect(screen.getByRole("button", { name: "+ Novo grupo" })).toBeInTheDocument();
  });

  it("repassa props HTML ao select (disabled, name, etc.)", () => {
    render(<SelectField label="Categoria" name="categoryId" disabled />);
    const select = screen.getByLabelText("Categoria");
    expect(select).toHaveAttribute("name", "categoryId");
    expect(select).toBeDisabled();
  });
});
```

---

#### `alert.test.tsx`

```tsx
import { render, screen } from "@testing-library/react";
import { Info } from "lucide-react";
import { Alert } from "./alert";

describe("Alert", () => {
  it("renderiza o conteúdo filho", () => {
    render(<Alert>Mensagem de aviso</Alert>);
    expect(screen.getByText("Mensagem de aviso")).toBeInTheDocument();
  });

  it("renderiza o ícone quando fornecido", () => {
    const { container } = render(<Alert icon={Info}>Aviso</Alert>);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("não renderiza ícone quando omitido", () => {
    const { container } = render(<Alert>Aviso</Alert>);
    expect(container.querySelector("svg")).not.toBeInTheDocument();
  });

  it.each(["success", "info", "warning", "neutral", "default"] as const)(
    "renderiza sem crash na variante %s",
    (variant) => {
      const { container } = render(<Alert variant={variant}>Msg</Alert>);
      expect(container.firstChild).toBeInTheDocument();
    }
  );

  it("ícone tem aria-hidden pois é decorativo", () => {
    const { container } = render(<Alert icon={Info}>Aviso</Alert>);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});
```

---

#### `progress-bar.test.tsx`

```tsx
import { render } from "@testing-library/react";
import { ProgressBar } from "./progress-bar";

describe("ProgressBar", () => {
  it("tem role=progressbar", () => {
    const { getByRole } = render(<ProgressBar value={40} />);
    expect(getByRole("progressbar")).toBeInTheDocument();
  });

  it("expõe aria-valuenow correto", () => {
    const { getByRole } = render(<ProgressBar value={40} />);
    expect(getByRole("progressbar")).toHaveAttribute("aria-valuenow", "40");
  });

  it("a barra interna reflete o valor como largura percentual", () => {
    const { getByRole } = render(<ProgressBar value={60} />);
    const bar = getByRole("progressbar");
    expect(bar.style.width).toBe("60%");
  });

  it("limita a largura a 100% quando value > 100", () => {
    const { getByRole } = render(<ProgressBar value={150} />);
    expect(getByRole("progressbar")).toHaveStyle({ width: "100%" });
  });

  it("limita a largura a 0% quando value < 0", () => {
    const { getByRole } = render(<ProgressBar value={-10} />);
    expect(getByRole("progressbar")).toHaveStyle({ width: "0%" });
  });

  it("renderiza 3 marcadores de milestone quando showMilestones=true", () => {
    const { container } = render(<ProgressBar value={50} showMilestones />);
    // Cada milestone é um <span aria-hidden>
    const milestones = container.querySelectorAll("span[aria-hidden]");
    expect(milestones).toHaveLength(3);
  });

  it("não renderiza milestones por padrão", () => {
    const { container } = render(<ProgressBar value={50} />);
    expect(container.querySelectorAll("span[aria-hidden]")).toHaveLength(0);
  });

  it.each(["primary", "success", "danger", "accent"] as const)(
    "renderiza sem crash na cor %s",
    (color) => {
      const { container } = render(<ProgressBar value={50} color={color} />);
      expect(container.firstChild).toBeInTheDocument();
    }
  );
});
```

---

#### `icon-action-button.test.tsx`

```tsx
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { Pencil } from "lucide-react";
import { IconActionButton } from "./icon-action-button";

describe("IconActionButton", () => {
  it("aplica aria-label", () => {
    render(<IconActionButton icon={Pencil} label="Editar lançamento" />);
    expect(screen.getByRole("button", { name: "Editar lançamento" })).toBeInTheDocument();
  });

  it("é do tipo button por padrão (não submete form)", () => {
    render(<IconActionButton icon={Pencil} label="Editar" />);
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });

  it("chama onClick ao ser clicado", async () => {
    const handler = vi.fn();
    render(<IconActionButton icon={Pencil} label="Editar" onClick={handler} />);
    await userEvent.click(screen.getByRole("button"));
    expect(handler).toHaveBeenCalledOnce();
  });

  it("renderiza o ícone como svg", () => {
    const { container } = render(<IconActionButton icon={Pencil} label="Editar" />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it.each(["sm", "md"] as const)("renderiza sem crash no tamanho %s", (size) => {
    const { container } = render(<IconActionButton icon={Pencil} label="X" size={size} />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it.each(["primary", "danger", "default"] as const)("renderiza sem crash na hoverVariant %s", (hoverVariant) => {
    const { container } = render(<IconActionButton icon={Pencil} label="X" hoverVariant={hoverVariant} />);
    expect(container.firstChild).toBeInTheDocument();
  });
});
```

---

#### `card-section.test.tsx`

```tsx
import { render, screen } from "@testing-library/react";
import { TrendingUp } from "lucide-react";
import { CardSection } from "./card-section";

describe("CardSection", () => {
  it("renderiza o título", () => {
    render(<CardSection icon={TrendingUp} title="Maior crescimento">conteúdo</CardSection>);
    expect(screen.getByText("Maior crescimento")).toBeInTheDocument();
  });

  it("renderiza o subtítulo quando fornecido", () => {
    render(<CardSection icon={TrendingUp} title="X" subtitle="Comparação mensal">conteúdo</CardSection>);
    expect(screen.getByText("Comparação mensal")).toBeInTheDocument();
  });

  it("não renderiza subtítulo quando omitido", () => {
    const { container } = render(<CardSection icon={TrendingUp} title="X">conteúdo</CardSection>);
    // Apenas o título h3 existe no header
    expect(container.querySelectorAll("p")).toHaveLength(0);
  });

  it("renderiza os filhos quando empty=false (padrão)", () => {
    render(<CardSection icon={TrendingUp} title="X"><p>Lista de dados</p></CardSection>);
    expect(screen.getByText("Lista de dados")).toBeInTheDocument();
  });

  it("renderiza emptyMessage e esconde filhos quando empty=true", () => {
    render(
      <CardSection icon={TrendingUp} title="X" empty emptyMessage="Sem dados ainda.">
        <p>Lista de dados</p>
      </CardSection>
    );
    expect(screen.getByText("Sem dados ainda.")).toBeInTheDocument();
    expect(screen.queryByText("Lista de dados")).not.toBeInTheDocument();
  });

  it("usa emptyMessage padrão quando empty=true e nenhuma mensagem é fornecida", () => {
    render(<CardSection icon={TrendingUp} title="X" empty>conteúdo</CardSection>);
    expect(screen.getByText("Ainda não há dados suficientes.")).toBeInTheDocument();
  });
});
```

---

#### `collapsible-section.test.tsx`

```tsx
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { CollapsibleSection } from "./collapsible-section";

describe("CollapsibleSection", () => {
  it("renderiza o título", () => {
    render(<CollapsibleSection title="Despesas fixas">conteúdo</CollapsibleSection>);
    expect(screen.getByText("Despesas fixas")).toBeInTheDocument();
  });

  it("renderiza a descrição quando fornecida", () => {
    render(<CollapsibleSection title="X" description="Subtítulo">conteúdo</CollapsibleSection>);
    expect(screen.getByText("Subtítulo")).toBeInTheDocument();
  });

  it("começa aberto por padrão (aria-expanded=true)", () => {
    render(<CollapsibleSection title="X">conteúdo</CollapsibleSection>);
    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "true");
  });

  it("começa fechado quando defaultOpen=false", () => {
    render(<CollapsibleSection title="X" defaultOpen={false}>conteúdo</CollapsibleSection>);
    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "false");
  });

  it("alterna aria-expanded ao clicar no botão", async () => {
    render(<CollapsibleSection title="X">conteúdo</CollapsibleSection>);
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "true");
  });

  it("renderiza os filhos quando aberto", () => {
    render(<CollapsibleSection title="X">conteúdo visível</CollapsibleSection>);
    expect(screen.getByText("conteúdo visível")).toBeInTheDocument();
  });
});
```

---

#### `selection-bar.test.tsx`

```tsx
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { SelectionBar } from "./selection-bar";
import { Button } from "./button";

describe("SelectionBar", () => {
  it("não renderiza nada quando count=0", () => {
    const { container } = render(<SelectionBar count={0}><Button>Ação</Button></SelectionBar>);
    expect(container.firstChild).toBeNull();
  });

  it("renderiza quando count > 0", () => {
    render(<SelectionBar count={3}><Button>Ação</Button></SelectionBar>);
    expect(screen.getByText(/selecionado/)).toBeInTheDocument();
  });

  it("exibe o count na mensagem", () => {
    render(<SelectionBar count={5}><Button>Ação</Button></SelectionBar>);
    expect(screen.getByText(/5/)).toBeInTheDocument();
  });

  it('usa o label padrão "selecionado(s)"', () => {
    render(<SelectionBar count={2}><Button>Ação</Button></SelectionBar>);
    expect(screen.getByText(/selecionado\(s\)/)).toBeInTheDocument();
  });

  it("usa label customizado quando fornecido", () => {
    render(<SelectionBar count={2} label="item(ns)"><Button>Ação</Button></SelectionBar>);
    expect(screen.getByText(/item\(ns\)/)).toBeInTheDocument();
  });

  it("renderiza os botões de ação filhos", () => {
    const handler = vi.fn();
    render(
      <SelectionBar count={2}>
        <Button onClick={handler}>Editar</Button>
      </SelectionBar>
    );
    expect(screen.getByRole("button", { name: "Editar" })).toBeInTheDocument();
  });

  it("botões filhos são clicáveis", async () => {
    const handler = vi.fn();
    render(<SelectionBar count={2}><Button onClick={handler}>Editar</Button></SelectionBar>);
    await userEvent.click(screen.getByRole("button", { name: "Editar" }));
    expect(handler).toHaveBeenCalledOnce();
  });
});
```

---

### Testes de regressão nos componentes migrados

Cada componente que for refatorado para usar os novos primitivos ganha um arquivo `.test.tsx` que verifica o comportamento **de fora** — como o componente aparece e responde ao usuário, não como ele é implementado internamente. Isso garante que a migração não quebrou nada.

#### Arquivos afetados e o que testar

| Arquivo | O que verificar após migração |
|---|---|
| `transaction-intake.tsx` | Renderiza dois botões/links com títulos corretos; clicar em "Manual" navega para `/lancamentos/novo` |
| `wish-intake.tsx` | Renderiza dois botões; clicar em "Individual" chama `onIndividual`; clicar em "Em lote" chama `onBulk` |
| `transaction-list.tsx` | Empty state aparece quando lista está vazia; `SelectionBar` some quando `selectedCount=0`; aparece com contagem correta quando há seleção |
| `category-manager.tsx` | Empty state aparece quando não há grupos; ícone de editar chama `onEdit`; ícone de excluir chama `onDelete` |
| `fixed-expenses-checklist.tsx` | Seção começa expandida; colapsa ao clicar no header; `SelectionBar` aparece ao selecionar itens |
| `insight-sections.tsx` | Cada um dos 6 cards renderiza título correto; exibe empty message quando `data` é array vazio |
| `wish-card.tsx` | `ProgressBar` reflete o percentual do desejo; `StatusBadge` exibe o status correto |
| `wish-detail-view.tsx` | `Alert` renderiza a mensagem de timeline; `ProgressBar` com milestones visíveis; `CollapsibleSection` inicia aberta |
| `budget-progress-view.tsx` | `ProgressBar` de necessidades/desejos renderiza com as porcentagens certas; `CollapsibleSection` funciona |

#### Estrutura padrão para regressão (exemplo com `transaction-intake.tsx`)

```tsx
// src/components/transactions/transaction-intake.test.tsx
import { render, screen } from "@testing-library/react";
import { TransactionIntake } from "./transaction-intake";

describe("TransactionIntake", () => {
  it("renderiza a opção Manual com link para /lancamentos/novo", () => {
    render(<TransactionIntake />);
    const link = screen.getByRole("link", { name: /manual/i });
    expect(link).toHaveAttribute("href", "/lancamentos/novo");
  });

  it("renderiza a opção Importar planilha com link para /lancamentos/importar", () => {
    render(<TransactionIntake />);
    const link = screen.getByRole("link", { name: /importar planilha/i });
    expect(link).toHaveAttribute("href", "/lancamentos/importar");
  });
});
```

---

### Checklist de testes por fase

#### Fase 1 — antes de marcar qualquer item como concluído

- [ ] Setup instalado (`@testing-library/react`, `happy-dom`, `setupFiles`)
- [ ] `vitest.config.ts` atualizado com `environmentMatchGlobs`
- [ ] `src/test-setup.ts` criado
- [ ] `npm test` passa sem erros antes de qualquer alteração

**Por componente criado:**
- [ ] `page-header.test.tsx` — todos os casos passando
- [ ] `icon-badge.test.tsx` — todos os casos passando
- [ ] `empty-state.test.tsx` — todos os casos passando
- [ ] `intake-option.test.tsx` — todos os casos passando
- [ ] `status-badge.test.tsx` — todos os casos passando
- [ ] `icon-action-button.test.tsx` — todos os casos passando

**Por arquivo migrado (Fase 1):**
- [ ] `transaction-intake.test.tsx` — regressão passando
- [ ] `wish-intake.test.tsx` — regressão passando
- [ ] `transaction-list.test.tsx` — empty state + selection bar passando
- [ ] `category-manager.test.tsx` — empty state + ações passando

#### Fase 2 — antes de marcar qualquer item como concluído

- [ ] `select-field.test.tsx` — todos os casos passando
- [ ] `toggle-group.test.tsx` — todos os casos passando
- [ ] `card-section.test.tsx` — todos os casos passando
- [ ] `selection-bar.test.tsx` — todos os casos passando
- [ ] `insight-sections.test.tsx` — 6 card sections + empty states passando

#### Fase 3 — antes de marcar qualquer item como concluído

- [ ] `collapsible-section.test.tsx` — todos os casos passando
- [ ] `alert.test.tsx` — todos os casos passando
- [ ] `progress-bar.test.tsx` — todos os casos passando
- [ ] `fixed-expenses-checklist.test.tsx` — colapsível + seleção passando
- [ ] `wish-card.test.tsx` — progress bar + badges passando
- [ ] `wish-detail-view.test.tsx` — alert + progress + collapsible passando
- [ ] `budget-progress-view.test.tsx` — progress + collapsible passando

---

### Comandos para rodar os testes

```bash
# Todos os testes (lib + actions + componentes)
npm test

# Apenas testes de componentes
npx vitest run src/components

# Apenas um arquivo específico
npx vitest run src/components/ui/progress-bar.test.tsx

# Modo watch durante desenvolvimento
npx vitest src/components/ui/progress-bar.test.tsx
```
