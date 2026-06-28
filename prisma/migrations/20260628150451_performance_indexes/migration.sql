-- CreateIndex
CREATE INDEX "budgets_userId_month_idx" ON "budgets"("userId", "month");

-- CreateIndex
CREATE INDEX "installment_plans_userId_categoryId_idx" ON "installment_plans"("userId", "categoryId");

-- CreateIndex
CREATE INDEX "transactions_userId_type_date_idx" ON "transactions"("userId", "type", "date");

-- CreateIndex
CREATE INDEX "wishes_userId_createdAt_idx" ON "wishes"("userId", "createdAt");
