"use client";

import { useState } from "react";
import { Copy, MessageCircle, PartyPopper } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type SplitCongratsProps = {
  token: string;
  title: string;
  onClose: () => void;
};

export function SplitCongrats({ token, title, onClose }: SplitCongratsProps) {
  const [copied, setCopied] = useState(false);
  const link = typeof window !== "undefined" ? `${window.location.origin}/dividir?token=${token}` : `/dividir?token=${token}`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // navegador sem permissão de clipboard — o link já está visível na tela pra copiar manualmente
    }
  }

  const whatsappText = encodeURIComponent(`${title} — confira a divisão da conta: ${link}`);

  return (
    <Card className="flex flex-col items-center gap-4 py-10 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-(--color-success)/10 text-(--color-success)">
        <PartyPopper className="h-8 w-8" aria-hidden="true" />
      </span>
      <div>
        <h2 className="font-display text-xl font-semibold text-(--color-text)">Pronto! Sua conta foi dividida.</h2>
        <p className="mt-2 max-w-sm text-sm text-(--color-text-muted)">
          Compartilhe o link abaixo com quem participou — não precisa ter conta pra ver.
        </p>
      </div>

      <div className="w-full overflow-hidden rounded-xl border border-(--color-border) bg-(--color-bg) px-3.5 py-2.5 text-left">
        <p className="truncate text-sm text-(--color-text-muted)">{link}</p>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        <Button type="button" onClick={handleCopy}>
          <Copy className="h-4 w-4" aria-hidden="true" />
          {copied ? "Copiado!" : "Copiar link"}
        </Button>
        <a href={`https://wa.me/?text=${whatsappText}`} target="_blank" rel="noopener noreferrer">
          <Button type="button" variant="secondary">
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            Compartilhar no WhatsApp
          </Button>
        </a>
      </div>

      <Button type="button" variant="ghost" onClick={onClose}>
        Fechar
      </Button>
    </Card>
  );
}
