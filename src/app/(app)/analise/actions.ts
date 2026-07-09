"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { ExplorerFilters, ExplorerResult } from "@/lib/analise-data";
import { getExplorerData } from "@/lib/analise-data";

// ---------------------------------------------------------------------------
// Auth helper — nunca confia em userId vindo do client
// ---------------------------------------------------------------------------
async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autenticado");
  return session.user.id;
}

// ---------------------------------------------------------------------------
// Schemas de validação Zod
// ---------------------------------------------------------------------------
const explorerFiltersSchema = z.object({
  categoryIds: z.array(z.string()),
  subcategoryIds: z.array(z.string()).default([]),
  tagIds: z.array(z.string()),
  type: z.enum(["EXPENSE", "INCOME", "BOTH"]),
  dateFrom: z.string().nullable(),
  dateTo: z.string().nullable(),
  period: z.enum(["30", "90", "180", "365", "all"]),
  groupBy: z.enum(["category", "month"]),
  chartType: z.enum([
    "bar-vertical",
    "bar-horizontal",
    "line",
    "area",
    "pie",
    "donut",
    "stacked-bar",
  ]),
  showValues: z.boolean(),
  showLegend: z.boolean(),
});

const saveVisualizationSchema = z.object({
  id: z.string().optional(),
  name: z
    .string()
    .min(1, "Nome é obrigatório")
    .max(100, "Nome deve ter no máximo 100 caracteres"),
  description: z
    .string()
    .max(500, "Descrição deve ter no máximo 500 caracteres")
    .optional(),
  filters: explorerFiltersSchema,
});

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * Busca dados agrupados para o Explorer a partir dos filtros do usuário.
 * userId injetado no servidor — nunca expostos ao client.
 */
export async function fetchExplorerDataAction(
  filters: ExplorerFilters
): Promise<ExplorerResult> {
  const userId = await requireUserId();

  const parsed = explorerFiltersSchema.safeParse(filters);
  if (!parsed.success) {
    throw new Error("Filtros inválidos: " + parsed.error.message);
  }

  return getExplorerData(userId, parsed.data);
}

/**
 * Cria ou atualiza uma visualização salva.
 * Retorna o id da visualização criada/atualizada.
 */
export async function saveVisualizationAction(data: {
  id?: string;
  name: string;
  description?: string;
  filters: ExplorerFilters;
}): Promise<{ id: string }> {
  const userId = await requireUserId();

  const parsed = saveVisualizationSchema.safeParse(data);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const firstError = Object.values(fieldErrors).flat()[0];
    throw new Error(firstError ?? "Dados inválidos");
  }

  const { id, name, description, filters } = parsed.data;
  const { chartType, groupBy, showValues, showLegend, ...filtersRest } =
    filters;
  const displayOpts = { showValues, showLegend };

  if (id) {
    // Filtra sempre por userId — nunca findUnique por id puro
    const existing = await prisma.savedVisualization.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!existing) throw new Error("Visualização não encontrada");

    await prisma.savedVisualization.update({
      where: { id },
      data: {
        name,
        description: description ?? null,
        filters: filtersRest,
        chartType,
        groupBy,
        displayOpts,
      },
    });

    revalidatePath("/analise");
    return { id };
  }

  const viz = await prisma.savedVisualization.create({
    data: {
      userId,
      name,
      description: description ?? null,
      filters: filtersRest,
      chartType,
      groupBy,
      displayOpts,
    },
    select: { id: true },
  });

  revalidatePath("/analise");
  return { id: viz.id };
}

/**
 * Exclui uma visualização do usuário autenticado.
 * Usa deleteMany para garantir filtro por userId sem lançar erro se não existir.
 */
export async function deleteVisualizationAction(id: string): Promise<void> {
  const userId = await requireUserId();
  await prisma.savedVisualization.deleteMany({ where: { id, userId } });
  revalidatePath("/analise");
}

/**
 * Liga/desliga o compartilhamento público de uma visualização.
 * Gera o shareToken na primeira ativação e o reutiliza nas seguintes.
 */
export async function toggleShareVisualizationAction(
  id: string
): Promise<{ shareToken: string | null; shareActive: boolean }> {
  const userId = await requireUserId();

  // findFirst com userId — proteção obrigatória
  const viz = await prisma.savedVisualization.findFirst({
    where: { id, userId },
    select: { shareActive: true, shareToken: true },
  });
  if (!viz) throw new Error("Visualização não encontrada");

  if (viz.shareActive) {
    // Desativar compartilhamento — mantém o token para eventual reativação
    await prisma.savedVisualization.update({
      where: { id },
      data: { shareActive: false },
    });
    return { shareToken: viz.shareToken, shareActive: false };
  }

  // Ativar: reutiliza token existente ou gera novo
  const token =
    viz.shareToken ?? crypto.randomUUID().replace(/-/g, "");
  await prisma.savedVisualization.update({
    where: { id },
    data: { shareActive: true, shareToken: token },
  });
  return { shareToken: token, shareActive: true };
}

/**
 * Lista todas as visualizações salvas do usuário, ordenadas pela mais recente.
 */
export async function getSavedVisualizationsAction() {
  const userId = await requireUserId();
  return prisma.savedVisualization.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      chartType: true,
      groupBy: true,
      shareActive: true,
      shareToken: true,
      createdAt: true,
      updatedAt: true,
      filters: true,
    },
  });
}
