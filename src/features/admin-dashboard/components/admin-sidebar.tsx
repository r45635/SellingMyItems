"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  Users,
  FolderOpen,
  Shield,
} from "lucide-react";

const sidebarItems: readonly {
  href: string;
  icon: typeof BarChart3;
  label: string;
  exact?: boolean;
}[] = [
  { href: "/admin", icon: BarChart3, label: "Overview", exact: true },
  { href: "/admin/accounts", icon: Users, label: "Accounts" },
  { href: "/admin/projects", icon: FolderOpen, label: "Projects" },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-64 flex-col border-r bg-muted/30">
      <div className="p-5 border-b">
        <Link href="/admin" className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-red-500" />
          <span className="font-bold text-sm">Admin</span>
        </Link>
        <p className="text-xs text-muted-foreground mt-1.5 ml-7">Admin dashboard</p>
      </div>
      <nav className="flex-1 px-3 py-3 space-y-1">
        {sidebarItems.map((item) => {
          const isActive = item.exact
            ? pathname === item.href || pathname === `${item.href}/`
            : pathname.startsWith(item.href);
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
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
