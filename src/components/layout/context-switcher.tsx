"use client";

import { useEffect, useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { ShoppingCart, Tag, Shield } from "lucide-react";

type Capabilities = {
  buyer: boolean;
  seller: boolean;
  admin: boolean;
};

type Context = "buyer" | "seller" | "admin";

const CONTEXT_HOME: Record<Context, string> = {
  buyer: "/",
  seller: "/seller",
  admin: "/admin",
};

/**
 * Pill-style switcher that lets multi-capability users hop between the
 * buyer / seller / admin environments. Hidden for users with a single
 * capability (a brand-new buyer sees nothing — no clutter). The "active"
 * state is derived from the URL pathname, which is the source of truth:
 * /seller* → seller, /admin* → admin, anything else → buyer. No cookie
 * needed; the URL itself locks the context.
 */
export function ContextSwitcher() {
  const t = useTranslations("context");
  const pathname = usePathname();
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [unread, setUnread] = useState({ buyer: 0, seller: 0 });

  useEffect(() => {
    fetch("/api/dev-session")
      .then((r) => r.json())
      .then((data) => {
        if (data?.capabilities) setCaps(data.capabilities);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!caps) return;
    fetch("/api/messages/unread", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        setUnread({
          buyer: Number(data?.buyerUnread ?? 0),
          seller: Number(data?.sellerUnread ?? 0),
        });
      })
      .catch(() => {});
  }, [caps]);

  if (!caps) return null;

  const availableContexts: Context[] = [
    "buyer",
    ...(caps.seller ? (["seller"] as const) : []),
    ...(caps.admin ? (["admin"] as const) : []),
  ];

  // Single-capability user → no switcher, no friction. Selling onboarding
  // happens through the home/nav CTAs instead.
  if (availableContexts.length < 2) return null;

  const active: Context = pathname.startsWith("/admin")
    ? "admin"
    : pathname.startsWith("/seller")
      ? "seller"
      : "buyer";

  const meta: Record<
    Context,
    { label: string; icon: typeof ShoppingCart; activeClass: string }
  > = {
    buyer: {
      label: t("buyer"),
      icon: ShoppingCart,
      activeClass:
        "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    },
    seller: {
      label: t("seller"),
      icon: Tag,
      activeClass:
        "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300",
    },
    admin: {
      label: t("admin"),
      icon: Shield,
      activeClass:
        "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
    },
  };

  return (
    <div className="hidden sm:inline-flex items-center gap-0.5 rounded-full border bg-muted/40 p-0.5">
      {availableContexts.map((ctx) => {
        const m = meta[ctx];
        const Icon = m.icon;
        const isActive = active === ctx;
        const hasUnread =
          (ctx === "buyer" && unread.buyer > 0) ||
          (ctx === "seller" && unread.seller > 0);
        return (
          <Link
            key={ctx}
            href={CONTEXT_HOME[ctx]}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "relative inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
              isActive
                ? m.activeClass
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{m.label}</span>
            {hasUnread && !isActive && (
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-background" />
            )}
          </Link>
        );
      })}
    </div>
  );
}
