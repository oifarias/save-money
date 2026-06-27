type SelectionBarProps = {
  count: number;
  label?: string;
  children: React.ReactNode;
};

export function SelectionBar({ count, label = "selecionado(s)", children }: SelectionBarProps) {
  if (count === 0) return null;
  return (
    <div className="sticky top-2 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-(--color-primary)/30 bg-(--color-primary)/10 px-4 py-3">
      <p className="text-sm font-medium text-(--color-text)">
        {count} {label}
      </p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
