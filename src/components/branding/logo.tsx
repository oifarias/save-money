import Image from "next/image";
import { clsx } from "clsx";

type LogoProps = {
  size?: number;
  className?: string;
  priority?: boolean;
};

export function Logo({ size = 32, className, priority = true }: LogoProps) {
  return (
    <Image
      src="/logo.svg"
      alt="Save Money"
      width={size}
      height={size}
      className={clsx("shrink-0", className)}
      priority={priority}
    />
  );
}
