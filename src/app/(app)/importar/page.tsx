import { ImportWizard } from "@/components/import/import-wizard";

export default async function ImportarPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-(--color-text)">Importar via Excel</h1>
        <p className="mt-1 text-sm text-(--color-text-muted)">
          Envie planilhas .xlsx ou .xls, mapeie as colunas e importe seus lançamentos em lote
        </p>
      </div>

      <ImportWizard />
    </div>
  );
}
