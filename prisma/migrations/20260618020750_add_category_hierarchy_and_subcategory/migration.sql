-- DropIndex
DROP INDEX "categories_userId_name_key";

-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "parentId" TEXT;

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "subcategoryId" TEXT;

-- CreateIndex
CREATE INDEX "categories_parentId_idx" ON "categories"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "categories_userId_parentId_name_key" ON "categories"("userId", "parentId", "name");

-- CreateIndex
CREATE INDEX "transactions_categoryId_idx" ON "transactions"("categoryId");

-- CreateIndex
CREATE INDEX "transactions_subcategoryId_idx" ON "transactions"("subcategoryId");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

