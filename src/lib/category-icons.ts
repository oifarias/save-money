import {
  Banknote,
  Briefcase,
  Car,
  Dumbbell,
  Gift,
  GraduationCap,
  HeartPulse,
  Home,
  Lightbulb,
  type LucideIcon,
  MoreHorizontal,
  PawPrint,
  Plane,
  Popcorn,
  Repeat,
  ShoppingBag,
  Smartphone,
  Sparkles,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  UtensilsCrossed,
  Car,
  Home,
  HeartPulse,
  Popcorn,
  GraduationCap,
  Repeat,
  MoreHorizontal,
  Banknote,
  Briefcase,
  ShoppingBag,
  Smartphone,
  Plane,
  Gift,
  Dumbbell,
  PawPrint,
  Lightbulb,
  Sparkles,
  Wallet,
};

export const CATEGORY_ICON_NAMES = Object.keys(CATEGORY_ICONS);

export function getCategoryIcon(name: string): LucideIcon {
  return CATEGORY_ICONS[name] ?? Wallet;
}
