import type { ComponentType, SVGProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Shared color identity used across the app's navigation surfaces — bottom
 * nav tabs, avatar dropdown items, sidebars, etc. Each "tone" maps to a
 * tailwind colour family with light/dark backgrounds. Picking one tone per
 * concept keeps the visual system coherent (orange = home/items, rose =
 * wishlist, emerald = messages, sky = sell, violet = account, …).
 */
export type IconTone =
  | "brand"
  | "rose"
  | "emerald"
  | "sky"
  | "violet"
  | "amber"
  | "indigo"
  | "red"
  | "neutral";

export const TONE_STYLES: Record<
  IconTone,
  { bg: string; bgActive: string; icon: string; iconActive: string }
> = {
  brand: {
    bg: "bg-orange-100/70 dark:bg-orange-950/30",
    bgActive: "bg-orange-100 dark:bg-orange-950/50",
    icon: "text-orange-600 dark:text-orange-300",
    iconActive: "text-orange-700 dark:text-orange-200",
  },
  rose: {
    bg: "bg-rose-100/70 dark:bg-rose-950/30",
    bgActive: "bg-rose-100 dark:bg-rose-950/50",
    icon: "text-rose-600 dark:text-rose-300",
    iconActive: "text-rose-700 dark:text-rose-200",
  },
  emerald: {
    bg: "bg-emerald-100/70 dark:bg-emerald-950/30",
    bgActive: "bg-emerald-100 dark:bg-emerald-950/50",
    icon: "text-emerald-600 dark:text-emerald-300",
    iconActive: "text-emerald-700 dark:text-emerald-200",
  },
  sky: {
    bg: "bg-sky-100/70 dark:bg-sky-950/30",
    bgActive: "bg-sky-100 dark:bg-sky-950/50",
    icon: "text-sky-600 dark:text-sky-300",
    iconActive: "text-sky-700 dark:text-sky-200",
  },
  violet: {
    bg: "bg-violet-100/70 dark:bg-violet-950/30",
    bgActive: "bg-violet-100 dark:bg-violet-950/50",
    icon: "text-violet-600 dark:text-violet-300",
    iconActive: "text-violet-700 dark:text-violet-200",
  },
  amber: {
    bg: "bg-amber-100/70 dark:bg-amber-950/30",
    bgActive: "bg-amber-100 dark:bg-amber-950/50",
    icon: "text-amber-600 dark:text-amber-300",
    iconActive: "text-amber-700 dark:text-amber-200",
  },
  indigo: {
    bg: "bg-indigo-100/70 dark:bg-indigo-950/30",
    bgActive: "bg-indigo-100 dark:bg-indigo-950/50",
    icon: "text-indigo-600 dark:text-indigo-300",
    iconActive: "text-indigo-700 dark:text-indigo-200",
  },
  red: {
    bg: "bg-red-100/70 dark:bg-red-950/30",
    bgActive: "bg-red-100 dark:bg-red-950/50",
    icon: "text-red-600 dark:text-red-300",
    iconActive: "text-red-700 dark:text-red-200",
  },
  neutral: {
    bg: "bg-muted/70 dark:bg-muted/40",
    bgActive: "bg-muted dark:bg-muted/70",
    icon: "text-muted-foreground",
    iconActive: "text-foreground",
  },
};

/**
 * A small colored container for a Lucide icon. Defaults to a 28px square
 * with rounded-md corners — the right size for inline menu items.
 */
export function NavIconBadge({
  Icon,
  tone,
  active = false,
  size = "sm",
  className,
}: {
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  tone: IconTone;
  active?: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  const style = TONE_STYLES[tone];
  const dim = size === "sm" ? "h-7 w-7" : "h-9 w-9";
  const iconDim = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md transition-colors",
        dim,
        active ? style.bgActive : style.bg,
        className
      )}
      aria-hidden
    >
      <Icon className={cn(iconDim, active ? style.iconActive : style.icon)} />
    </span>
  );
}
