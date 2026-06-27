// @vitest-environment happy-dom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProgressBar } from "../../../src/components/ui/progress-bar";

describe("ProgressBar", () => {
  it("tem role=progressbar", () => {
    const { getByRole } = render(<ProgressBar value={40} />);
    expect(getByRole("progressbar")).toBeInTheDocument();
  });

  it("expõe aria-valuenow correto", () => {
    const { getByRole } = render(<ProgressBar value={40} />);
    expect(getByRole("progressbar")).toHaveAttribute("aria-valuenow", "40");
  });

  it("a barra interna reflete o valor como largura percentual", () => {
    const { getByRole } = render(<ProgressBar value={60} />);
    expect(getByRole("progressbar")).toHaveStyle({ width: "60%" });
  });

  it("limita a largura a 100% quando value > 100", () => {
    const { getByRole } = render(<ProgressBar value={150} />);
    expect(getByRole("progressbar")).toHaveStyle({ width: "100%" });
  });

  it("limita a largura a 0% quando value < 0", () => {
    const { getByRole } = render(<ProgressBar value={-10} />);
    expect(getByRole("progressbar")).toHaveStyle({ width: "0%" });
  });

  it("renderiza 3 milestones quando showMilestones=true", () => {
    const { container } = render(<ProgressBar value={50} showMilestones />);
    expect(container.querySelectorAll("span[aria-hidden]")).toHaveLength(3);
  });

  it("não renderiza milestones por padrão", () => {
    const { container } = render(<ProgressBar value={50} />);
    expect(container.querySelectorAll("span[aria-hidden]")).toHaveLength(0);
  });

  it.each(["primary", "success", "danger", "accent"] as const)(
    "renderiza sem crash na cor %s",
    (color) => {
      const { container } = render(<ProgressBar value={50} color={color} />);
      expect(container.firstChild).toBeInTheDocument();
    }
  );
});
