"use client";

import type { ExplorerFilters } from "@/lib/analise-data";

type Props = {
  filters: ExplorerFilters;
  categories: { id: string; name: string; color: string }[];
  subcategories: { id: string; name: string; color: string; parentId: string }[];
  tags: { id: string; name: string }[];
  onChange: (filters: ExplorerFilters) => void;
};

const PERIOD_OPTIONS: { value: ExplorerFilters["period"]; label: string }[] = [
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
  { value: "180", label: "Últimos 6 meses" },
  { value: "365", label: "Último ano" },
  { value: "all", label: "Todo período" },
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-medium uppercase tracking-wide text-(--color-text-muted)">
      {children}
    </p>
  );
}

/** Cabeçalho comum às seções de filtro com múltipla seleção (Grupos, Subgrupos, Tags). */
function FilterSectionHeader({ label, count, onClear }: { label: string; count: number; onClear: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <SectionLabel>
        {label}
        {count > 0 && (
          <span className="ml-2 inline-flex items-center rounded-full bg-(--color-primary)/10 px-1.5 py-0.5 text-xs font-medium text-(--color-primary) normal-case tracking-normal">
            {count}
          </span>
        )}
      </SectionLabel>
      {count > 0 && (
        <button type="button" onClick={onClear} className="text-xs text-(--color-text-muted) hover:text-(--color-text)">
          Limpar
        </button>
      )}
    </div>
  );
}

/** Linha de checkbox comum às seções de filtro — `color` é opcional (Tags não tem cor). */
function FilterCheckboxRow({
  id,
  name,
  color,
  checked,
  onToggle,
}: {
  id: string;
  name: string;
  color?: string;
  checked: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-lg px-1 py-0.5 hover:bg-(--color-bg)">
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onToggle(id)}
        className="accent-(--color-primary)"
      />
      {color && <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: color }} />}
      <span className="text-sm text-(--color-text)">{name}</span>
    </label>
  );
}

