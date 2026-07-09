"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save, Share2, ChevronLeft, Loader2, SlidersHorizontal, Copy, Check } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { ChartDisplay } from "@/components/analise/chart-display";
import { ChartTypeSelector } from "@/components/analise/chart-type-selector";
import { ExplorerFilters } from "@/components/analise/explorer-filters";
import { fetchExplorerDataAction, saveVisualizationAction, toggleShareVisualizationAction } from "@/app/(app)/analise/actions";
import { formatCurrency } from "@/lib/format";
import type { ExplorerFilters as ExplorerFiltersType, ExplorerResult } from "@/lib/analise-data";

const DEFAULT_FILTERS: ExplorerFiltersType = {
  categoryIds: [],
  subcategoryIds: [],
  tagIds: [],
  type: "EXPENSE",
  dateFrom: null,
  dateTo: null,
  period: "30",
  groupBy: "category",
  chartType: "bar-vertical",
  showValues: true,
  showLegend: true,
};

type SavedViz = {
  id: string;
  name: string;
  chartType: string;
  shareActive: boolean;
  shareToken: string | null;
};

type Props = {
  categories: { id: string; name: string; color: string }[];
  subcategories: { id: string; name: string; color: string; parentId: string }[];
  tags: { id: string; name: string }[];
  initialFilters?: ExplorerFiltersType;
  savedViz?: SavedViz;
};

