-- AlterTable
ALTER TABLE "budgets" ADD COLUMN     "bucket" TEXT;

-- CreateTable
CREATE TABLE "budget_incomes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budget_incomes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "budget_incomes_userId_month_key" ON "budget_incomes"("userId", "month");

-- AddForeignKey
ALTER TABLE "budget_incomes" ADD CONSTRAINT "budget_incomes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
