import { type LucideIcon } from "lucide-react";
import { clsx } from "clsx";

const SIZE_CLASSES = {
  sm: "h-9 w-9 rounded-lg [&>svg]:h-4 [&>svg]:w-4",
  md: "h-10 w-10 rounded-xl [&>svg]:h-5 [&>svg]:w-5",
  lg: "h-12 w-12 rounded-2xl [&>svg]:h-5.5 [&>svg]:w-5.5",
  xl: "h-14 w-14 rounded-2xl [&>svg]:h-6 [&>svg]:w-6",
} as const satisfies Record<string, string>;

type IconBadgeProps = {
  icon: LucideIcon;
  size?: keyof typeof SIZE_CLASSES;
  colorToken?: string;
  colorHex?: string;
  className?: string;
};

export function IconBadge({ icon: Icon, size = "md", colorToken, colorHex, className }: IconBadgeProps) {
  const style = colorHex
    ? { backgroundColor: `${colorHex}1F`, color: colorHex }
    : undefined;

  return (
    <span
      className={clsx(
        "flex shrink-0 items-center justify-center",
        SIZE_CLASSES[size],
        !colorHex && colorToken && `bg-(${colorToken})/15 text-(${colorToken})`,
        className
      )}
      style={style}
      aria-hidden="true"
    >
      <Icon aria-hidden="true" />
    </span>
  );
}
