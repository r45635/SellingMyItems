"use client";

import { usePathname } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
}

const btnBase =
  "inline-flex items-center justify-center rounded-lg border text-sm font-medium transition-all select-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50";
const btnOutline = "border-input bg-background hover:bg-muted";
const btnActive = "border-transparent bg-primary text-primary-foreground";

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
}: PaginationProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (totalPages <= 1) return null;

  function buildHref(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (page <= 1) {
      params.delete("page");
    } else {
      params.set("page", String(page));
    }
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);

  // Build visible page numbers (max 5 centered around current)
  const pages: number[] = [];
  const maxVisible = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  const endPage = Math.min(totalPages, startPage + maxVisible - 1);
  if (endPage - startPage + 1 < maxVisible) {
    startPage = Math.max(1, endPage - maxVisible + 1);
  }
  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4">
      <p className="text-xs text-muted-foreground">
        {start}–{end} of {totalItems}
      </p>
      <div className="flex items-center gap-1">
        {currentPage > 1 ? (
          <a href={buildHref(currentPage - 1)} className={cn(btnBase, btnOutline, "h-7 w-7")}>
            <ChevronLeft className="h-4 w-4" />
          </a>
        ) : (
          <span className={cn(btnBase, btnOutline, "h-7 w-7 opacity-50 pointer-events-none")}>
            <ChevronLeft className="h-4 w-4" />
          </span>
        )}
        {pages.map((p) => (
          <a
            key={p}
            href={buildHref(p)}
            className={cn(
              btnBase,
              "h-7 min-w-7 px-2 text-xs",
              p === currentPage ? btnActive : btnOutline
            )}
          >
            {p}
          </a>
        ))}
        {currentPage < totalPages ? (
          <a href={buildHref(currentPage + 1)} className={cn(btnBase, btnOutline, "h-7 w-7")}>
            <ChevronRight className="h-4 w-4" />
          </a>
        ) : (
          <span className={cn(btnBase, btnOutline, "h-7 w-7 opacity-50 pointer-events-none")}>
            <ChevronRight className="h-4 w-4" />
          </span>
        )}
      </div>
    </div>
  );
}
