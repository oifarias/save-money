const LEDGER_ENTRIES = [
  { description: "Supermercado Pão de Açúcar", category: "Alimentação", color: "#1a9e6f", amount: -284.5 },
  { description: "Salário", category: "Renda", color: "#147a55", amount: 4200 },
  { description: "Uber para o trabalho", category: "Transporte", color: "#f0a500", amount: -23.9 },
  { description: "Aluguel", category: "Moradia", color: "#e84040", amount: -1450 },
  { description: "Academia", category: "Saúde", color: "#22c97a", amount: -99.9 },
  { description: "Netflix", category: "Lazer", color: "#6b7a72", amount: -39.9 },
  { description: "Freelance — Projeto X", category: "Renda extra", color: "#147a55", amount: 800 },
  { description: "Conta de luz", category: "Moradia", color: "#e84040", amount: -167.3 },
  { description: "Farmácia", category: "Saúde", color: "#22c97a", amount: -54.2 },
  { description: "Restaurante japonês", category: "Alimentação", color: "#1a9e6f", amount: -112.0 },
] as const;

function formatLedgerAmount(amount: number) {
  const formatted = Math.abs(amount).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${amount < 0 ? "-" : "+"} R$ ${formatted}`;
}

function LedgerRow({ entry }: { entry: (typeof LEDGER_ENTRIES)[number] }) {
  const isExpense = entry.amount < 0;
  return (
    <div className="flex items-center gap-3 border-b border-(--color-border) px-4 py-3 last:border-b-0">
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-(--color-text)">{entry.description}</p>
        <p className="text-xs text-(--color-text-muted)">{entry.category}</p>
      </div>
      <p
        className={`font-numeric shrink-0 text-sm font-semibold ${
          isExpense ? "text-(--color-danger)" : "text-(--color-success)"
        }`}
      >
        {formatLedgerAmount(entry.amount)}
      </p>
    </div>
  );
}

export function LiveLedger() {
  return (
    <div
      className="relative h-[420px] overflow-hidden rounded-2xl border border-(--color-border) bg-(--color-surface) shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
      role="img"
      aria-label="Exemplo animado de lançamentos sendo registrados no extrato"
    >
      <div className="animate-ledger-scroll">
        {LEDGER_ENTRIES.map((entry, index) => (
          <LedgerRow key={`a-${index}`} entry={entry} />
        ))}
        {LEDGER_ENTRIES.map((entry, index) => (
          <LedgerRow key={`b-${index}`} entry={entry} />
        ))}
      </div>
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-(--color-surface) to-transparent"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-(--color-surface) to-transparent"
        aria-hidden="true"
      />
    </div>
  );
}
