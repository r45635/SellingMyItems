"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  FolderOpen,
  Mail,
  Shield,
} from "lucide-react";

const adminNavItems: readonly {
  href: string;
  icon: typeof LayoutDashboard;
  label: string;
  exact?: boolean;
  color: string;
}[] = [
  { href: "/admin", icon: LayoutDashboard, label: "Overview", exact: true, color: "text-orange-600" },
  { href: "/admin/accounts", icon: Users, label: "Accounts", color: "text-violet-600" },
  { href: "/admin/projects", icon: FolderOpen, label: "Projects", color: "text-sky-600" },
  { href: "/admin/emails", icon: Mail, label: "Emails", color: "text-emerald-600" },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-64 flex-col border-r bg-muted/30">
      <div className="p-5 border-b">
        <Link href="/admin" className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400">
            <Shield className="h-4 w-4" />
          </span>
          <span className="font-bold text-sm">Admin</span>
        </Link>
        <p className="text-xs text-muted-foreground mt-1.5 ml-9">
          Admin dashboard
        </p>
      </div>
      <nav className="flex-1 px-3 py-3 space-y-1">
        {adminNavItems.map((item) => {
          const isActive = item.exact
            ? pathname === item.href || pathname === `${item.href}/`
            : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors border",
                isActive
                  ? "bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-950/30 dark:border-orange-900 dark:text-orange-400"
                  : "border-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4",
                  isActive ? "text-orange-600 dark:text-orange-400" : item.color
                )}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
