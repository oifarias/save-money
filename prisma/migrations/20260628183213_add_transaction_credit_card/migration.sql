-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "creditCardId" TEXT;

-- CreateIndex
CREATE INDEX "transactions_creditCardId_idx" ON "transactions"("creditCardId");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_creditCardId_fkey" FOREIGN KEY ("creditCardId") REFERENCES "credit_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;
