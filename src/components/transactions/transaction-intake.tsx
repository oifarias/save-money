import { PenLine, FileSpreadsheet } from "lucide-react";
import { IntakeOption } from "@/components/ui/intake-option";

export function TransactionIntake() {
  return (
    <section className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <IntakeOption
          href="/lancamentos/novo"
          icon={PenLine}
          title="Manual"
          description="Adicione um ou mais lançamentos com categoria e tags"
        />
        <IntakeOption
          href="/lancamentos/importar"
          icon={FileSpreadsheet}
          title="Importar planilha"
          description="Várias linhas de uma vez, a partir de um .xlsx ou .xls"
          colorToken="--color-accent"
        />
      </div>
    </section>
  );
}
