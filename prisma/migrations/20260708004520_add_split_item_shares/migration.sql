-- AlterTable
ALTER TABLE "shared_split_items" ADD COLUMN     "note" TEXT;

-- CreateTable
CREATE TABLE "shared_split_item_shares" (
    "id" TEXT NOT NULL,
    "sharedSplitItemId" TEXT NOT NULL,
    "sharedSplitParticipantId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "shared_split_item_shares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shared_split_item_shares_sharedSplitParticipantId_idx" ON "shared_split_item_shares"("sharedSplitParticipantId");

-- CreateIndex
CREATE UNIQUE INDEX "shared_split_item_shares_sharedSplitItemId_sharedSplitParti_key" ON "shared_split_item_shares"("sharedSplitItemId", "sharedSplitParticipantId");

-- AddForeignKey
ALTER TABLE "shared_split_item_shares" ADD CONSTRAINT "shared_split_item_shares_sharedSplitItemId_fkey" FOREIGN KEY ("sharedSplitItemId") REFERENCES "shared_split_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shared_split_item_shares" ADD CONSTRAINT "shared_split_item_shares_sharedSplitParticipantId_fkey" FOREIGN KEY ("sharedSplitParticipantId") REFERENCES "shared_split_participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
