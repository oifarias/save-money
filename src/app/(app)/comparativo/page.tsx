import { auth } from "@/lib/auth";
import { getComparativeData } from "@/lib/comparative-data";
import { ComparativeExplorer } from "@/components/comparative/comparative-explorer";

export default async function ComparativoPage() {
  const session = await auth();
  const userId = session!.user.id;

  const data = await getComparativeData(userId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-(--color-text)">Comparativo mês a mês</h1>
        <p className="mt-1 text-sm text-(--color-text-muted)">
          Compare dois ou mais meses por grupo, com variação percentual e exportação
        </p>
      </div>

      <ComparativeExplorer data={data} />
    </div>
  );
}
