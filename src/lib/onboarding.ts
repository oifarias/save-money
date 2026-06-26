import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { DEFAULT_CATEGORIES } from "@/lib/default-categories";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Cria a conta financeira padrão ("Carteira principal") e as categorias default de um usuário novo.
 * Compartilhado entre o cadastro por e-mail/senha e o primeiro login via Google, para que ambos
 * os fluxos de criação de usuário cheguem ao mesmo estado inicial.
 */
export async function setupNewUserDefaults(db: Db, userId: string): Promise<void> {
  await db.financialAccount.create({
    data: { userId, name: "Carteira principal", type: "wallet", balance: 0 },
  });

  await db.category.createMany({
    data: DEFAULT_CATEGORIES.map((category) => ({
      userId,
      name: category.name,
      color: category.color,
      icon: category.icon,
      isDefault: true,
    })),
  });
}
