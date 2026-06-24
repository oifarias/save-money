import type { LucideIcon } from "lucide-react";
import { ArrowLeftRight, BarChart3, LayoutDashboard, Lightbulb, Sparkles, Tags, Target } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/lancamentos", label: "Lançamentos", icon: ArrowLeftRight },
  { href: "/metas", label: "Metas", icon: Target },
  { href: "/desejos", label: "Desejos", icon: Sparkles },
  { href: "/comparativo", label: "Comparativo", icon: BarChart3 },
  { href: "/insights", label: "Insights", icon: Lightbulb },
  { href: "/grupos", label: "Grupos", icon: Tags },
];

export const MOBILE_NAV_ITEMS: NavItem[] = NAV_ITEMS;
