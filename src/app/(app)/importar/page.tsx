import { Upload } from "lucide-react";
import { ComingSoon } from "@/components/ui/coming-soon";

export default function ImportarPage() {
  return (
    <ComingSoon
      icon={Upload}
      title="Importar via Excel"
      description="Envie planilhas .xlsx ou .xls, mapeie as colunas e importe seus lançamentos em lote"
    />
  );
}
