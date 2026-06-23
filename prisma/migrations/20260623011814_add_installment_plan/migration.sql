-- CreateTable
CREATE TABLE "installment_plans" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "baseDescription" TEXT NOT NULL,
    "totalInstallments" INTEGER NOT NULL,
    "estimatedAmount" DOUBLE PRECISION NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "categoryId" TEXT,
    "subcategoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "installment_plans_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "installmentPlanId" TEXT,
ADD COLUMN     "installmentNumber" INTEGER;

-- CreateIndex
CREATE INDEX "installment_plans_userId_baseDescription_totalInstallment_idx" ON "installment_plans"("userId", "baseDescription", "totalInstallments");

-- CreateIndex
CREATE INDEX "transactions_installmentPlanId_idx" ON "transactions"("installmentPlanId");

-- AddForeignKey
ALTER TABLE "installment_plans" ADD CONSTRAINT "installment_plans_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_installmentPlanId_fkey" FOREIGN KEY ("installmentPlanId") REFERENCES "installment_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
