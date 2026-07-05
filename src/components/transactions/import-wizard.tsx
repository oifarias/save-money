"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Download,
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  ClipboardList,
  Trash2,
  Pencil,
  Repeat,
  Lock,
  TrendingUp,
  Tag,
  Layers,
  Hash,
  Target,
  ShoppingCart,
  BarChart2,
  ArrowLeftRight,
  ArrowRight,
  Eye,
} from "lucide-react";
import toast from "react-hot-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { importRowSchema, IMPORT_FIELDS, type ImportFieldKey } from "@/lib/validations/import";
import type { MappedRow } from "@/lib/import-helpers";
import {
  normalizeInstallments,
  normalizeFixedFlag,
  normalizeTags,
  summarizeMappedRows,
  buildMappedRows,
  guessColumnMapping,
  NONE_COLUMN,
  type ParsedSheet,
  type ExistingCategoryRef,
} from "@/lib/import-helpers";
import { formatCurrency } from "@/lib/format";
import { importTransactionsAction } from "@/app/(app)/lancamentos/import-actions";
import { SummaryCard, CARD_COLORS } from "@/components/dashboard/summary-cards";

type Step = "upload" | "map" | "result";

type ExistingTransactionDetail = {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: "EXPENSE" | "INCOME";
  category: { name: string; color: string; icon: string } | null;
  subcategory: { name: string } | null;
  tags: string[];
  installmentNumber: number | null;
  installmentTotal: number | null;
};

type DuplicateMatch = {
  importedRowIndex: number;
  importedDescription: string;
  importedDate: string;
  importedAmount: number;
  importedType: "EXPENSE" | "INCOME";
  importedInstallments: string | null;
  existing: ExistingTransactionDetail;
};

const NONE = NONE_COLUMN;
const REQUIRED_FIELDS = IMPORT_FIELDS.filter((field) => field.required);
const PAGE_SIZE = 25;

type EditableField = "category" | "subcategory" | "tags" | "installments" | "isFixed";
type RowFilter = "all" | "valid" | "invalid";
type BulkEditType = "category" | "subcategory" | "tags";

type BulkEditItem = {
  key: string;
  originalName: string;
  parentCategory?: string;
  draft: string;
  isNew: boolean;
  rowCount: number;
};

function selectClass() {
  return "rounded-xl border border-(--color-border) bg-(--color-surface) px-3.5 py-2.5 text-sm text-(--color-text) outline-none transition-colors focus:border-(--color-primary) focus:ring-2 focus:ring-(--color-primary)/20";
}

