-- CreateTable
CREATE TABLE "saved_visualizations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "filters" JSONB NOT NULL,
    "chartType" TEXT NOT NULL,
    "groupBy" TEXT NOT NULL,
    "displayOpts" JSONB NOT NULL DEFAULT '{}',
    "shareToken" TEXT,
    "shareActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_visualizations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "saved_visualizations_shareToken_key" ON "saved_visualizations"("shareToken");

-- CreateIndex
CREATE INDEX "saved_visualizations_userId_idx" ON "saved_visualizations"("userId");

-- AddForeignKey
ALTER TABLE "saved_visualizations" ADD CONSTRAINT "saved_visualizations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
