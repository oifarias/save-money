import { BarChart3 } from "lucide-react";
import { ComingSoon } from "@/components/ui/coming-soon";

export default function ComparativoPage() {
  return (
    <ComingSoon
      icon={BarChart3}
      title="Comparativo mês a mês"
      description="Compare dois ou mais meses por grupo, com variação percentual e exportação"
    />
  );
}
