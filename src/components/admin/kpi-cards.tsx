import { Users, Receipt, Lightbulb, Share2, TrendingUp, Wallet, Coins } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import type { AdminKpis } from "@/lib/admin-data";

function KpiCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Users;
}) {
  return (
    <Card className="flex items-start justify-between">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-(--color-text-muted)">{label}</p>
        <p className="mt-2 font-numeric text-xl font-semibold text-(--color-text) sm:text-2xl">{value}</p>
      </div>
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-(--color-primary)/10 text-(--color-primary)">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
    </Card>
  );
}

export function KpiCards({ kpis }: { kpis: AdminKpis }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Usuários cadastrados" value={kpis.totalUsers.toLocaleString("pt-BR")} icon={Users} />
        <KpiCard
          label="Lançamentos cadastrados"
          value={kpis.totalTransactions.toLocaleString("pt-BR")}
          icon={Receipt}
        />
        <KpiCard label="Insights gerados" value={kpis.totalInsights.toLocaleString("pt-BR")} icon={Lightbulb} />
        <KpiCard label="Links de divisão gerados" value={kpis.totalSharedSplits.toLocaleString("pt-BR")} icon={Share2} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label="Média de lançamentos por usuário"
          value={kpis.avgTransactionsPerUser.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
          icon={TrendingUp}
        />
        <KpiCard label="Valor médio por lançamento" value={formatCurrency(kpis.avgTransactionAmount)} icon={Coins} />
        <KpiCard label="Volume financeiro total" value={formatCurrency(kpis.totalVolume)} icon={Wallet} />
      </div>
    </div>
  );
}