export function ExplorerFilters({ filters, categories, subcategories, tags, onChange }: Props) {
  function set<K extends keyof ExplorerFilters>(key: K, value: ExplorerFilters[K]) {
    onChange({ ...filters, [key]: value });
  }

  function toggleCategory(id: string) {
    const next = filters.categoryIds.includes(id)
      ? filters.categoryIds.filter((c) => c !== id)
      : [...filters.categoryIds, id];
    set("categoryIds", next);
  }

  function toggleSubcategory(id: string) {
    const next = filters.subcategoryIds.includes(id)
      ? filters.subcategoryIds.filter((c) => c !== id)
      : [...filters.subcategoryIds, id];
    set("subcategoryIds", next);
  }

  const visibleSubcategories =
    filters.categoryIds.length > 0
      ? subcategories.filter((s) => filters.categoryIds.includes(s.parentId))
      : subcategories;

  const parentCategoryName = new Map(categories.map((c) => [c.id, c.name]));

  function toggleTag(id: string) {
    const next = filters.tagIds.includes(id)
      ? filters.tagIds.filter((t) => t !== id)
      : [...filters.tagIds, id];
    set("tagIds", next);
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Tipo */}
      <div className="flex flex-col gap-2">
        <SectionLabel>Tipo</SectionLabel>
        <div className="flex gap-1.5">
          {(["EXPENSE", "INCOME", "BOTH"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => set("type", t)}
              className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-all ${
                filters.type === t
                  ? "bg-(--color-primary) text-white"
                  : "border border-(--color-border) text-(--color-text-muted) hover:border-(--color-primary)/40"
              }`}
            >
              {t === "EXPENSE" ? "Despesa" : t === "INCOME" ? "Entrada" : "Ambos"}
            </button>
          ))}
        </div>
      </div>

      {/* Período */}
      <div className="flex flex-col gap-2">
        <SectionLabel>Período</SectionLabel>
        <select
          value={filters.period}
          onChange={(e) => {
            onChange({
              ...filters,
              period: e.target.value as ExplorerFilters["period"],
              dateFrom: null,
              dateTo: null,
            });
          }}
          className="w-full rounded-xl border border-(--color-border) bg-(--color-surface) px-3 py-2 text-sm text-(--color-text) focus:outline-none focus:ring-2 focus:ring-(--color-primary)/30"
        >
          {PERIOD_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Datas customizadas */}
      <div className="flex flex-col gap-2">
        <SectionLabel>Datas customizadas</SectionLabel>
        <div className="flex flex-col gap-2">
          <div>
            <label className="mb-1 block text-xs text-(--color-text-muted)">De</label>
            <input
              type="date"
              value={filters.dateFrom ?? ""}
              onChange={(e) => set("dateFrom", e.target.value || null)}
              className="w-full rounded-xl border border-(--color-border) bg-(--color-surface) px-3 py-2 text-sm text-(--color-text) focus:outline-none focus:ring-2 focus:ring-(--color-primary)/30"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-(--color-text-muted)">Até</label>
            <input
              type="date"
              value={filters.dateTo ?? ""}
              onChange={(e) => set("dateTo", e.target.value || null)}
              className="w-full rounded-xl border border-(--color-border) bg-(--color-surface) px-3 py-2 text-sm text-(--color-text) focus:outline-none focus:ring-2 focus:ring-(--color-primary)/30"
            />
          </div>
        </div>
      </div>

      {/* Grupos */}
      {categories.length > 0 && (
        <div className="flex flex-col gap-2">
          <FilterSectionHeader label="Grupos" count={filters.categoryIds.length} onClear={() => set("categoryIds", [])} />
          <div className="flex max-h-44 flex-col gap-1.5 overflow-y-auto">
            {categories.map((cat) => (
              <FilterCheckboxRow
                key={cat.id}
                id={cat.id}
                name={cat.name}
                color={cat.color}
                checked={filters.categoryIds.includes(cat.id)}
                onToggle={toggleCategory}
              />
            ))}
          </div>
        </div>
      )}

      {/* Subgrupos */}
      {subcategories.length > 0 && (
        <div className="flex flex-col gap-2">
          <FilterSectionHeader
            label="Subgrupos"
            count={filters.subcategoryIds.length}
            onClear={() => set("subcategoryIds", [])}
          />
          <div className="flex max-h-44 flex-col gap-1.5 overflow-y-auto">
            {(() => {
              const groups = new Map<string, typeof visibleSubcategories>();
              for (const sub of visibleSubcategories) {
                const list = groups.get(sub.parentId) ?? [];
                list.push(sub);
                groups.set(sub.parentId, list);
              }
              const showGroupHeaders = groups.size > 1;
              return [...groups.entries()].map(([parentId, subs]) => (
                <div key={parentId} className="flex flex-col gap-1.5">
                  {showGroupHeaders && (
                    <p className="mt-1 text-[11px] font-medium text-(--color-text-muted) first:mt-0">
                      {parentCategoryName.get(parentId) ?? "Outro grupo"}
                    </p>
                  )}
                  {subs.map((sub) => (
                    <FilterCheckboxRow
                      key={sub.id}
                      id={sub.id}
                      name={sub.name}
                      color={sub.color}
                      checked={filters.subcategoryIds.includes(sub.id)}
                      onToggle={toggleSubcategory}
                    />
                  ))}
                </div>
              ));
            })()}
          </div>
        </div>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-col gap-2">
          <FilterSectionHeader label="Tags" count={filters.tagIds.length} onClear={() => set("tagIds", [])} />
          <div className="flex max-h-44 flex-col gap-1.5 overflow-y-auto">
            {tags.map((tag) => (
              <FilterCheckboxRow
                key={tag.id}
                id={tag.id}
                name={tag.name}
                checked={filters.tagIds.includes(tag.id)}
                onToggle={toggleTag}
              />
            ))}
          </div>
        </div>
      )}

      {/* Agrupar por */}
      <div className="flex flex-col gap-2">
        <SectionLabel>Agrupar por</SectionLabel>
        <div className="flex gap-1.5">
          {(["category", "month"] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => set("groupBy", g)}
              className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-all ${
                filters.groupBy === g
                  ? "bg-(--color-primary) text-white"
                  : "border border-(--color-border) text-(--color-text-muted) hover:border-(--color-primary)/40"
              }`}
            >
              {g === "category" ? "Por grupo" : "Por mês"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
