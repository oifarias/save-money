"use client";

import { useMemo, useState } from "react";
import { SplitStepper } from "@/components/split/split-stepper";
import { TitleStep } from "@/components/split/title-step";
import { DivideStep } from "@/components/split/divide-step";
import { ItemSharesStep } from "@/components/split/item-shares-step";
import { SummaryStep } from "@/components/split/summary-step";
import { SplitCongrats } from "@/components/split/split-congrats";
import type { TransactionListItem } from "@/components/transactions/transaction-list";

export type SplitParticipant = { name: string; amount: number };
export type SplitMode = "equal" | "custom";
export type SplitItemShare = { participantIndex: number; amount: number };
export type SplitItemDraft = { transactionId: string; note: string; shares: SplitItemShare[] };

type Step = "title" | "divide" | "items" | "summary" | "done";

type SplitWizardProps = {
  transactions: TransactionListItem[];
  onDone: () => void;
};

function roundCents(value: number) {
  return Math.round(value * 100) / 100;
}

export function SplitWizard({ transactions, onDone }: SplitWizardProps) {
  const [step, setStep] = useState<Step>("title");
  const [title, setTitle] = useState("");
  const [mode, setMode] = useState<SplitMode | null>(null);
  const [participants, setParticipants] = useState<SplitParticipant[]>([]);
  const [showCategories, setShowCategories] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  const eligible = useMemo(() => transactions.filter((t) => t.type === "EXPENSE"), [transactions]);
  const ignoredCount = transactions.length - eligible.length;
  const total = useMemo(() => eligible.reduce((sum, t) => sum + t.amount, 0), [eligible]);

  const [itemDrafts, setItemDrafts] = useState<SplitItemDraft[]>(() =>
    eligible.map((t) => ({ transactionId: t.id, note: "", shares: [] }))
  );

  function updateItemDraft(transactionId: string, patch: Partial<SplitItemDraft>) {
    setItemDrafts((current) => current.map((d) => (d.transactionId === transactionId ? { ...d, ...patch } : d)));
  }

  const activeSteps: { id: Step; label: string }[] =
    mode === "custom"
      ? [
          { id: "title", label: "Título" },
          { id: "divide", label: "Divisão" },
          { id: "items", label: "Valores" },
          { id: "summary", label: "Resumo" },
        ]
      : [
          { id: "title", label: "Título" },
          { id: "divide", label: "Divisão" },
          { id: "summary", label: "Resumo" },
        ];

  if (step === "done" && token) {
    return <SplitCongrats token={token} title={title} onClose={onDone} />;
  }

  return (
    <div className="flex flex-col gap-5">
      <SplitStepper steps={activeSteps} current={step === "done" ? "summary" : step} />

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
            if (nextMode === "custom") {
              setItemDrafts((current) =>
                current.map((draft) => {
                  const tx = eligible.find((t) => t.id === draft.transactionId);
                  if (!tx) return draft;
                  const share = roundCents(tx.amount / nextParticipants.length);
                  return {
                    ...draft,
                    shares: nextParticipants.map((_, index) => ({ participantIndex: index, amount: share })),
                  };
                })
              );
              setStep("items");
            } else {
              setStep("summary");
            }
          }}
        />
      )}

      {step === "items" && mode === "custom" && (
        <ItemSharesStep
          eligible={eligible}
          participants={participants}
          itemDrafts={itemDrafts}
          onUpdateItem={updateItemDraft}
          onBack={() => setStep("divide")}
          onNext={() => setStep("summary")}
        />
      )}

      {step === "summary" && mode && (
        <SummaryStep
          title={title}
          mode={mode}
          eligible={eligible}
          total={total}
          participants={participants}
          itemDrafts={itemDrafts}
          showCategories={showCategories}
          onShowCategoriesChange={setShowCategories}
          onUpdateItemNote={(transactionId, note) => updateItemDraft(transactionId, { note })}
          onBack={() => setStep(mode === "custom" ? "items" : "divide")}
          onCreated={(createdToken) => {
            setToken(createdToken);
            setStep("done");
          }}
        />
      )}
    </div>
  );
}