export function Explorer({ categories, subcategories, tags, initialFilters, savedViz }: Props) {
  const router = useRouter();

  const [filters, setFilters] = useState<ExplorerFiltersType>(initialFilters ?? DEFAULT_FILTERS);
  const [result, setResult] = useState<ExplorerResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const [filtersOpen, setFiltersOpen] = useState(true);

  // Save modal
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveName, setSaveName] = useState(savedViz?.name ?? "");
  const [saveDescription, setSaveDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveAsNew, setSaveAsNew] = useState(false);

  // Share modal
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareActive, setShareActive] = useState(savedViz?.shareActive ?? false);
  const [shareToken, setShareToken] = useState<string | null>(savedViz?.shareToken ?? null);
  const [isToggling, setIsToggling] = useState(false);
  const [copied, setCopied] = useState(false);

  // Fetch data when filters change
  useEffect(() => {
    startTransition(async () => {
      try {
        const data = await fetchExplorerDataAction(filters);
        setResult(data);
      } catch {
        toast.error("Erro ao buscar dados");
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  async function handleSave(useExistingId: boolean) {
    if (!saveName.trim()) {
      toast.error("Nome da análise é obrigatório");
      return;
    }
    setIsSaving(true);
    try {
      const id = useExistingId && savedViz?.id && !saveAsNew ? savedViz.id : undefined;
      const { id: newId } = await saveVisualizationAction({
        id,
        name: saveName.trim(),
        description: saveDescription.trim() || undefined,
        filters,
      });
      toast.success(id ? "Análise atualizada" : "Análise salva com sucesso");
      setSaveModalOpen(false);
      router.push(`/analise/${newId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleShare() {
    if (!savedViz?.id) return;
    setIsToggling(true);
    try {
      const result = await toggleShareVisualizationAction(savedViz.id);
      setShareActive(result.shareActive);
      setShareToken(result.shareToken);
      toast.success(result.shareActive ? "Compartilhamento ativado" : "Compartilhamento desativado");
    } catch {
      toast.error("Erro ao alterar compartilhamento");
    } finally {
      setIsToggling(false);
    }
  }

  function handleCopyLink() {
    if (!shareToken) return;
    const url = `${window.location.origin}/analise/publica/${shareToken}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const shareUrl = shareToken ? `${typeof window !== "undefined" ? window.location.origin : ""}/analise/publica/${shareToken}` : null;

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/analise")}
            className="inline-flex items-center gap-1 text-sm text-(--color-text-muted) hover:text-(--color-text) transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Minhas análises
          </button>
          <span className="text-(--color-border)">·</span>
          <h1 className="font-display text-lg font-semibold text-(--color-text)">
            {savedViz?.name ?? "Nova análise"}
          </h1>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            onClick={() => setFiltersOpen((v) => !v)}
            className="gap-1.5"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filtros
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setSaveName(savedViz?.name ?? "");
              setSaveAsNew(false);
              setSaveModalOpen(true);
            }}
          >
            <Save className="h-4 w-4" />
            Salvar
          </Button>
          {savedViz && (
            <Button variant="ghost" onClick={() => setShareModalOpen(true)}>
              <Share2 className="h-4 w-4" />
              Compartilhar
            </Button>
          )}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex gap-5">
        {/* Filters panel */}
        {filtersOpen && (
          <div className="w-72 shrink-0">
            <Card>
              <ExplorerFilters
                filters={filters}
                categories={categories}
                subcategories={subcategories}
                tags={tags}
                onChange={setFilters}
              />
            </Card>
          </div>
        )}

        {/* Main area */}
        <div className="min-w-0 flex-1 flex flex-col gap-4">
          {/* Chart type selector */}
          <Card>
            <ChartTypeSelector
              value={filters.chartType}
              onChange={(chartType) => setFilters((f) => ({ ...f, chartType }))}
            />
          </Card>

          {/* Chart + options */}
          <Card>
            {/* Group by + display options */}
            <div className="mb-4 flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-(--color-text-muted)">Agrupar por:</span>
                {(["category", "month"] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setFilters((f) => ({ ...f, groupBy: g }))}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                      filters.groupBy === g
                        ? "bg-(--color-primary) text-white"
                        : "border border-(--color-border) text-(--color-text-muted) hover:border-(--color-primary)/40"
                    }`}
                  >
                    {g === "category" ? "Por grupo" : "Por mês"}
                  </button>
                ))}
              </div>
              <div className="ml-auto flex items-center gap-3">
                <label className="flex cursor-pointer items-center gap-1.5 text-xs text-(--color-text-muted)">
                  <input
                    type="checkbox"
                    checked={filters.showValues}
                    onChange={(e) => setFilters((f) => ({ ...f, showValues: e.target.checked }))}
                    className="accent-(--color-primary)"
                  />
                  Valores
                </label>
                <label className="flex cursor-pointer items-center gap-1.5 text-xs text-(--color-text-muted)">
                  <input
                    type="checkbox"
                    checked={filters.showLegend}
                    onChange={(e) => setFilters((f) => ({ ...f, showLegend: e.target.checked }))}
                    className="accent-(--color-primary)"
                  />
                  Legenda
                </label>
              </div>
            </div>

            {filters.groupBy === "category" && filters.categoryIds.length === 1 && (
              <p className="mb-2 text-xs text-(--color-text-muted)">
                Mostrando subgrupos de &ldquo;
                {categories.find((c) => c.id === filters.categoryIds[0])?.name ?? ""}
                &rdquo;
              </p>
            )}

            {/* Chart or loading */}
            {isPending ? (
              <div className="flex h-72 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-(--color-text-muted)" />
              </div>
            ) : (
              <ChartDisplay
                data={result?.data ?? []}
                series={result?.series ?? []}
                chartType={filters.chartType}
                showValues={filters.showValues}
                showLegend={filters.showLegend}
              />
            )}

            {/* Total */}
            {result && !result.isEmpty && (
              <p className="mt-3 text-right text-xs text-(--color-text-muted)">
                Total:{" "}
                <span className="font-numeric font-medium text-(--color-text)">
                  {formatCurrency(result.total)}
                </span>
              </p>
            )}
          </Card>
        </div>
      </div>

      {/* Save Modal */}
      <Modal
        open={saveModalOpen}
        title="Salvar análise"
        onClose={() => setSaveModalOpen(false)}
      >
        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-(--color-text)">
              Nome <span className="text-(--color-danger)">*</span>
            </label>
            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="Ex.: Gastos com alimentação 2026"
              maxLength={100}
              className="w-full rounded-xl border border-(--color-border) bg-(--color-bg) px-3 py-2.5 text-sm text-(--color-text) placeholder:text-(--color-text-muted) focus:outline-none focus:ring-2 focus:ring-(--color-primary)/30"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-(--color-text)">
              Descrição <span className="text-xs font-normal text-(--color-text-muted)">(opcional)</span>
            </label>
            <textarea
              value={saveDescription}
              onChange={(e) => setSaveDescription(e.target.value)}
              placeholder="Uma breve descrição sobre o que esta análise mostra..."
              maxLength={500}
              rows={3}
              className="w-full resize-none rounded-xl border border-(--color-border) bg-(--color-bg) px-3 py-2.5 text-sm text-(--color-text) placeholder:text-(--color-text-muted) focus:outline-none focus:ring-2 focus:ring-(--color-primary)/30"
            />
          </div>

          {savedViz?.id && (
            <div className="flex items-center gap-2 rounded-xl border border-(--color-border) bg-(--color-bg) p-3">
              <input
                type="checkbox"
                id="save-as-new"
                checked={saveAsNew}
                onChange={(e) => setSaveAsNew(e.target.checked)}
                className="accent-(--color-primary)"
              />
              <label htmlFor="save-as-new" className="cursor-pointer text-sm text-(--color-text)">
                Salvar como nova análise
              </label>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button variant="secondary" onClick={() => setSaveModalOpen(false)} className="flex-1">
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={() => handleSave(!saveAsNew)}
              isLoading={isSaving}
              className="flex-1"
            >
              {savedViz?.id && !saveAsNew ? "Atualizar" : "Salvar"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Share Modal */}
      {savedViz && (
        <Modal
          open={shareModalOpen}
          title="Compartilhar análise"
          onClose={() => setShareModalOpen(false)}
        >
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-(--color-border) bg-(--color-bg) p-3 text-sm text-(--color-text-muted)">
              Qualquer pessoa com este link pode ver este gráfico com seus dados reais de lançamentos.
            </div>

            {/* Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-(--color-text)">Compartilhamento público</p>
                <p className="text-xs text-(--color-text-muted)">
                  {shareActive ? "Link ativo — qualquer pessoa pode visualizar" : "Link desativado"}
                </p>
              </div>
              <button
                type="button"
                onClick={handleToggleShare}
                disabled={isToggling}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-60 ${
                  shareActive ? "bg-(--color-primary)" : "bg-(--color-border)"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
                    shareActive ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>

            {/* Link */}
            {shareActive && shareUrl && (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium text-(--color-text-muted)">Link público</p>
                <div className="flex items-center gap-2 rounded-xl border border-(--color-border) bg-(--color-bg) p-3">
                  <span className="min-w-0 flex-1 truncate text-sm font-mono text-(--color-text)">
                    {shareUrl}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="shrink-0 rounded-lg p-1.5 text-(--color-text-muted) hover:bg-(--color-surface) hover:text-(--color-text) transition-colors"
                    title="Copiar link"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-(--color-success)" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            )}

            <Button variant="secondary" onClick={() => setShareModalOpen(false)}>
              Fechar
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
