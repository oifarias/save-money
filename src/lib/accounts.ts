import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Retorna a conta mais antiga do usuário — hoje o produto opera com uma única conta por usuário.
 * Aceita opcionalmente um client de transação para ser reaproveitado dentro de `$transaction`.
 */
export async function getDefaultAccountId(userId: string, db: Db = prisma): Promise<string | null> {
  const account = await db.account.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return account?.id ?? null;
}

/**
 * Garante que o usuário tenha uma conta padrão, criando uma de forma idempotente caso não exista.
 * Útil como auto-cura em fluxos (ex.: importação) onde a ausência de conta não deveria bloquear a operação.
 */
export async function ensureDefaultAccountId(userId: string, db: Db = prisma): Promise<string> {
  const existing = await getDefaultAccountId(userId, db);
  if (existing) return existing;

  const created = await db.account.create({
    data: { userId, name: "Conta principal", type: "wallet" },
    select: { id: true },
  });
  return created.id;
}
