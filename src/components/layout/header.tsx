"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { LanguageSwitcher } from "./language-switcher";
import { UserNav } from "./user-nav";
import { SmiLogo } from "@/components/shared/smi-logo";
import { BuildInfo } from "@/components/shared/build-info";

export function Header() {
  const t = useTranslations("nav");
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <Link href="/" className="mr-6 flex items-center">
          <SmiLogo size="sm" />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center space-x-6 text-sm font-medium">
          <Link href="/" className="transition-colors hover:text-foreground/80">
            {t("home")}
          </Link>
        </nav>

        <div className="flex flex-1 items-center justify-end space-x-2">
          <LanguageSwitcher />
          <UserNav />

          {/* Mobile menu */}
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger className="md:hidden inline-flex items-center justify-center rounded-lg p-2 hover:bg-muted">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Menu</span>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px]">
              <div className="mt-4 mb-6">
                <SmiLogo size="md" />
              </div>
              <nav className="flex flex-col space-y-4">
                <Link href="/" className="text-lg font-medium" onClick={() => setMenuOpen(false)}>
                  {t("home")}
                </Link>
                <Link href="/wishlist" className="text-lg font-medium" onClick={() => setMenuOpen(false)}>
                  {t("wishlist")}
                </Link>
                <Link href="/messages" className="text-lg font-medium" onClick={() => setMenuOpen(false)}>
                  {t("messages")}
                </Link>
              </nav>
              <div className="mt-auto pt-6 border-t">
                <BuildInfo />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
