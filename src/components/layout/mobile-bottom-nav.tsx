"use client";

import { useEffect, useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Home, Heart, MessageCircle, User } from "lucide-react";

const navItems = [
  { href: "/", icon: Home, labelKey: "home" },
  { href: "/wishlist", icon: Heart, labelKey: "wishlist" },
  { href: "/messages", icon: MessageCircle, labelKey: "messages" },
  { href: "/account", icon: User, labelKey: "account" },
] as const;

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
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex md:hidden border-t bg-background">
      {navItems.map((item) => {
        const isActive =
          item.href === "/"
            ? pathname === "/" || pathname === ""
            : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
              isActive
                ? "text-primary"
                : "text-muted-foreground"
            )}
          >
            <div className="relative">
              <item.icon className="h-5 w-5" />
              {item.labelKey === "messages" && unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </div>
            <span>{t(item.labelKey)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
