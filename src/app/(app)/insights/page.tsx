import { Lightbulb } from "lucide-react";
import { ComingSoon } from "@/components/ui/coming-soon";

export default function InsightsPage() {
  return (
    <ComingSoon
      icon={Lightbulb}
      title="Insights e recomendações"
      description="Análises detalhadas de tendências, hashtags e sugestões de economia baseadas nos seus dados"
    />
  );
}
