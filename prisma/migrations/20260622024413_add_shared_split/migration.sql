-- CreateTable
CREATE TABLE "shared_splits" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shared_splits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shared_split_items" (
    "id" TEXT NOT NULL,
    "sharedSplitId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shared_split_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shared_split_participants" (
    "id" TEXT NOT NULL,
    "sharedSplitId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "shared_split_participants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shared_splits_token_key" ON "shared_splits"("token");

-- CreateIndex
CREATE INDEX "shared_splits_userId_idx" ON "shared_splits"("userId");

-- CreateIndex
CREATE INDEX "shared_split_items_sharedSplitId_idx" ON "shared_split_items"("sharedSplitId");

-- CreateIndex
CREATE INDEX "shared_split_participants_sharedSplitId_idx" ON "shared_split_participants"("sharedSplitId");

-- AddForeignKey
ALTER TABLE "shared_splits" ADD CONSTRAINT "shared_splits_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shared_split_items" ADD CONSTRAINT "shared_split_items_sharedSplitId_fkey" FOREIGN KEY ("sharedSplitId") REFERENCES "shared_splits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shared_split_participants" ADD CONSTRAINT "shared_split_participants_sharedSplitId_fkey" FOREIGN KEY ("sharedSplitId") REFERENCES "shared_splits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
