# Plano de melhoria — Grupos: componentização e reutilização de UI

## 1. Estado atual

### Arquivos envolvidos
- `src/app/(app)/grupos/page.tsx` — Server Component fino, só busca dados e passa para `CategoryManager`. Sem problemas.
- `src/components/groups/category-manager.tsx` — Client Component principal (~415 linhas). Contém toda a lógica de estado, os cards de categoria, o modal de edição em lote (`BatchEditModal`) e quatro sub-componentes locais: `BatchColorPicker`, `BatchIconPicker`, `BatchEditModal`.
- `src/components/groups/category-form.tsx` — Formulário de criação/edição. Contém dois sub-componentes locais: `ColorPicker`, `IconPicker`.

### Componentes de ui/ já adotados corretamente
`Card`, `Button`, `Input`, `Modal`, `ConfirmDialog`, `PageHeader`, `EmptyState`, `IconBadge`, `IconActionButton`, `SelectField` — todos em uso no lugar certo.

---

## 2. Problemas identificados

### 2.1 Duplicação crítica: ColorPicker e IconPicker

Existem **quatro implementações** para dois conceitos visuais idênticos:

| Componente local | Arquivo | Mecanismo de seleção |
|---|---|---|
| `ColorPicker` | `category-form.tsx` | `<input type="radio">` SR-only (modo form/server action) |
| `BatchColorPicker` | `category-manager.tsx` | `<button onClick>` + `value/onChange` (modo controlado) |
| `IconPicker` | `category-form.tsx` | `<input type="radio">` SR-only (modo form) |
| `BatchIconPicker` | `category-manager.tsx` | `<button onClick>` + `value/onChange` (modo controlado) |

O visual é pixel-a-pixel idêntico. A diferença é apenas o mecanismo de seleção. Qualquer mudança de design (cor do ring de seleção, tamanho dos swatches, labels de seção) precisa ser replicada em dois lugares.

### 2.2 Label de seção repetido 4x

```tsx
<p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-(--color-text-muted)">
  {section.label}
</p>
```

Esse padrão aparece em `ColorPicker`, `BatchColorPicker`, `IconPicker` e `BatchIconPicker`. Não existe componente em `ui/` que cubra label de texto puro com esse estilo.

### 2.3 Botão link "Novo sub-grupo" sem variante correspondente no Button

```tsx
<button
  type="button"
  className="flex items-center gap-1 self-start text-xs font-medium text-(--color-primary) hover:underline"
>
```

O componente `Button` de `ui/` não tem variante `link`. A estilização está inline, sem o `disabled` e `isLoading` do `Button`. Futuros botões com esse mesmo estilo precisariam replicar as classes manualmente.

### 2.4 StatusBadge não usado para a flag "padrão"

No card de cada categoria:
```tsx
{category.isDefault && " · padrão"}
```

Texto concatenado no meio de uma `<p>`. O componente `StatusBadge` de `ui/` com `variant="muted"` existe exatamente para isso e não está sendo usado.

### 2.5 BatchEditModal ocupa 110 linhas dentro de category-manager.tsx

O componente `BatchEditModal` (linhas 100–209 de `category-manager.tsx`) é autossuficiente — tem estado próprio, lida com sua própria transição e não compartilha estado com `CategoryManager` além das props. Está no mesmo arquivo por comodidade, não por necessidade, aumentando o tamanho do arquivo desnecessariamente.

### 2.6 Bloco colapsável de sub-grupos inline

O toggle de sub-grupos dentro de cada card (linhas 319–364 de `category-manager.tsx`) é markup inline de ~45 linhas com lógica de collapsed controlada externamente por `Set<string>`. O componente `CollapsibleSection` de `ui/` gerencia estado interno e tem estilo de seção de página — incompatível com o contexto compacto dentro de um Card. Não há componente adequado em `ui/` para substituir.

---

## 3. Propostas de melhoria

### 3.1 Criar `src/components/groups/color-picker.tsx`

Unifica `ColorPicker` e `BatchColorPicker` em um único componente dual-mode.

**Props:**
```typescript
type ColorPickerProps =
  | { mode: "form"; name: string; defaultValue: string; error?: string }
  | { mode: "controlled"; value: string; onChange: (color: string) => void };
```

- `mode: "form"` → renderiza `<input type="radio" name={name}>` SR-only (mantém compatibilidade com Server Actions)
- `mode: "controlled"` → renderiza `<button type="button" onClick>` com estado externo

Internamente usa `SectionLabel` (ver 3.3) e os dados de `@/lib/category-colors`.

**Usado em:** `category-form.tsx` (mode form), `category-manager.tsx` dentro de `BatchEditModal` (mode controlled)

### 3.2 Criar `src/components/groups/icon-picker.tsx`

Mesmo padrão dual-mode para ícones.

**Props:**
```typescript
type IconPickerProps =
  | { mode: "form"; name: string; defaultValue: string; error?: string }
  | { mode: "controlled"; value: string; onChange: (icon: string) => void };
```

