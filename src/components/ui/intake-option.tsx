import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { IconBadge } from "@/components/ui/icon-badge";

type IntakeOptionBase = {
  icon: LucideIcon;
  title: string;
  description: string;
  colorToken?: string;
};

type IntakeOptionAsLink   = IntakeOptionBase & { href: string; onClick?: never };
type IntakeOptionAsButton = IntakeOptionBase & { onClick: () => void; href?: never };
type IntakeOptionProps    = IntakeOptionAsLink | IntakeOptionAsButton;

const SHARED_CLASS = "group flex items-start gap-3 rounded-2xl border border-(--color-border) bg-(--color-surface) px-4 py-3.5 text-left transition-colors duration-200 hover:border-(--color-primary)/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-primary)/40";

function IntakeOptionContent({ icon, title, description, colorToken = "--color-primary" }: IntakeOptionBase) {
  return (
    <>
      <IconBadge icon={icon} colorToken={colorToken} />
      <span className="flex-1">
        <span className="block font-display text-sm font-semibold text-(--color-text)">{title}</span>
        <span className="mt-0.5 block text-xs text-(--color-text-muted)">{description}</span>
      </span>
      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-(--color-text-muted) transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
    </>
  );
}

export function IntakeOption(props: IntakeOptionProps) {
  if (props.href) {
    return (
      <Link href={props.href} className={SHARED_CLASS}>
        <IntakeOptionContent {...props} />
      </Link>
    );
  }
  return (
    <button type="button" onClick={props.onClick} className={`cursor-pointer ${SHARED_CLASS}`}>
      <IntakeOptionContent {...props} />
    </button>
  );
}
