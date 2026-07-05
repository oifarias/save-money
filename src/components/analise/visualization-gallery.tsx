"use client";

import { useState } from "react";
import Link from "next/link";
import { BarChart2, AlignLeft, TrendingUp, Activity, PieChart, Disc, Layers, Trash2, Share2, ExternalLink } from "lucide-react";
import toast from "react-hot-toast";
import { Card } from "@/components/ui/card";
import { deleteVisualizationAction } from "@/app/(app)/analise/actions";

type SavedVisualization = {
  id: string;
  name: string;
  description: string | null;
  chartType: string;
  shareActive: boolean;
  updatedAt: Date;
  filters: unknown;
};

type Props = {
  visualizations: SavedVisualization[];
};

const CHART_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  "bar-vertical": BarChart2,
  "bar-horizontal": AlignLeft,
  "line": TrendingUp,
  "area": Activity,
  "pie": PieChart,
  "donut": Disc,
  "stacked-bar": Layers,
};

const CHART_LABEL_MAP: Record<string, string> = {
  "bar-vertical": "Barras",
  "bar-horizontal": "Horizontal",
  "line": "Linha",
  "area": "Área",
  "pie": "Pizza",
  "donut": "Donut",
  "stacked-bar": "Empilhado",
};

function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

export function VisualizationGallery({ visualizations }: Props) {
  const [items, setItems] = useState(visualizations);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    if (confirmId !== id) {
      setConfirmId(id);
      return;
    }
    setDeletingId(id);
    try {
      await deleteVisualizationAction(id);
      setItems((prev) => prev.filter((v) => v.id !== id));
      toast.success("Análise excluída");
    } catch {
      toast.error("Erro ao excluir análise");
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center">
        <p className="font-display text-lg font-semibold text-(--color-text)">Nenhuma análise salva</p>
        <p className="max-w-sm text-sm text-(--color-text-muted)">
          Crie sua primeira análise para explorar seus dados financeiros de forma personalizada.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((viz) => {
        const Icon = CHART_ICON_MAP[viz.chartType] ?? BarChart2;
        const chartLabel = CHART_LABEL_MAP[viz.chartType] ?? viz.chartType;
        const isConfirming = confirmId === viz.id;
        const isDeleting = deletingId === viz.id;

        return (
          <Card key={viz.id} className="flex flex-col gap-3">
            {/* Header */}
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-(--color-primary)/10">
                <Icon className="h-5 w-5 text-(--color-primary)" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-display text-sm font-semibold text-(--color-text) truncate">
                  {viz.name}
                </h3>
                {viz.description && (
                  <p className="mt-0.5 text-xs text-(--color-text-muted) line-clamp-2">
                    {viz.description}
                  </p>
                )}
              </div>
            </div>

            {/* Meta */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 rounded-lg border border-(--color-border) px-2 py-0.5 text-xs text-(--color-text-muted)">
                {chartLabel}
              </span>
              {viz.shareActive && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-(--color-primary)/10 px-2 py-0.5 text-xs font-medium text-(--color-primary)">
                  <Share2 className="h-3 w-3" />
                  Compartilhado
                </span>
              )}
              <span className="ml-auto text-xs text-(--color-text-muted)">
                {formatShortDate(viz.updatedAt)}
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-1 border-t border-(--color-border)">
              <Link
                href={`/analise/${viz.id}`}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-(--color-border) px-3 py-2 text-xs font-medium text-(--color-text) hover:border-(--color-primary) transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Abrir
              </Link>
              <button
                type="button"
                onClick={() => handleDelete(viz.id)}
                disabled={isDeleting}
                className={`inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50 ${
                  isConfirming
                    ? "bg-(--color-danger) text-white"
                    : "border border-(--color-border) text-(--color-text-muted) hover:border-(--color-danger)/40 hover:text-(--color-danger)"
                }`}
                onBlur={() => setConfirmId(null)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {isConfirming ? "Confirmar?" : "Excluir"}
              </button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
