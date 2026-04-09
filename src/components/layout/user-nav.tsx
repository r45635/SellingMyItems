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
import { Badge } from "@/components/ui/badge";

type NavUser = {
  email: string;
  role: "purchaser" | "seller" | "admin";
};

export function UserNav() {
  const t = useTranslations();
  const [user, setUser] = useState<NavUser | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetch("/api/dev-session")
      .then((response) => response.json())
      .then((data) => {
        if (data?.user) {
          setUser(data.user);
        }
      });
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    fetch("/api/messages/unread", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        setUnreadCount(Number(data?.unreadCount ?? 0));
      })
      .catch(() => {
        setUnreadCount(0);
      });
  }, [user]);

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

  const messagesHref = user.role === "seller" ? "/seller/messages" : "/messages";
  const hasUnread = unreadCount > 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="relative h-8 w-8 rounded-full inline-flex items-center justify-center hover:bg-muted">
        {hasUnread ? (
          <span className="absolute left-0 top-0 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-background" />
        ) : null}
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
          <Link href={messagesHref} className="flex items-center justify-between cursor-pointer w-full gap-2">
            <MessageSquare className="mr-2 h-4 w-4" />
            <span className="flex-1">{t("nav.messages")}</span>
            {hasUnread ? <Badge variant="destructive">{t("messages.new")}</Badge> : null}
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
