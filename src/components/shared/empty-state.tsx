import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  tone?: "default" | "muted";
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  tone = "default",
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-12 text-center",
        tone === "muted" ? "bg-muted/30" : "bg-card",
        className
      )}
    >
      {Icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-orange-100 text-orange-600 dark:bg-orange-950/50 dark:text-orange-400 ring-8 ring-orange-50/60 dark:ring-orange-950/20">
          <Icon className="h-6 w-6" />
        </div>
      )}
      <h3 className="text-base font-semibold tracking-tight text-foreground">
        {title}
      </h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
