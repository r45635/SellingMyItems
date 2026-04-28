"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const CLAMP_BY_LINES: Record<number, string> = {
  2: "line-clamp-2",
  3: "line-clamp-3",
  4: "line-clamp-4",
  5: "line-clamp-5",
  6: "line-clamp-6",
};

interface Props {
  text: string;
  maxLines?: 2 | 3 | 4 | 5 | 6;
  expandLabel: string;
  collapseLabel: string;
  className?: string;
}

export function ExpandableText({
  text,
  maxLines = 4,
  expandLabel,
  collapseLabel,
  className,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={className}>
      <p
        className={cn(
          "text-sm leading-relaxed whitespace-pre-line",
          !expanded && CLAMP_BY_LINES[maxLines]
        )}
      >
        {text}
      </p>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="text-xs font-semibold text-orange-600 mt-1 hover:underline"
      >
        {expanded ? `${collapseLabel} ↑` : `${expandLabel} ↓`}
      </button>
    </div>
  );
}