**Usado em:** `category-form.tsx` (mode form), `category-manager.tsx` dentro de `BatchEditModal` (mode controlled)

### 3.3 Criar `SectionLabel` como componente interno dos pickers

```tsx
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-(--color-text-muted)">
      {children}
    </p>
  );
}
```

Definido localmente dentro de `color-picker.tsx` e `icon-picker.tsx`. Não vai para `ui/` ainda — o padrão aparece exclusivamente no domínio de grupos. Se aparecer em outros domínios, promover para `src/components/ui/section-label.tsx`.

### 3.4 Adicionar variante `link` ao `src/components/ui/button.tsx`

```typescript
link: "bg-transparent px-0! py-0! text-xs text-(--color-primary) underline-offset-2 hover:underline",
```

Substituir o `<button>` inline "Novo sub-grupo" em `category-manager.tsx` por:
```tsx
<Button variant="link" onClick={() => setFormMode({ kind: "create-sub", parentId: category.id })}>
  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
  Novo sub-grupo
</Button>
```

**Nota:** o `Button` tem padding e `text-sm` fixos no base class. A variante `link` precisa sobrescrever com `px-0! py-0! text-xs!` (Tailwind v4 override com `!`).

### 3.5 Usar `StatusBadge` para a flag "padrão"

Em `category-manager.tsx`, linha 295, substituir:
```tsx
{category.isDefault && " · padrão"}
```
Por:
```tsx
{category.isDefault && <StatusBadge label="padrão" variant="muted" />}
```
O `<p>` container muda para `<div className="flex items-center gap-1.5 flex-wrap">` para acomodar o badge inline com o texto.

### 3.6 Extrair `BatchEditModal` para `src/components/groups/batch-edit-modal.tsx`

Mover o componente `BatchEditModal` (linhas 100–209) para arquivo próprio. Após a criação de `color-picker.tsx` e `icon-picker.tsx`, ele terá apenas ~70 linhas de modal em si, sem os pickers duplicados. `category-manager.tsx` importa do arquivo novo.

**Props mantidas:**
```typescript
type BatchEditModalProps = {
  categories: CategoryWithCount[];
  open: boolean;
  onClose: () => void;
};
```

### 3.7 Extrair bloco colapsável de sub-grupos para `src/components/groups/sub-group-list.tsx`

Extrair as linhas 319–364 de `category-manager.tsx` para um componente local do domínio.

**Props:**
```typescript
type SubGroupListProps = {
  children: CategoryWithCount[];
  collapsed: boolean;
  onToggle: () => void;
  onEdit: (child: CategoryWithCount) => void;
  onDelete: (child: CategoryWithCount) => void;
};
```

Não vai para `ui/` porque usa `IconActionButton` com callbacks de domínio e a lógica do `" · "` é específica de grupos.

---

## 4. Sequência de implementação

As etapas são ordenadas para que cada passo tenha dependências já resolvidas.

**Etapa 1 — Unificar pickers (maior impacto, zero risco de regressão visual)**
1. Criar `src/components/groups/color-picker.tsx` (com `SectionLabel` interno)
2. Criar `src/components/groups/icon-picker.tsx` (com `SectionLabel` interno)
3. Atualizar `category-form.tsx`: remover `ColorPicker` e `IconPicker` locais, importar os novos
4. Atualizar `category-manager.tsx`: remover `BatchColorPicker` e `BatchIconPicker`, importar os novos em modo `controlled`

**Etapa 2 — Extrair BatchEditModal**
5. Criar `src/components/groups/batch-edit-modal.tsx` movendo o componente
6. Atualizar `category-manager.tsx` para importar do novo arquivo

**Etapa 3 — Extrair SubGroupList**
7. Criar `src/components/groups/sub-group-list.tsx`
8. Atualizar `category-manager.tsx` para usar o novo componente

**Etapa 4 — Melhorias pontuais em ui/**
9. Adicionar variante `link` em `src/components/ui/button.tsx`
10. Substituir o `<button>` inline "Novo sub-grupo" por `<Button variant="link">`
11. Substituir `{category.isDefault && " · padrão"}` por `<StatusBadge label="padrão" variant="muted" />`

A etapa 4 vem por último porque depende de confirmação visual (o `Button variant="link"` precisa ter padding e tamanho corretos antes de substituir o inline).

---

## 5. Verificação final

Após todas as etapas:
- `category-manager.tsx` deve ter menos de 250 linhas (hoje 415)
- `category-form.tsx` deve ter menos de 70 linhas (hoje 170)
- Nenhum swatch de cor ou ícone com markup inline duplicado — tudo passa pelos dois componentes centralizados
- `npm run build` sem erros de tipo
- Fluxo manual: criar grupo, criar sub-grupo, editar em lote (color + icon), excluir — todos funcionando

---

## 6. Tarefa pendente ao concluir

Se `SectionLabel` vier a ser adotado em outros domínios além de `groups/`, promover para `src/components/ui/section-label.tsx` e atualizar o agente `ui-components` listando o novo componente com suas props e casos de uso.