function SummaryStat({
  label,
  value,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: string;
  tone?: "success" | "danger";
  active?: boolean;
  onClick?: () => void;
}) {
  const toneClass =
    tone === "success" ? "text-(--color-success)" : tone === "danger" ? "text-(--color-danger)" : "text-(--color-text)";

  const baseClass = "flex flex-col gap-1 rounded-xl border bg-(--color-bg) px-3.5 py-3 text-left transition-colors";
  const borderClass = active
    ? "border-(--color-primary) ring-2 ring-(--color-primary)/20"
    : "border-(--color-border)";

  if (!onClick) {
    return (
      <div className={`${baseClass} ${borderClass}`}>
        <span className="text-xs text-(--color-text-muted)">{label}</span>
        <span className={`font-numeric text-base font-semibold ${toneClass}`}>{value}</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${baseClass} ${borderClass} cursor-pointer hover:border-(--color-primary)`}
    >
      <span className="text-xs text-(--color-text-muted)">{label}</span>
      <span className={`font-numeric text-base font-semibold ${toneClass}`}>{value}</span>
    </button>
  );
}

function EditableCellInput({
  value,
  onConfirm,
  onCancel,
}: {
  value: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(value);

  return (
    <Input
      autoFocus
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => onConfirm(draft)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          onConfirm(draft);
        }
        if (event.key === "Escape") {
          event.preventDefault();
          onCancel();
        }
      }}
      className="px-2 py-1 text-sm"
    />
  );
}

function EditableCell({
  value,
  isEditing,
  onStartEdit,
  onConfirm,
  onCancel,
}: {
  value: string;
  isEditing: boolean;
  onStartEdit: () => void;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}) {
  if (isEditing) {
    return <EditableCellInput value={value} onConfirm={onConfirm} onCancel={onCancel} />;
  }

  return (
    <button
      type="button"
      onClick={onStartEdit}
      className="group inline-flex w-full items-center gap-1.5 rounded-lg px-1.5 py-1 text-left hover:bg-(--color-bg) cursor-pointer"
    >
      <span>{value || "—"}</span>
      <Pencil
        size={12}
        className="text-(--color-text-muted) opacity-0 transition-opacity group-hover:opacity-100"
        aria-hidden="true"
      />
    </button>
  );
}

function BulkEditModalContent({
  bulkEditModal,
  updateBulkEditDraft,
  saveBulkEdit,
  onClose,
}: {
  bulkEditModal: { type: BulkEditType; items: BulkEditItem[] };
  updateBulkEditDraft: (key: string, draft: string) => void;
  saveBulkEdit: () => void;
  onClose: () => void;
}) {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [inputDraft, setInputDraft] = useState("");

  function startEdit(key: string, currentDraft: string) {
    setEditingKey(key);
    setInputDraft(currentDraft);
  }

  function confirmEdit() {
    if (!editingKey) return;
    if (inputDraft.trim()) {
      updateBulkEditDraft(editingKey, inputDraft.trim());
    }
    setEditingKey(null);
  }

  function cancelEdit() {
    setEditingKey(null);
  }

  const groupedItems = useMemo(() => {
    if (bulkEditModal.type !== "subcategory") {
      return [{ groupLabel: null as string | null, items: bulkEditModal.items }];
    }
    const groups = new Map<string, BulkEditItem[]>();
    for (const item of bulkEditModal.items) {
      const key = item.parentCategory ?? "";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }
    return Array.from(groups.entries()).map(([label, groupItems]) => ({
      groupLabel: label as string | null,
      items: groupItems,
    }));
  }, [bulkEditModal]);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-(--color-text-muted)">
        Duplo clique em um item para renomear. Ao salvar, todas as linhas que usam cada valor serão atualizadas automaticamente.
      </p>

      {bulkEditModal.items.length === 0 ? (
        <p className="py-6 text-center text-sm text-(--color-text-muted)">
          Nenhum valor encontrado no arquivo.
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          {groupedItems.map(({ groupLabel, items }) => (
            <div key={groupLabel ?? "__root__"} className="flex flex-col gap-2">
              {groupLabel && (
                <p className="text-xs font-medium uppercase tracking-wide text-(--color-text-muted)">
                  {groupLabel}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {items.map((item) => {
                  const isEditing = editingKey === item.key;
                  const isModified = item.draft !== item.originalName;

                  if (isEditing) {
                    return (
                      <input
                        key={item.key}
                        autoFocus
                        value={inputDraft}
                        onChange={(e) => setInputDraft(e.target.value)}
                        onBlur={confirmEdit}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            confirmEdit();
                          }
                          if (e.key === "Escape") {
                            e.preventDefault();
                            cancelEdit();
                          }
                        }}
                        className="rounded-full border border-(--color-primary) bg-(--color-surface) px-3 py-1 text-sm text-(--color-text) outline-none ring-2 ring-(--color-primary)/20"
                        style={{ width: `${Math.max(inputDraft.length + 4, 10)}ch` }}
                      />
                    );
                  }

                  return (
                    <button
                      key={item.key}
                      type="button"
                      title="Duplo clique para editar"
                      onDoubleClick={() => startEdit(item.key, item.draft)}
                      className={[
                        "inline-flex cursor-pointer select-none items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors",
                        item.isNew
                          ? isModified
                            ? "border-(--color-primary) bg-(--color-primary)/10 text-(--color-primary)"
                            : "border-(--color-primary)/30 bg-(--color-primary)/10 text-(--color-primary)"
                          : isModified
                            ? "border-(--color-primary) bg-(--color-bg) text-(--color-text)"
                            : "border-(--color-border) bg-(--color-bg) text-(--color-text)",
                      ].join(" ")}
                    >
                      <span>{item.draft}</span>
                      <span className={`text-xs ${item.isNew ? "opacity-70" : "text-(--color-text-muted)"}`}>
                        · {item.rowCount}
                      </span>
                      {isModified && (
                        <Pencil
                          size={11}
                          className={item.isNew ? "opacity-60" : "text-(--color-text-muted)"}
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end gap-3 border-t border-(--color-border) pt-4">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="button" onClick={saveBulkEdit} disabled={bulkEditModal.items.length === 0}>
          Salvar alterações
        </Button>
      </div>
    </div>
  );
}

function DuplicateDetailRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="w-20 shrink-0 text-xs text-(--color-text-muted)">{label}</dt>
      <dd className={`text-sm text-(--color-text) ${highlight ? "font-numeric font-semibold" : "font-medium"}`}>
        {value}
      </dd>
    </div>
  );
}

function DuplicateMatchCard({
  match,
  isForced,
  onToggleForce,
}: {
  match: DuplicateMatch;
  isForced: boolean;
  onToggleForce: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-(--color-border)">
      <div className="flex items-center justify-between bg-(--color-bg) px-4 py-2.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-(--color-text-muted)">
          Linha {match.importedRowIndex + 1} da planilha
        </span>
        <button
          type="button"
          onClick={onToggleForce}
          className={`cursor-pointer text-xs font-medium underline hover:no-underline ${
            isForced ? "text-(--color-text-muted)" : "text-(--color-primary)"
          }`}
        >
          {isForced ? "Não importar esta linha" : "Importar mesmo assim"}
        </button>
      </div>
      <div className="grid grid-cols-2 divide-x divide-(--color-border)">
        <div className="bg-orange-50/60 p-4">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-wide text-orange-600">Da planilha</p>
          <dl className="flex flex-col gap-2">
            <DuplicateDetailRow label="Descrição" value={match.importedDescription || "—"} />
            <DuplicateDetailRow label="Data" value={match.importedDate.split("-").reverse().join("/")} />
            <DuplicateDetailRow label="Valor" value={formatCurrency(match.importedAmount)} highlight />
            <DuplicateDetailRow label="Tipo" value={match.importedType === "EXPENSE" ? "Despesa" : "Entrada"} />
            {match.importedInstallments && (
              <DuplicateDetailRow label="Parcela" value={match.importedInstallments} />
            )}
          </dl>
        </div>
        <div className="p-4">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-wide text-(--color-text-muted)">Já existe na base</p>
          <dl className="flex flex-col gap-2">
            <DuplicateDetailRow label="Descrição" value={match.existing.description || "—"} />
            <DuplicateDetailRow label="Data" value={match.existing.date.split("-").reverse().join("/")} />
            <DuplicateDetailRow label="Valor" value={formatCurrency(match.existing.amount)} highlight />
            <DuplicateDetailRow label="Grupo" value={match.existing.category?.name ?? "—"} />
            <DuplicateDetailRow label="Subgrupo" value={match.existing.subcategory?.name ?? "—"} />
            <DuplicateDetailRow
              label="Tags"
              value={match.existing.tags.length > 0 ? match.existing.tags.join(", ") : "—"}
            />
            {match.existing.installmentNumber !== null && (
              <DuplicateDetailRow
                label="Parcela"
                value={`${match.existing.installmentNumber}/${match.existing.installmentTotal ?? "?"}`}
              />
            )}
          </dl>
        </div>
      </div>
    </div>
  );
}

type ImportWizardProps = {
  existingCategories: ExistingCategoryRef[];
  existingTagNames?: string[];
};

export function ImportWizard({ existingCategories, existingTagNames = [] }: ImportWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [mapping, setMapping] = useState<Record<ImportFieldKey, string>>({
    date: NONE,
    description: NONE,
    amount: NONE,
    type: NONE,
    category: NONE,
    subcategory: NONE,
    tags: NONE,
    installments: NONE,
    isFixed: NONE,
    creditCard: NONE,
  });
  const [isParsing, setIsParsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number; duplicatesSkipped: number } | null>(null);
  const [duplicateIndices, setDuplicateIndices] = useState<Set<number>>(new Set());
  const [forcedIndices, setForcedIndices] = useState<Set<number>>(new Set());
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateMatch[]>([]);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [showDuplicatesModal, setShowDuplicatesModal] = useState(false);
  const [modalFilterIndex, setModalFilterIndex] = useState<number | null>(null);
  const [duplicatesPage, setDuplicatesPage] = useState(1);
  const [isMappingExpanded, setIsMappingExpanded] = useState(false);
  const [overrides, setOverrides] = useState<Record<number, Partial<Pick<MappedRow, EditableField>>>>({});
  const [removedIndexes, setRemovedIndexes] = useState<Set<number>>(new Set());
  const [rowFilter, setRowFilter] = useState<RowFilter>("all");
  const [page, setPage] = useState(1);
  const [editingCell, setEditingCell] = useState<{ index: number; field: EditableField } | null>(null);
  const [sortField, setSortField] = useState<keyof MappedRow | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [bulkEditModal, setBulkEditModal] = useState<{ type: BulkEditType; items: BulkEditItem[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const rawMappedRows = useMemo(() => {
    if (!sheet) return [];
    return buildMappedRows(sheet, mapping);
  }, [sheet, mapping]);

  // Aplica overrides de edição inline por linha e revalida, depois remove as linhas excluídas pelo usuário.
  const mappedRows = useMemo(() => {
    return rawMappedRows
      .filter((row) => !removedIndexes.has(row.index))
      .map((row) => {
        const override = overrides[row.index];
        if (!override) return row;

        const candidate = { ...row, ...override };
        const parsed = importRowSchema.safeParse(candidate);
        const error = parsed.success ? undefined : parsed.error.issues[0]?.message;

        return { ...candidate, error };
      });
  }, [rawMappedRows, overrides, removedIndexes]);

  const validRows = mappedRows.filter((row) => !row.error);
  const invalidRows = mappedRows.filter((row) => row.error);
  const isMappingComplete = REQUIRED_FIELDS.every((field) => mapping[field.key] !== NONE);

  const summary = useMemo(
    () => summarizeMappedRows(mappedRows, existingCategories, existingTagNames),
    [mappedRows, existingCategories, existingTagNames]
  );

  const filteredRows = useMemo(() => {
    if (rowFilter === "valid") return mappedRows.filter((row) => !row.error);
    if (rowFilter === "invalid") return mappedRows.filter((row) => row.error);
    return mappedRows;
  }, [mappedRows, rowFilter]);

  const nonDuplicateValidCount = useMemo(
    () =>
      validRows.filter((row) => {
        const isDuplicate = duplicateIndices.has(row.index);
        const isForced = forcedIndices.has(row.index);
        return !isDuplicate || isForced;
      }).length,
    [validRows, duplicateIndices, forcedIndices]
  );

  const sortedRows = useMemo(() => {
    if (!sortField) return filteredRows;
    return [...filteredRows].sort((a, b) => {
      const aVal = a[sortField] ?? "";
      const bVal = b[sortField] ?? "";
      const cmp =
        sortField === "amount"
          ? Number(aVal) - Number(bVal)
          : String(aVal).localeCompare(String(bVal), "pt-BR", { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filteredRows, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedRows = useMemo(
    () => sortedRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [sortedRows, currentPage]
  );

  function toggleFilter(filter: RowFilter) {
    setRowFilter((current) => (current === filter ? "all" : filter));
    setPage(1);
  }

  function toggleSort(field: keyof MappedRow) {
    if (sortField === field) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
    setPage(1);
  }

  function openBulkEditModal(type: BulkEditType) {
    const existingRootNames = new Set(
      existingCategories.filter((c) => !c.parentName).map((c) => c.name.toLowerCase())
    );
    const existingSubKeys = new Set(
      existingCategories
        .filter((c) => c.parentName)
        .map((c) => `${c.parentName!.toLowerCase()}::${c.name.toLowerCase()}`)
    );
    const existingTagSet = new Set(existingTagNames.map((t) => t.toLowerCase()));

    let items: BulkEditItem[] = [];

    if (type === "category") {
      const map = new Map<string, { count: number; isNew: boolean }>();
      for (const row of mappedRows) {
        const cat = row.category.trim();
        if (!cat) continue;
        const prev = map.get(cat) ?? { count: 0, isNew: !existingRootNames.has(cat.toLowerCase()) };
        map.set(cat, { ...prev, count: prev.count + 1 });
      }
      items = Array.from(map.entries())
        .sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
        .map(([name, { count, isNew }]) => ({ key: name, originalName: name, draft: name, isNew, rowCount: count }));
    } else if (type === "subcategory") {
      const map = new Map<string, { category: string; name: string; count: number; isNew: boolean }>();
      for (const row of mappedRows) {
        const cat = row.category.trim();
        const sub = row.subcategory.trim();
        if (!sub || !cat) continue;
        const key = `${cat}::${sub}`;
        const prev = map.get(key) ?? {
          category: cat,
          name: sub,
          count: 0,
          isNew: !existingSubKeys.has(`${cat.toLowerCase()}::${sub.toLowerCase()}`),
        };
        map.set(key, { ...prev, count: prev.count + 1 });
      }
      items = Array.from(map.entries())
        .sort(([, av], [, bv]) => av.category.localeCompare(bv.category, "pt-BR") || av.name.localeCompare(bv.name, "pt-BR"))
        .map(([key, { category, name, count, isNew }]) => ({ key, originalName: name, parentCategory: category, draft: name, isNew, rowCount: count }));
    } else {
      const map = new Map<string, { count: number; isNew: boolean }>();
      for (const row of mappedRows) {
        for (const tag of normalizeTags(row.tags)) {
          const prev = map.get(tag) ?? { count: 0, isNew: !existingTagSet.has(tag.toLowerCase()) };
          map.set(tag, { ...prev, count: prev.count + 1 });
        }
      }
      items = Array.from(map.entries())
        .sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
        .map(([name, { count, isNew }]) => ({ key: name, originalName: name, draft: name, isNew, rowCount: count }));
    }

    setBulkEditModal({ type, items });
  }

  function updateBulkEditDraft(key: string, draft: string) {
    setBulkEditModal((current) => {
      if (!current) return null;
      return { ...current, items: current.items.map((item) => (item.key === key ? { ...item, draft } : item)) };
    });
  }

  function saveBulkEdit() {
    if (!bulkEditModal) return;
    const changed = bulkEditModal.items.filter((item) => item.draft.trim() && item.draft.trim() !== item.originalName);

    if (changed.length === 0) {
      setBulkEditModal(null);
      return;
    }

    const newOverrides = { ...overrides };
    let totalUpdated = 0;

    for (const item of changed) {
      const newValue = item.draft.trim();
      if (bulkEditModal.type === "category") {
        for (const row of mappedRows) {
          if (row.category.trim() === item.originalName) {
            newOverrides[row.index] = { ...newOverrides[row.index], category: newValue };
            totalUpdated++;
          }
        }
      } else if (bulkEditModal.type === "subcategory") {
        for (const row of mappedRows) {
          if (row.category.trim() === item.parentCategory && row.subcategory.trim() === item.originalName) {
            newOverrides[row.index] = { ...newOverrides[row.index], subcategory: newValue };
            totalUpdated++;
          }
        }
      } else {
        for (const row of mappedRows) {
          const tags = normalizeTags(row.tags);
          if (tags.includes(item.originalName)) {
            const updatedTags = tags.map((t) => (t === item.originalName ? newValue : t)).join(", ");
            newOverrides[row.index] = { ...newOverrides[row.index], tags: updatedTags };
            totalUpdated++;
          }
        }
      }
    }

    setOverrides(newOverrides);
    setBulkEditModal(null);
    toast.success(`${totalUpdated} linha${totalUpdated === 1 ? "" : "s"} atualizada${totalUpdated === 1 ? "" : "s"}`);
  }

  function handleRemoveRow(index: number) {
    setRemovedIndexes((current) => {
      const next = new Set(current);
      next.add(index);
      return next;
    });
  }

  function handleEditField(index: number, field: EditableField, value: string) {
    setOverrides((current) => ({
      ...current,
      [index]: { ...current[index], [field]: value },
    }));
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/import/parse", { method: "POST", body: formData });
      const json = await response.json();

      if (!response.ok || !json.success) {
        toast.error(json.message ?? "Não foi possível ler esse arquivo. Verifique se é um .xlsx ou .xls válido");
        return;
      }

      const parsed: ParsedSheet = json.data;

      if (parsed.headers.length === 0 || parsed.rows.length === 0) {
        toast.error("Não encontramos dados nessa planilha");
        return;
      }

      if (json.truncated) {
        toast.error(`A planilha tem mais de 1000 linhas. Apenas as primeiras 1000 serão importadas.`);
      }

      const guessedMapping = guessColumnMapping(parsed.headers);
      const allFieldsGuessed = IMPORT_FIELDS.every((field) => guessedMapping[field.key] !== NONE);

      // Pré-computar as linhas mapeadas para passar à verificação de duplicatas
      // antes que os estados sejam atualizados no próximo ciclo de render.
      const initialMappedRows = buildMappedRows(parsed, guessedMapping);

      setSheet(parsed);
      setMapping(guessedMapping);
      setFileName(file.name);
      setIsMappingExpanded(!allFieldsGuessed);
      setOverrides({});
      setRemovedIndexes(new Set());
      setRowFilter("all");
      setEditingCell(null);
      setPage(1);
      setDuplicateIndices(new Set());
      setForcedIndices(new Set());
      setDuplicateMatches([]);
      setShowDuplicatesModal(false);
      setModalFilterIndex(null);
      setStep("map");

      // Verificar duplicatas com as linhas iniciais
      void checkForDuplicates(initialMappedRows);
    } catch {
      toast.error("Não foi possível ler esse arquivo. Verifique se é um .xlsx ou .xls válido");
    } finally {
      setIsParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleConfirmImport() {
    const rowsToImport = validRows.filter((row) => {
      const isDuplicate = duplicateIndices.has(row.index);
      const isForced = forcedIndices.has(row.index);
      return !isDuplicate || isForced;
    });

    if (rowsToImport.length === 0) {
      if (duplicateIndices.size > 0) {
        toast.error("Todas as linhas foram identificadas como duplicatas. Marque as que deseja importar mesmo assim.");
      } else {
        toast.error("Nenhuma linha válida para importar");
      }
      return;
    }

    const userExcludedDuplicates = [...duplicateIndices].filter((idx) => !forcedIndices.has(idx)).length;

    setIsSubmitting(true);
    try {
      const response = await importTransactionsAction(
        rowsToImport.map(({ date, description, amount, type, category, subcategory, tags, installments, isFixed, creditCard }) => ({
          date,
          description,
          amount,
          type,
          category,
          subcategory,
          tags,
          installments,
          isFixed,
          creditCard: creditCard ?? "",
        }))
      );

      if (!response.success) {
        toast.error(response.message ?? "Não foi possível importar");
        return;
      }

      setResult({
        imported: response.imported ?? 0,
        skipped: (response.skipped ?? 0) + invalidRows.length,
        duplicatesSkipped: userExcludedDuplicates + (response.duplicatesSkipped ?? 0),
      });
      setStep("result");
      toast.success(response.message ?? "Importação concluída");
    } catch {
      toast.error("Não foi possível importar os lançamentos. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function checkForDuplicates(rows: MappedRow[]) {
    const validRowsToCheck = rows.filter((r) => !r.error);
    if (validRowsToCheck.length === 0) {
      setDuplicateIndices(new Set());
      setDuplicateMatches([]);
      return;
    }

    setCheckingDuplicates(true);
    try {
      const payload = validRowsToCheck.map((r) => ({
        date: r.date ?? "",
        amount: Number(r.amount ?? 0),
        type: (r.type === "INCOME" ? "INCOME" : "EXPENSE") as "EXPENSE" | "INCOME",
        description: r.description ?? "",
        installments: r.installments || undefined,
      }));

      const res = await fetch("/api/import/check-duplicates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: payload }),
      });

      if (!res.ok) return;

      const data = (await res.json()) as {
        duplicateIndices: number[];
        matches: DuplicateMatch[];
      };

      // Converter índices relativos ao array de válidas → row.index (spreadsheet index)
      const dupSet = new Set<number>(
        data.duplicateIndices.map((relIdx) => validRowsToCheck[relIdx]!.index)
      );

      const matchesWithRowIndex = data.matches.map((m) => ({
        ...m,
        importedRowIndex: validRowsToCheck[m.importedRowIndex]!.index,
      }));

      setDuplicateIndices(dupSet);
      setDuplicateMatches(matchesWithRowIndex);
      setForcedIndices(new Set());
    } catch {
      // falha silenciosa — o backend ainda filtra duplicatas na Fase 0.7
    } finally {
      setCheckingDuplicates(false);
    }
  }

  function handleReset() {
    setStep("upload");
    setSheet(null);
    setFileName("");
    setMapping({
      date: NONE,
      description: NONE,
      amount: NONE,
      type: NONE,
      category: NONE,
      subcategory: NONE,
      tags: NONE,
      installments: NONE,
      isFixed: NONE,
      creditCard: NONE,
    });
    setResult(null);
    setIsMappingExpanded(false);
    setOverrides({});
    setRemovedIndexes(new Set());
    setRowFilter("all");
    setPage(1);
    setEditingCell(null);
    setDuplicateIndices(new Set());
    setForcedIndices(new Set());
    setDuplicateMatches([]);
    setCheckingDuplicates(false);
    setShowDuplicatesModal(false);
    setModalFilterIndex(null);
    setDuplicatesPage(1);
  }

  return (
    <div className="flex flex-col gap-5">
      <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-base font-semibold text-(--color-text)">Arquivo modelo</h2>
          <p className="mt-0.5 text-sm text-(--color-text-muted)">
            Baixe a planilha de exemplo com as colunas esperadas: Data, Tipo, Transação, Categoria, Sub-categoria, Valor, Tags, Parcelas (x/y) e Fixa
          </p>
        </div>
        <a href="/api/import/template" download>
          <Button type="button" variant="secondary">
            <Download size={16} aria-hidden="true" />
            Baixar modelo .xlsx
          </Button>
        </a>
      </Card>

      {step === "upload" && (
        <Card className="flex flex-col items-center justify-center gap-4 py-14 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-(--color-primary)/10 text-(--color-primary)">
            <FileSpreadsheet size={28} aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold text-(--color-text)">Envie sua planilha</h2>
            <p className="mt-1 text-sm text-(--color-text-muted)">Arquivos .xlsx ou .xls com seus lançamentos</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            id="import-file-input"
            onChange={handleFileChange}
          />
          <Button type="button" isLoading={isParsing} onClick={() => fileInputRef.current?.click()}>
            <Upload size={16} aria-hidden="true" />
            Selecionar arquivo
          </Button>
        </Card>
      )}

      {step === "map" && sheet && (
        <>
          <Card className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-display text-base font-semibold text-(--color-text)">Mapeamento de colunas</h2>
                <p className="mt-0.5 truncate text-xs text-(--color-text-muted)">
                  {fileName} · {sheet.rows.length} linha(s) encontrada(s)
                  {!isMappingExpanded && isMappingComplete && " · detectado automaticamente"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {isMappingComplete && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setIsMappingExpanded((current) => !current)}
                  >
                    {isMappingExpanded ? (
                      <>
                        <ChevronUp size={16} aria-hidden="true" />
                        Recolher
                      </>
                    ) : (
                      <>
                        <ChevronDown size={16} aria-hidden="true" />
                        Revisar colunas
                      </>
                    )}
                  </Button>
                )}
                <Button type="button" variant="ghost" onClick={handleReset}>
                  Trocar arquivo
                </Button>
              </div>
            </div>

            {(isMappingExpanded || !isMappingComplete) && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {IMPORT_FIELDS.map((field) => (
                  <div key={field.key} className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-(--color-text)" htmlFor={`map-${field.key}`}>
                      {field.label}
                      {!field.required && <span className="text-(--color-text-muted)"> (opcional)</span>}
                    </label>
                    <select
                      id={`map-${field.key}`}
                      className={selectClass()}
                      value={mapping[field.key]}
                      onChange={(event) => setMapping((current) => ({ ...current, [field.key]: event.target.value }))}
                    >
                      <option value={NONE}>{field.required ? "Selecione a coluna…" : "Não importar"}</option>
                      {sheet.headers.map((header) => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}

            {(isMappingExpanded || !isMappingComplete) && (
              <div className="flex flex-col gap-1.5 rounded-xl border border-(--color-border) bg-(--color-bg) px-3.5 py-3 text-xs text-(--color-text-muted)">
                <p className="flex items-start gap-1.5">
                  <Repeat size={14} className="mt-0.5 shrink-0 text-(--color-primary)" aria-hidden="true" />
                  <span>
                    <strong className="text-(--color-text)">Parcelas (x/y):</strong> preencha como x/y (ex.: 3/12)
                    para indicar que essa linha é a parcela x de um total de y — o sistema gera automaticamente as
                    parcelas restantes (x+1 até y) nos meses seguintes, com o mesmo valor da linha.
                  </span>
                </p>
                <p className="flex items-start gap-1.5">
                  <Lock size={14} className="mt-0.5 shrink-0 text-(--color-primary)" aria-hidden="true" />
                  <span>
                    <strong className="text-(--color-text)">Fixa:</strong> marque como sim/x/true para indicar
                    que é um lançamento fixo — despesa fixa (ex.: aluguel) ou entrada fixa (ex.: salário).
                  </span>
                </p>
              </div>
            )}
          </Card>

          {isMappingComplete && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 md:grid-cols-5">
              <SummaryCard
                title="Linhas"
                icon={ClipboardList}
                classes={CARD_COLORS.blue}
                total={String(summary.totalRows)}
                left={{ label: `Válidas (${summary.validCount})`, value: String(summary.validCount) }}
                right={{ label: `Erro (${summary.invalidCount})`, value: String(summary.invalidCount) }}
              />
              <SummaryCard
                title="Saldo"
                icon={TrendingUp}
                classes={summary.balance >= 0 ? CARD_COLORS.success : CARD_COLORS.danger}
                total={summary.balance}
                left={{ label: "Entradas", value: summary.totalIncome }}
                right={{ label: "Despesas", value: summary.totalExpense }}
              />
              <button type="button" onClick={() => openBulkEditModal("category")} className="w-full text-left cursor-pointer">
                <SummaryCard
                  title="Categorias"
                  icon={Tag}
                  classes={CARD_COLORS.accent}
                  total={String(summary.newCategoriesCount + summary.existingCategoriesCount)}
                  left={{ label: `Novas (${summary.newCategoriesCount})`, value: String(summary.newCategoriesCount) }}
                  right={{ label: `Existentes (${summary.existingCategoriesCount})`, value: String(summary.existingCategoriesCount) }}
                />
              </button>
              <button type="button" onClick={() => openBulkEditModal("subcategory")} className="w-full text-left cursor-pointer">
                <SummaryCard
                  title="Sub-categorias"
                  icon={Layers}
                  classes={CARD_COLORS.blue}
                  total={String(summary.newSubcategoriesCount + summary.existingSubcategoriesCount)}
                  left={{ label: `Novas (${summary.newSubcategoriesCount})`, value: String(summary.newSubcategoriesCount) }}
                  right={{ label: `Existentes (${summary.existingSubcategoriesCount})`, value: String(summary.existingSubcategoriesCount) }}
                />
              </button>
              <button type="button" onClick={() => openBulkEditModal("tags")} className="w-full text-left cursor-pointer">
                <SummaryCard
                  title="Tags"
                  icon={Hash}
                  classes={CARD_COLORS.accent}
                  total={String(summary.tagsCount)}
                  left={{ label: `Novas (${summary.newTagsCount})`, value: String(summary.newTagsCount) }}
                  right={{ label: `Existentes (${summary.existingTagsCount})`, value: String(summary.existingTagsCount) }}
                />
              </button>
            </div>
          )}

          {isMappingComplete && (
            <Card className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-base font-semibold text-(--color-text)">Pré-visualização</h2>
                  <p className="mt-0.5 text-xs text-(--color-text-muted)">
                    <span className="text-(--color-success)">{validRows.length} válida(s)</span>
                    {invalidRows.length > 0 && (
                      <>
                        {" · "}
                        <span className="text-(--color-danger)">{invalidRows.length} com erro</span>
                      </>
                    )}
                    {removedIndexes.size > 0 && ` · ${removedIndexes.size} removida(s)`}
                  </p>
                  {rowFilter !== "all" && (
                    <p className="mt-1 flex items-center gap-2 text-xs text-(--color-text-muted)">
                      Filtro ativo: {rowFilter === "valid" ? "somente válidas" : "somente com erro"}
                      <button
                        type="button"
                        onClick={() => setRowFilter("all")}
                        className="text-(--color-primary) underline-offset-2 hover:underline cursor-pointer"
                      >
                        Limpar filtro
                      </button>
                    </p>
                  )}
                </div>
                <Button type="button" onClick={handleConfirmImport} isLoading={isSubmitting} disabled={nonDuplicateValidCount === 0 && !isSubmitting}>
                  <CheckCircle2 size={16} aria-hidden="true" />
                  Importar {nonDuplicateValidCount} lançamento(s)
                </Button>
              </div>

              {isSubmitting && (
                <div className="flex items-center gap-2 rounded-xl border border-(--color-border) bg-(--color-bg) px-3.5 py-3 text-sm text-(--color-text-muted)">
                  <Loader2 size={15} className="animate-spin shrink-0 text-(--color-primary)" aria-hidden="true" />
                  <span>Importando {nonDuplicateValidCount} lançamento(s)… Isso pode levar alguns segundos para planilhas grandes.</span>
                </div>
              )}

              {checkingDuplicates && !isSubmitting && (
                <div className="flex items-center gap-2 rounded-xl border border-(--color-border) bg-(--color-bg) px-3.5 py-3 text-sm text-(--color-text-muted)">
                  <Loader2 size={15} className="animate-spin shrink-0 text-(--color-primary)" aria-hidden="true" />
                  <span>Verificando lançamentos duplicados…</span>
                </div>
              )}

              {!checkingDuplicates && !isSubmitting && duplicateIndices.size > 0 && (
                <div className="flex items-start gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0 text-orange-500" aria-hidden="true" />
                  <div className="flex-1 text-sm text-orange-800">
                    <strong>
                      {duplicateIndices.size} linha{duplicateIndices.size > 1 ? "s identificadas" : " identificada"} como possível duplicata.
                    </strong>{" "}
                    Por padrão não serão importadas. Revise os detalhes e marque as que deseja incluir mesmo assim.
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <button
                      type="button"
                      onClick={() => { setModalFilterIndex(null); setDuplicatesPage(1); setShowDuplicatesModal(true); }}
                      className="cursor-pointer text-xs font-medium text-orange-700 underline hover:no-underline"
                    >
                      Ver detalhes →
                    </button>
                    <button
                      type="button"
                      onClick={() => setForcedIndices(new Set(duplicateIndices))}
                      className="cursor-pointer text-xs text-orange-600 underline hover:no-underline"
                    >
                      Incluir todas
                    </button>
                  </div>
                </div>
              )}

              {validRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-(--color-danger)/10 text-(--color-danger)">
                    <AlertTriangle size={22} aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="font-display text-sm font-semibold text-(--color-text)">Nenhuma linha válida encontrada</h3>
                    <p className="mt-1 text-sm text-(--color-text-muted)">
                      Revise o mapeamento de colunas ou corrija a planilha antes de importar
                    </p>
                  </div>
                </div>
              ) : filteredRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-(--color-primary)/10 text-(--color-primary)">
                    <ClipboardList size={22} aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="font-display text-sm font-semibold text-(--color-text)">Nenhuma linha encontrada para esse filtro</h3>
                    <p className="mt-1 text-sm text-(--color-text-muted)">
                      <button
                        type="button"
                        onClick={() => setRowFilter("all")}
                        className="text-(--color-primary) underline-offset-2 hover:underline cursor-pointer"
                      >
                        Limpar filtro
                      </button>{" "}
                      para ver todas as linhas
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto rounded-xl border border-(--color-border)">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-(--color-border) bg-(--color-bg) text-xs uppercase tracking-wide text-(--color-text-muted)">
                          {(
                            [
                              { label: "Status", field: "error" as keyof MappedRow },
                              { label: "Data", field: "date" as keyof MappedRow },
                              { label: "Transação", field: "description" as keyof MappedRow },
                              { label: "Valor", field: "amount" as keyof MappedRow },
                              { label: "Tipo", field: "type" as keyof MappedRow },
                              { label: "Categoria", field: "category" as keyof MappedRow },
                              { label: "Sub-categoria", field: "subcategory" as keyof MappedRow },
                              { label: "Tags", field: "tags" as keyof MappedRow },
                              { label: "Parcelas", field: "installments" as keyof MappedRow },
                              { label: "Fixa", field: "isFixed" as keyof MappedRow },
                            ] as { label: string; field: keyof MappedRow }[]
                          ).map(({ label, field }) => (
                            <th key={field} scope="col" className="px-3 py-2">
                              <button
                                type="button"
                                onClick={() => toggleSort(field)}
                                className="inline-flex items-center gap-1 cursor-pointer hover:text-(--color-text) transition-colors"
                              >
                                {label}
                                {sortField === field ? (
                                  sortDir === "asc" ? (
                                    <ChevronUp size={12} aria-hidden="true" />
                                  ) : (
                                    <ChevronDown size={12} aria-hidden="true" />
                                  )
                                ) : (
                                  <ChevronsUpDown size={12} className="opacity-40" aria-hidden="true" />
                                )}
                              </button>
                            </th>
                          ))}
                          <th scope="col" className="px-3 py-2">
                            <span className="sr-only">Ações</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedRows.map((row) => {
                          const isDuplicate = duplicateIndices.has(row.index);
                          const isForced = forcedIndices.has(row.index);
                          return (
                          <tr key={row.index} className={`border-b border-(--color-border) last:border-0 ${isDuplicate && !isForced ? "opacity-60" : ""}`}>
                            <td className="px-3 py-2">
                              {row.error ? (
                                <span className="inline-flex items-center gap-1.5 text-xs text-(--color-danger)">
                                  <AlertTriangle size={14} aria-hidden="true" />
                                  {row.error}
                                </span>
                              ) : isDuplicate ? (
                                <div className="flex items-center gap-1.5">
                                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${isForced ? "bg-amber-100 text-amber-700" : "bg-orange-100 text-orange-700"}`}>
                                    {isForced ? "Incluir mesmo assim" : "Duplicata"}
                                  </span>
                                  <button
                                    type="button"
                                    title="Ver lançamento existente"
                                    aria-label="Ver lançamento existente"
                                    onClick={() => { setModalFilterIndex(row.index); setShowDuplicatesModal(true); }}
                                    className="inline-flex cursor-pointer items-center justify-center rounded p-0.5 text-orange-500 hover:bg-orange-100"
                                  >
                                    <Eye size={13} aria-hidden="true" />
                                  </button>
                                </div>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 text-xs text-(--color-success)">
                                  <CheckCircle2 size={14} aria-hidden="true" />
                                  OK
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 font-numeric text-(--color-text)">
                              {row.date ? row.date.split("-").reverse().join("/") : "—"}
                            </td>
                            <td className="px-3 py-2 text-(--color-text)">{row.description || "—"}</td>
                            <td className="px-3 py-2 font-numeric text-(--color-text)">
                              {row.amount ? formatCurrency(Number(row.amount)) : "—"}
                            </td>
                            <td className="px-3 py-2 text-(--color-text)">
                              {row.type === "EXPENSE" ? "Despesa" : row.type === "INCOME" ? "Entrada" : "—"}
                            </td>
                            <td className="px-3 py-2 text-(--color-text)">
                              <EditableCell
                                value={row.category}
                                isEditing={editingCell?.index === row.index && editingCell?.field === "category"}
                                onStartEdit={() => setEditingCell({ index: row.index, field: "category" })}
                                onConfirm={(value) => {
                                  handleEditField(row.index, "category", value);
                                  setEditingCell(null);
                                }}
                                onCancel={() => setEditingCell(null)}
                              />
                            </td>
                            <td className="px-3 py-2 text-(--color-text)">
                              <EditableCell
                                value={row.subcategory}
                                isEditing={editingCell?.index === row.index && editingCell?.field === "subcategory"}
                                onStartEdit={() => setEditingCell({ index: row.index, field: "subcategory" })}
                                onConfirm={(value) => {
                                  handleEditField(row.index, "subcategory", value);
                                  setEditingCell(null);
                                }}
                                onCancel={() => setEditingCell(null)}
                              />
                            </td>
                            <td className="px-3 py-2 text-(--color-text)">
                              <EditableCell
                                value={row.tags}
                                isEditing={editingCell?.index === row.index && editingCell?.field === "tags"}
                                onStartEdit={() => setEditingCell({ index: row.index, field: "tags" })}
                                onConfirm={(value) => {
                                  handleEditField(row.index, "tags", value);
                                  setEditingCell(null);
                                }}
                                onCancel={() => setEditingCell(null)}
                              />
                            </td>
                            <td className="px-3 py-2 text-(--color-text)">
                              <div className="flex items-center gap-1.5">
                                <EditableCell
                                  value={row.installments}
                                  isEditing={editingCell?.index === row.index && editingCell?.field === "installments"}
                                  onStartEdit={() => setEditingCell({ index: row.index, field: "installments" })}
                                  onConfirm={(value) => {
                                    handleEditField(row.index, "installments", value);
                                    setEditingCell(null);
                                  }}
                                  onCancel={() => setEditingCell(null)}
                                />
                                {(() => {
                                  const parsedInstallments = normalizeInstallments(row.installments);
                                  if (!parsedInstallments) return null;
                                  const future = parsedInstallments.total - parsedInstallments.current;
                                  if (future <= 0) return null;
                                  return (
                                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-(--color-primary)/10 px-2 py-0.5 text-xs font-medium text-(--color-primary)">
                                      <Repeat size={11} aria-hidden="true" />+{future}
                                    </span>
                                  );
                                })()}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-(--color-text)">
                              <div className="flex items-center gap-1.5">
                                <EditableCell
                                  value={row.isFixed}
                                  isEditing={editingCell?.index === row.index && editingCell?.field === "isFixed"}
                                  onStartEdit={() => setEditingCell({ index: row.index, field: "isFixed" })}
                                  onConfirm={(value) => {
                                    handleEditField(row.index, "isFixed", value);
                                    setEditingCell(null);
                                  }}
                                  onCancel={() => setEditingCell(null)}
                                />
                                {normalizeFixedFlag(row.isFixed) && (
                                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-(--color-primary)/10 px-2 py-0.5 text-xs font-medium text-(--color-primary)">
                                    <Lock size={11} aria-hidden="true" />
                                    Fixa
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1">
                                {isDuplicate && (
                                  <button
                                    type="button"
                                    title={isForced ? "Excluir da importação" : "Incluir mesmo assim"}
                                    aria-label={isForced ? "Excluir da importação" : "Incluir mesmo assim"}
                                    onClick={() => {
                                      setForcedIndices((prev) => {
                                        const next = new Set(prev);
                                        if (next.has(row.index)) next.delete(row.index);
                                        else next.add(row.index);
                                        return next;
                                      });
                                    }}
                                    className={`inline-flex cursor-pointer items-center justify-center rounded-lg p-1.5 transition-colors ${isForced ? "text-amber-500 hover:bg-amber-50" : "text-orange-500 hover:bg-orange-50"}`}
                                  >
                                    <CheckCircle2 size={15} aria-hidden="true" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleRemoveRow(row.index)}
                                  title="Remover linha"
                                  aria-label="Remover linha"
                                  className="inline-flex items-center justify-center rounded-lg p-1.5 text-(--color-text-muted) transition-colors hover:bg-(--color-danger)/10 hover:text-(--color-danger) cursor-pointer"
                                >
                                  <Trash2 size={15} aria-hidden="true" />
                                </button>
                              </div>
                            </td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {totalPages > 1 && (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setPage((current) => Math.max(1, current - 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft size={16} aria-hidden="true" />
                        Anterior
                      </Button>
                      <span className="text-xs text-(--color-text-muted)">
                        Página {currentPage} de {totalPages} · {filteredRows.length} linha(s)
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                        disabled={currentPage === totalPages}
                      >
                        Próxima
                        <ChevronRight size={16} aria-hidden="true" />
                      </Button>
                    </div>
                  )}
                </>
              )}
            </Card>
          )}
        </>
      )}

      {step === "result" && result && (
        <div className="flex flex-col gap-6">
          <Card className="flex flex-col items-center gap-4 py-10 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-(--color-success)/10 text-(--color-success)">
              <CheckCircle2 size={28} aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold text-(--color-text)">Importação concluída!</h2>
              <p className="mt-1 text-sm text-(--color-text-muted)">
                {result.imported} lançamento{result.imported !== 1 ? "s" : ""} importado{result.imported !== 1 ? "s" : ""} com sucesso
                {result.skipped > 0 && ` · ${result.skipped} ignorado${result.skipped !== 1 ? "s" : ""} por erro`}
                {result.duplicatesSkipped > 0 && ` · ${result.duplicatesSkipped} duplicata${result.duplicatesSkipped !== 1 ? "s" : ""} ignorada${result.duplicatesSkipped !== 1 ? "s" : ""}`}
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <Button type="button" variant="secondary" onClick={handleReset}>
                Importar outro arquivo
              </Button>
              <Button type="button" onClick={() => router.push("/lancamentos")}>
                Ver lançamentos
              </Button>
            </div>
          </Card>

          <div>
            <p className="mb-3 text-sm font-medium text-(--color-text-muted)">O que fazer agora?</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  href: "/dashboard",
                  icon: BarChart2,
                  title: "Acompanhar nos gráficos",
                  description: "Veja entradas, despesas e saldo do período nos painéis do dashboard.",
                  color: "text-blue-500",
                  bg: "bg-blue-500/10",
                },
                {
                  href: "/comparativo",
                  icon: ArrowLeftRight,
                  title: "Comparar meses",
                  description: "Compare dois períodos e veja como seus gastos evoluíram.",
                  color: "text-(--color-accent)",
                  bg: "bg-(--color-accent)/10",
                },
                {
                  href: "/metas",
                  icon: Target,
                  title: "Criar metas",
                  description: "Defina objetivos financeiros e acompanhe o progresso mês a mês.",
                  color: "text-(--color-success)",
                  bg: "bg-(--color-success)/10",
                },
                {
                  href: "/desejos",
                  icon: ShoppingCart,
                  title: "Lista de desejos",
                  description: "Organize compras planejadas e veja se cabem no seu orçamento.",
                  color: "text-(--color-primary)",
                  bg: "bg-(--color-primary)/10",
                },
              ].map(({ href, icon: Icon, title, description, color, bg }) => (
                <a
                  key={href}
                  href={href}
                  className="group flex flex-col gap-3 rounded-2xl border border-(--color-border) bg-(--color-surface) p-4 transition-shadow hover:shadow-md"
                >
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${bg} ${color}`}>
                    <Icon size={20} aria-hidden="true" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-(--color-text)">{title}</p>
                    <p className="mt-0.5 text-xs text-(--color-text-muted)">{description}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 text-xs font-medium ${color}`}>
                    Acessar
                    <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </span>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      {isParsing && step === "upload" && (
        <div className="flex items-center justify-center gap-2 text-sm text-(--color-text-muted)">
          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          Lendo planilha…
        </div>
      )}

      <Modal
        open={bulkEditModal !== null}
        title={
          bulkEditModal?.type === "category"
            ? "Editar categorias"
            : bulkEditModal?.type === "subcategory"
              ? "Editar sub-categorias"
              : "Editar tags"
        }
        onClose={() => setBulkEditModal(null)}
        size="lg"
      >
        {bulkEditModal && (
          <BulkEditModalContent
            bulkEditModal={bulkEditModal}
            updateBulkEditDraft={updateBulkEditDraft}
            saveBulkEdit={saveBulkEdit}
            onClose={() => setBulkEditModal(null)}
          />
        )}
      </Modal>

      {/* Modal geral: lista compacta de todas as duplicatas (paginada) */}
      <Modal
        open={showDuplicatesModal && modalFilterIndex === null}
        title={`Duplicatas encontradas (${duplicateMatches.length})`}
        onClose={() => setShowDuplicatesModal(false)}
        size="lg"
      >
        {(() => {
          const PAGE_SIZE = 5;
          const totalPages = Math.max(1, Math.ceil(duplicateMatches.length / PAGE_SIZE));
          const safePage = Math.min(duplicatesPage, totalPages);
          const pageItems = duplicateMatches.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

          return (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                {pageItems.map((match) => {
                  const isForced = forcedIndices.has(match.importedRowIndex);
                  return (
                    <div
                      key={match.existing.id}
                      className="flex items-center gap-3 rounded-xl border border-(--color-border) px-4 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-(--color-text)">
                          {match.importedDescription || "—"}
                        </p>
                        <p className="mt-0.5 text-xs text-(--color-text-muted)">
                          {match.importedDate.split("-").reverse().join("/")}
                          {" · "}
                          {formatCurrency(match.importedAmount)}
                          {" · "}
                          <span className="text-(--color-text)">
                            Existente: {match.existing.description}
                            {match.existing.category ? ` · ${match.existing.category.name}` : ""}
                          </span>
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            isForced ? "bg-amber-100 text-amber-700" : "bg-orange-100 text-orange-700"
                          }`}
                        >
                          {isForced ? "Incluir" : "Duplicata"}
                        </span>
                        <button
                          type="button"
                          onClick={() => setModalFilterIndex(match.importedRowIndex)}
                          className="cursor-pointer text-xs font-medium text-(--color-primary) underline hover:no-underline"
                        >
                          Ver detalhes
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setForcedIndices((prev) => {
                              const next = new Set(prev);
                              if (next.has(match.importedRowIndex)) next.delete(match.importedRowIndex);
                              else next.add(match.importedRowIndex);
                              return next;
                            })
                          }
                          className={`cursor-pointer text-xs underline hover:no-underline ${
                            isForced ? "text-(--color-text-muted)" : "text-orange-600"
                          }`}
                        >
                          {isForced ? "Cancelar" : "Importar mesmo assim"}
                        </button>
                      </div>
                    </div>
                  );
                })}
                {duplicateMatches.length === 0 && (
                  <p className="py-6 text-center text-sm text-(--color-text-muted)">Nenhuma duplicata encontrada.</p>
                )}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-(--color-border) pt-3">
                  <p className="text-xs text-(--color-text-muted)">
                    {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, duplicateMatches.length)} de {duplicateMatches.length}
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={safePage === 1}
                      onClick={() => setDuplicatesPage((p) => Math.max(1, p - 1))}
                      className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border border-(--color-border) text-xs text-(--color-text-muted) hover:bg-(--color-bg-subtle) disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      ‹
                    </button>
                    {(() => {
                      const pages = new Set([1, safePage - 1, safePage, safePage + 1, totalPages]);
                      const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
                      const items: React.ReactNode[] = [];
                      sorted.forEach((p, i) => {
                        if (i > 0 && p - sorted[i - 1] > 1) {
                          items.push(<span key={`ellipsis-${p}`} className="px-0.5 text-xs text-(--color-text-muted)">…</span>);
                        }
                        items.push(
                          <button
                            key={p}
                            type="button"
                            onClick={() => setDuplicatesPage(p)}
                            className={`flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-xs font-medium ${
                              p === safePage
                                ? "bg-(--color-primary) text-white"
                                : "border border-(--color-border) text-(--color-text-muted) hover:bg-(--color-bg-subtle)"
                            }`}
                          >
                            {p}
                          </button>
                        );
                      });
                      return items;
                    })()}
                    <button
                      type="button"
                      disabled={safePage === totalPages}
                      onClick={() => setDuplicatesPage((p) => Math.min(totalPages, p + 1))}
                      className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border border-(--color-border) text-xs text-(--color-text-muted) hover:bg-(--color-bg-subtle) disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      ›
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </Modal>

      {/* Modal de detalhe: comparação lado a lado de uma duplicata específica */}
      <Modal
        open={showDuplicatesModal && modalFilterIndex !== null}
        title="Lançamento existente"
        onClose={() => { setShowDuplicatesModal(false); setModalFilterIndex(null); }}
        size="lg"
      >
        {modalFilterIndex !== null && (() => {
          const match = duplicateMatches.find((m) => m.importedRowIndex === modalFilterIndex);
          if (!match) return null;
          const isForced = forcedIndices.has(match.importedRowIndex);
          return (
            <div className="flex flex-col gap-4">
              <button
                type="button"
                onClick={() => { setModalFilterIndex(null); setDuplicatesPage(1); }}
                className="flex cursor-pointer items-center gap-1.5 self-start text-xs text-(--color-text-muted) hover:text-(--color-text)"
              >
                ← Ver todas as duplicatas
              </button>
              <DuplicateMatchCard
                match={match}
                isForced={isForced}
                onToggleForce={() =>
                  setForcedIndices((prev) => {
                    const next = new Set(prev);
                    if (next.has(match.importedRowIndex)) next.delete(match.importedRowIndex);
                    else next.add(match.importedRowIndex);
                    return next;
                  })
                }
              />
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
