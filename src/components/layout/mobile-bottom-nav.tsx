"use client";

import { useEffect, useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Home, Heart, MessageCircle, Store, User } from "lucide-react";
import {
  NavIconBadge,
  TONE_STYLES,
  type IconTone,
} from "@/components/shared/nav-icon-badge";

type Tab = {
  href: string;
  icon: typeof Home;
  labelKey:
    | "home"
    | "wishlist"
    | "messages"
    | "myListings"
    | "account";
  tone: IconTone;
};

// 5 tabs: keep the action surface flat. Each tab keeps its own colour
// identity so the bottom nav reads at a glance even on a small screen.
const navItems: readonly Tab[] = [
  { href: "/", icon: Home, labelKey: "home", tone: "brand" },
  { href: "/wishlist", icon: Heart, labelKey: "wishlist", tone: "rose" },
  { href: "/messages", icon: MessageCircle, labelKey: "messages", tone: "emerald" },
  { href: "/seller", icon: Store, labelKey: "myListings", tone: "sky" },
  { href: "/account", icon: User, labelKey: "account", tone: "violet" },
];

export function MobileBottomNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetch("/api/dev-session")
      .then((r) => r.json())
      .then((data) => {
        if (data?.user) setUser(data.user);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) return;
    fetch("/api/messages/unread", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => setUnreadCount(Number(data?.unreadCount ?? 0)))
      .catch(() => {});
  }, [user]);

  if (!user) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex md:hidden border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
      {navItems.map((item) => {
        const isActive =
          item.href === "/"
            ? pathname === "/" || pathname === ""
            : pathname.startsWith(item.href);
        const tone = TONE_STYLES[item.tone];

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[10px] font-medium transition-colors",
              isActive ? tone.iconActive : "text-muted-foreground"
            )}
          >
            <span className="relative">
              <NavIconBadge Icon={item.icon} tone={item.tone} active={isActive} />
              {item.labelKey === "messages" && unreadCount > 0 && (
                <span className="absolute -top-1 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white ring-2 ring-background">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </span>
            <span>{t(item.labelKey)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
