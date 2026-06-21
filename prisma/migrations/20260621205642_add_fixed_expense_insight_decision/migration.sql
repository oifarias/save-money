-- CreateTable
CREATE TABLE "fixed_expense_insight_decisions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "groupKey" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION,
    "categoryId" TEXT,
    "subcategoryId" TEXT,
    "transactionIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fixed_expense_insight_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fixed_expense_insight_decisions_userId_groupKey_key" ON "fixed_expense_insight_decisions"("userId", "groupKey");

-- AddForeignKey
ALTER TABLE "fixed_expense_insight_decisions" ADD CONSTRAINT "fixed_expense_insight_decisions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
