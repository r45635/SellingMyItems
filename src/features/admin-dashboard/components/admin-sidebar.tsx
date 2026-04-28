"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { BarChart3, Users, FolderOpen, Shield, Mail } from "lucide-react";
import {
  NavIconBadge,
  TONE_STYLES,
  type IconTone,
} from "@/components/shared/nav-icon-badge";

const sidebarItems: readonly {
  href: string;
  icon: typeof BarChart3;
  label: string;
  exact?: boolean;
  tone: IconTone;
}[] = [
  { href: "/admin", icon: BarChart3, label: "Overview", exact: true, tone: "indigo" },
  { href: "/admin/accounts", icon: Users, label: "Accounts", tone: "violet" },
  { href: "/admin/projects", icon: FolderOpen, label: "Projects", tone: "brand" },
  { href: "/admin/emails", icon: Mail, label: "Emails", tone: "emerald" },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-64 flex-col border-r bg-muted/30">
      <div className="p-5 border-b">
        <Link href="/admin" className="flex items-center gap-2">
          <NavIconBadge Icon={Shield} tone="red" />
          <span className="font-bold text-sm">Admin</span>
        </Link>
        <p className="text-xs text-muted-foreground mt-1.5 ml-9">Admin dashboard</p>
      </div>
      <nav className="flex-1 px-3 py-3 space-y-1">
        {sidebarItems.map((item) => {
          const isActive = item.exact
            ? pathname === item.href || pathname === `${item.href}/`
            : pathname.startsWith(item.href);
          const tone = TONE_STYLES[item.tone];
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-2 py-2 text-sm font-medium transition-colors",
                isActive
                  ? `${tone.bgActive} ${tone.iconActive}`
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <NavIconBadge Icon={item.icon} tone={item.tone} active={isActive} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
