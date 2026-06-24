-- CreateEnum
CREATE TYPE "WishStatus" AS ENUM ('ACTIVE', 'PURCHASED', 'ABANDONED');

-- AlterTable
ALTER TABLE "goals" ADD COLUMN     "wishId" TEXT;

-- CreateTable
CREATE TABLE "wishes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "estimatedAmount" DOUBLE PRECISION NOT NULL,
    "categoryId" TEXT NOT NULL,
    "subcategoryId" TEXT NOT NULL,
    "status" "WishStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "imageUrl" TEXT,
    "coolingOffUntil" TIMESTAMP(3),
    "purchasedAt" TIMESTAMP(3),
    "purchasedTransactionId" TEXT,
    "abandonedAt" TIMESTAMP(3),
    "abandonReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wishes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wishes_purchasedTransactionId_key" ON "wishes"("purchasedTransactionId");

-- CreateIndex
CREATE INDEX "wishes_userId_status_idx" ON "wishes"("userId", "status");

-- CreateIndex
CREATE INDEX "wishes_categoryId_idx" ON "wishes"("categoryId");

-- CreateIndex
CREATE INDEX "wishes_subcategoryId_idx" ON "wishes"("subcategoryId");

-- CreateIndex
CREATE UNIQUE INDEX "goals_wishId_key" ON "goals"("wishId");

-- CreateIndex
CREATE INDEX "goals_userId_idx" ON "goals"("userId");

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_wishId_fkey" FOREIGN KEY ("wishId") REFERENCES "wishes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishes" ADD CONSTRAINT "wishes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishes" ADD CONSTRAINT "wishes_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishes" ADD CONSTRAINT "wishes_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishes" ADD CONSTRAINT "wishes_purchasedTransactionId_fkey" FOREIGN KEY ("purchasedTransactionId") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
