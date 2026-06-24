-- CreateEnum
CREATE TYPE "WishKind" AS ENUM ('NEED', 'WANT');

-- CreateEnum
CREATE TYPE "WishPurchaseTiming" AS ENUM ('THIS_MONTH', 'NEXT_MONTH', 'LATER');

-- CreateEnum
CREATE TYPE "WishPaymentMethod" AS ENUM ('CASH', 'INSTALLMENTS');

-- AlterTable
ALTER TABLE "wishes" ADD COLUMN     "installmentAmount" DOUBLE PRECISION,
ADD COLUMN     "installmentsCount" INTEGER,
ADD COLUMN     "kind" "WishKind" NOT NULL DEFAULT 'WANT',
ADD COLUMN     "link" TEXT,
ADD COLUMN     "paymentMethod" "WishPaymentMethod" NOT NULL DEFAULT 'CASH',
ADD COLUMN     "priority" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "purchaseTiming" "WishPurchaseTiming" NOT NULL DEFAULT 'THIS_MONTH';

-- CreateIndex
CREATE INDEX "wishes_userId_priority_idx" ON "wishes"("userId", "priority");

-- RenameIndex
ALTER INDEX "installment_plans_userId_baseDescription_totalInstallment_idx" RENAME TO "installment_plans_userId_baseDescription_totalInstallments_idx";
