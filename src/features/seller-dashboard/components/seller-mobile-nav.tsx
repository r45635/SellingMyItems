"use client";

import { useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  FolderOpen,
  Menu,
  MessageSquare,
  ShoppingCart,
  Settings,
} from "lucide-react";
import { SmiLogo } from "@/components/shared/smi-logo";
import {
  NavIconBadge,
  TONE_STYLES,
  type IconTone,
} from "@/components/shared/nav-icon-badge";

const sidebarItems: ReadonlyArray<{
  href: string;
  icon: typeof FolderOpen;
  labelKey: "projects" | "intents" | "messages" | "settings";
  tone: IconTone;
}> = [
  { href: "/seller/projects", icon: FolderOpen, labelKey: "projects", tone: "brand" },
  { href: "/seller/intents", icon: ShoppingCart, labelKey: "intents", tone: "amber" },
  { href: "/seller/messages", icon: MessageSquare, labelKey: "messages", tone: "emerald" },
  { href: "/seller/settings", icon: Settings, labelKey: "settings", tone: "violet" },
];

export function SellerMobileNav() {
  const t = useTranslations("seller");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex md:hidden items-center border-b px-4 h-14">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Menu</span>
            </Button>
          }
        />
        <SheetContent side="left" className="w-[260px] p-0">
          <div className="p-5 border-b">
            <Link href="/seller" onClick={() => setOpen(false)}>
              <SmiLogo size="sm" />
            </Link>
            <p className="text-xs text-muted-foreground mt-1.5 ml-10">
              {t("dashboard")}
            </p>
          </div>
          <nav className="px-3 py-3 space-y-1">
            {sidebarItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              const tone = TONE_STYLES[item.tone];
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-2 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? `${tone.bgActive} ${tone.iconActive}`
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <NavIconBadge Icon={item.icon} tone={item.tone} active={isActive} />
                  <span>{t(item.labelKey)}</span>
                </Link>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>
      <Link href="/seller" className="ml-2">
        <SmiLogo size="sm" />
      </Link>
    </div>
  );
}
