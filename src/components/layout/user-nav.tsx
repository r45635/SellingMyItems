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
import { User, LogOut, LayoutDashboard, Heart, MessageSquare, Shield, Package, ShoppingBag, FolderKanban, Bell } from "lucide-react";
import { useEffect, useState } from "react";
import { signOutAction } from "@/lib/auth/actions";
import { Badge } from "@/components/ui/badge";
import { NavIconBadge } from "@/components/shared/nav-icon-badge";

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

  // Buyers and sellers share one inbox at /messages now that selling is
  // open to everyone. Sellers had a separate /seller/messages view that
  // we keep around for the dashboard, but the avatar dropdown points to
  // the buyer inbox for everyone — it's the canonical conversation list.
  const messagesHref = "/messages";
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
          <Link href="/my-projects" className="flex items-center gap-2 cursor-pointer w-full">
            <NavIconBadge Icon={FolderKanban} tone="brand" />
            <span>{t("myProjects.title")}</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Link href="/notifications" className="flex items-center gap-2 cursor-pointer w-full">
            <NavIconBadge Icon={Bell} tone="amber" />
            <span>Notifications</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Link href="/wishlist" className="flex items-center gap-2 cursor-pointer w-full">
            <NavIconBadge Icon={Heart} tone="rose" />
            <span>{t("nav.wishlist")}</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Link href="/reservations" className="flex items-center gap-2 cursor-pointer w-full">
            <NavIconBadge Icon={Package} tone="amber" />
            <span>{t("nav.reservations")}</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Link href="/purchases" className="flex items-center gap-2 cursor-pointer w-full">
            <NavIconBadge Icon={ShoppingBag} tone="emerald" />
            <span>{t("nav.purchases")}</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Link href={messagesHref} className="flex items-center gap-2 cursor-pointer w-full">
            <NavIconBadge Icon={MessageSquare} tone="emerald" />
            <span className="flex-1">{t("nav.messages")}</span>
            {hasUnread ? <Badge variant="destructive">{t("messages.new")}</Badge> : null}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {/* "My listings" is now visible to every signed-in user — selling
            isn't gated by role anymore. The first project they create
            lazily mints their seller account; admin still validates each
            project before it goes public. */}
        <DropdownMenuItem>
          <Link href="/seller" className="flex items-center gap-2 cursor-pointer w-full">
            <NavIconBadge Icon={LayoutDashboard} tone="sky" />
            <span>{t("nav.myListings")}</span>
          </Link>
        </DropdownMenuItem>
        {user.role === "admin" ? (
          <DropdownMenuItem>
            <Link href="/admin" className="flex items-center gap-2 cursor-pointer w-full">
              <NavIconBadge Icon={Shield} tone="red" />
              <span>{t("nav.adminDashboard")}</span>
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <Link href="/account" className="flex items-center gap-2 cursor-pointer w-full">
            <NavIconBadge Icon={User} tone="violet" />
            <span>{t("nav.account")}</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleSignOut} className="flex items-center gap-2 cursor-pointer">
          <NavIconBadge Icon={LogOut} tone="neutral" />
          <span>{t("common.signOut")}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
