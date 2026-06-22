"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { SplitWizard } from "@/components/split/split-wizard";
import type { TransactionListItem } from "@/components/transactions/transaction-list";

type ShareSplitButtonProps = {
  transactions: TransactionListItem[];
  onDone: () => void;
};

export function ShareSplitButton({ transactions, onDone }: ShareSplitButtonProps) {
  const [open, setOpen] = useState(false);

  function handleClose() {
    setOpen(false);
    onDone();
  }

  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        <Share2 className="h-4 w-4" aria-hidden="true" />
        Dividir conta
      </Button>

      <Modal open={open} title="Dividir conta" onClose={handleClose}>
        <SplitWizard transactions={transactions} onDone={handleClose} />
      </Modal>
    </>
  );
}
