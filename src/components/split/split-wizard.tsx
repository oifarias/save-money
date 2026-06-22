"use client";

import { useMemo, useState } from "react";
import { SplitStepper } from "@/components/split/split-stepper";
import { TitleStep } from "@/components/split/title-step";
import { DivideStep } from "@/components/split/divide-step";
import { SummaryStep } from "@/components/split/summary-step";
import { SplitCongrats } from "@/components/split/split-congrats";
import type { TransactionListItem } from "@/components/transactions/transaction-list";

export type SplitParticipant = { name: string; amount: number };
export type SplitMode = "equal" | "custom";

type Step = "title" | "divide" | "summary" | "done";

type SplitWizardProps = {
  transactions: TransactionListItem[];
  onDone: () => void;
};

export function SplitWizard({ transactions, onDone }: SplitWizardProps) {
  const [step, setStep] = useState<Step>("title");
  const [title, setTitle] = useState("");
  const [mode, setMode] = useState<SplitMode | null>(null);
  const [participants, setParticipants] = useState<SplitParticipant[]>([]);
  const [token, setToken] = useState<string | null>(null);

  const eligible = useMemo(() => transactions.filter((t) => t.type === "EXPENSE"), [transactions]);
  const ignoredCount = transactions.length - eligible.length;
  const total = useMemo(() => eligible.reduce((sum, t) => sum + t.amount, 0), [eligible]);

  if (step === "done" && token) {
    return <SplitCongrats token={token} title={title} onClose={onDone} />;
  }

  return (
    <div className="flex flex-col gap-5">
      <SplitStepper current={step === "done" ? "summary" : step} />

      {step === "title" && (
        <TitleStep
          title={title}
          onTitleChange={setTitle}
          transactionsCount={eligible.length}
          total={total}
          ignoredCount={ignoredCount}
          onNext={() => setStep("divide")}
        />
      )}

      {step === "divide" && (
        <DivideStep
          total={total}
          initialMode={mode}
          initialParticipants={participants}
          onBack={() => setStep("title")}
          onConfirmed={(nextMode, nextParticipants) => {
            setMode(nextMode);
            setParticipants(nextParticipants);
            setStep("summary");
          }}
        />
      )}

      {step === "summary" && mode && (
        <SummaryStep
          title={title}
          mode={mode}
          eligible={eligible}
          total={total}
          participants={participants}
          transactionIds={eligible.map((t) => t.id)}
          onBack={() => setStep("divide")}
          onCreated={(createdToken) => {
            setToken(createdToken);
            setStep("done");
          }}
        />
      )}
    </div>
  );
}
