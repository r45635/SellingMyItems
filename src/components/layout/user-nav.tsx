"use client";

import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { User, LogOut, LayoutDashboard, Heart, MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";
import { signOutAction } from "@/lib/auth/actions";

type NavUser = {
  email: string;
  role: "purchaser" | "seller" | "admin";
};

export function UserNav() {
  const t = useTranslations();
  const [user, setUser] = useState<NavUser | null>(null);

  useEffect(() => {
    fetch("/api/dev-session")
      .then((response) => response.json())
      .then((data) => {
        if (data?.user) {
          setUser(data.user);
        }
      });
  }, []);

  if (!user) {
    return (
      <Link
        href="/login"
        className={buttonVariants({ variant: "ghost", size: "sm" })}
      >
        {t("common.signIn")}
      </Link>
    );
  }

  const initials =
    user.email
      ?.split("@")[0]
      .slice(0, 2)
      .toUpperCase() ?? "U";

  async function handleSignOut() {
    if (!user) return;
    await signOutAction();
    window.location.href = "/";
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="relative h-8 w-8 rounded-full inline-flex items-center justify-center hover:bg-muted">
        <Avatar className="h-8 w-8">
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end">
        <div className="flex items-center justify-start gap-2 p-2">
          <div className="flex flex-col space-y-1 leading-none">
            <p className="text-sm font-medium">{user.email}</p>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <Link href="/wishlist" className="flex items-center cursor-pointer w-full">
            <Heart className="mr-2 h-4 w-4" />
            {t("nav.wishlist")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Link href="/messages" className="flex items-center cursor-pointer w-full">
            <MessageSquare className="mr-2 h-4 w-4" />
            {t("nav.messages")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {user.role === "seller" ? (
          <DropdownMenuItem>
            <Link href="/seller" className="flex items-center cursor-pointer w-full">
              <LayoutDashboard className="mr-2 h-4 w-4" />
              {t("nav.sellerDashboard")}
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <Link href="/account" className="flex items-center cursor-pointer w-full">
            <User className="mr-2 h-4 w-4" />
            {t("nav.account")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
          <LogOut className="mr-2 h-4 w-4" />
          {t("common.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
