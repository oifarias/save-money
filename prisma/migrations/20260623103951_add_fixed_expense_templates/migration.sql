-- CreateTable
CREATE TABLE "fixed_expense_templates" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "expectedAmount" DOUBLE PRECISION NOT NULL,
    "dueDay" INTEGER NOT NULL,
    "categoryId" TEXT,
    "subcategoryId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fixed_expense_templates_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "fixedExpenseTemplateId" TEXT,
ADD COLUMN     "referenceMonth" TEXT;

-- CreateIndex
CREATE INDEX "fixed_expense_templates_userId_isActive_idx" ON "fixed_expense_templates"("userId", "isActive");

-- CreateIndex
CREATE INDEX "fixed_expense_templates_categoryId_idx" ON "fixed_expense_templates"("categoryId");

-- CreateIndex
CREATE INDEX "fixed_expense_templates_subcategoryId_idx" ON "fixed_expense_templates"("subcategoryId");

-- CreateIndex
CREATE INDEX "transactions_fixedExpenseTemplateId_idx" ON "transactions"("fixedExpenseTemplateId");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_fixedExpenseTemplateId_referenceMonth_key" ON "transactions"("fixedExpenseTemplateId", "referenceMonth");

-- AddForeignKey
ALTER TABLE "fixed_expense_templates" ADD CONSTRAINT "fixed_expense_templates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixed_expense_templates" ADD CONSTRAINT "fixed_expense_templates_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixed_expense_templates" ADD CONSTRAINT "fixed_expense_templates_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_fixedExpenseTemplateId_fkey" FOREIGN KEY ("fixedExpenseTemplateId") REFERENCES "fixed_expense_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
