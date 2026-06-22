import { getAdminKpis, getMonthlyGrowth } from "@/lib/admin-data";
import { KpiCards } from "@/components/admin/kpi-cards";
import { GrowthCharts } from "@/components/admin/growth-charts";

export const metadata = {
  title: "Painel administrativo — Save Money",
};

export default async function AdminDashboardPage() {
  const [kpis, growth] = await Promise.all([getAdminKpis(), getMonthlyGrowth()]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-(--color-text)">Visão geral do produto</h1>
        <p className="mt-1 text-sm text-(--color-text-muted)">KPIs agregados de todos os usuários</p>
      </div>

      <KpiCards kpis={kpis} />
      <GrowthCharts data={growth} />
    </div>
  );
}
