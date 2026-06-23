"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { GoalsStepper } from "@/components/goals/goals-stepper";
import { GoalsCongrats } from "@/components/goals/goals-congrats";
import { IncomeStep } from "@/components/goals/income-step";
import { AllocationStep } from "@/components/goals/allocation-step";
import { CategoryBudgetStep } from "@/components/goals/category-budget-step";
import type { Bucket } from "@/lib/budget-buckets";
import type { IncomeBaseline } from "@/lib/budget-data";

type CategoryInfo = { id: string; name: string; color: string; icon: string };

type ExistingBudgetItem = { categoryId: string; bucket: Bucket; limitAmount: number };

type GoalsWizardProps = {
  categories: CategoryInfo[];
  incomeBaseline: IncomeBaseline | null;
  categoryAverages: Record<string, number>;
  committedByCategory?: Record<string, number>;
  existingBudgets?: ExistingBudgetItem[];
};

type Step = "income" | "allocation" | "categories" | "done";

export function GoalsWizard({
  categories,
  incomeBaseline,
  categoryAverages,
  committedByCategory,
  existingBudgets,
}: GoalsWizardProps) {
  const [step, setStep] = useState<Step>("income");
  const [income, setIncome] = useState(incomeBaseline?.amount ?? 0);
  const [buckets, setBuckets] = useState<Record<string, Bucket> | null>(null);

  const initialBuckets = existingBudgets
    ? Object.fromEntries(existingBudgets.map((b) => [b.categoryId, b.bucket]))
    : undefined;
  const initialAmounts = existingBudgets
    ? Object.fromEntries(existingBudgets.map((b) => [b.categoryId, b.limitAmount]))
    : undefined;

  if (step === "done") {
    return <GoalsCongrats />;
  }

  return (
    <div className="flex flex-col gap-5">
      <GoalsStepper current={step} />

      <Card>
        {step === "income" && (
          <IncomeStep
            baseline={incomeBaseline}
            onConfirmed={(confirmedIncome) => {
              setIncome(confirmedIncome);
              setStep("allocation");
            }}
          />
        )}

        {step === "allocation" && (
          <AllocationStep
            income={income}
            categories={categories}
            initialBuckets={initialBuckets}
            onBack={() => setStep("income")}
            onConfirmed={(confirmedBuckets) => {
              setBuckets(confirmedBuckets);
              setStep("categories");
            }}
          />
        )}

        {step === "categories" && buckets && (
          <CategoryBudgetStep
            income={income}
            categories={categories}
            buckets={buckets}
            categoryAverages={categoryAverages}
            committedByCategory={committedByCategory}
            initialAmounts={initialAmounts}
            onBack={() => setStep("allocation")}
            onSaved={() => setStep("done")}
          />
        )}
      </Card>
    </div>
  );
}
