"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
  FolderOpen,
  Package,
  MessageSquare,
  ShoppingCart,
  Settings,
} from "lucide-react";
import { SmiLogo } from "@/components/shared/smi-logo";

const sidebarItems = [
  { href: "/seller/projects", icon: FolderOpen, labelKey: "projects" },
  { href: "/seller/intents", icon: ShoppingCart, labelKey: "intents" },
  { href: "/seller/messages", icon: MessageSquare, labelKey: "messages" },
  { href: "/seller/settings", icon: Settings, labelKey: "settings" },
] as const;

export function SellerSidebar() {
  const t = useTranslations("seller");
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-64 flex-col border-r bg-muted/30">
      <div className="p-5 border-b">
        <Link href="/seller">
          <SmiLogo size="sm" />
        </Link>
        <p className="text-xs text-muted-foreground mt-1.5 ml-10">{t("dashboard")}</p>
      </div>
      <nav className="flex-1 px-3 py-3 space-y-1">
        {sidebarItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
