// @vitest-environment happy-dom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Wallet } from "lucide-react";
import { IconBadge } from "../../../src/components/ui/icon-badge";

describe("IconBadge", () => {
  it("renderiza sem crash com props mínimas", () => {
    const { container } = render(<IconBadge icon={Wallet} />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it("o span raiz tem aria-hidden pois é decorativo", () => {
    const { container } = render(<IconBadge icon={Wallet} />);
    expect(container.firstChild).toHaveAttribute("aria-hidden", "true");
  });

  it("aplica inline style quando colorHex é fornecido", () => {
    const { container } = render(<IconBadge icon={Wallet} colorHex="#A855F7" />);
    const span = container.firstChild as HTMLElement;
    expect(span.style.color).toBeTruthy();
  });

  it("não aplica inline style quando usa colorToken", () => {
    const { container } = render(<IconBadge icon={Wallet} colorToken="--color-primary" />);
    const span = container.firstChild as HTMLElement;
    expect(span.style.backgroundColor).toBe("");
  });

  it.each(["sm", "md", "lg", "xl"] as const)("renderiza sem crash no tamanho %s", (size) => {
    const { container } = render(<IconBadge icon={Wallet} size={size} />);
    expect(container.firstChild).toBeInTheDocument();
  });
});
