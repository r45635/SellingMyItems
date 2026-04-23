"use client";

import { useState, Children, isValidElement, cloneElement, type ReactElement } from "react";
import { Heart, Lock, Globe, KeyRound, Grid3x3 } from "lucide-react";

type Filter =
  | "all"
  | "favorites"
  | "invitation"
  | "public"
  | "accessRequired";

interface MyProjectsFiltersProps {
  children: React.ReactNode;
  labels: {
    filterAll: string;
    filterFavorites: string;
    filterInvitation: string;
    filterPublic: string;
    filterAccessRequired: string;
  };
}

export function MyProjectsFilters({ children, labels }: MyProjectsFiltersProps) {
  const [active, setActive] = useState<Filter>("all");

  const filters: { id: Filter; label: string; icon: React.ReactNode }[] = [
    { id: "all", label: labels.filterAll, icon: <Grid3x3 className="h-3.5 w-3.5" /> },
    {
      id: "favorites",
      label: labels.filterFavorites,
      icon: <Heart className="h-3.5 w-3.5" />,
    },
    {
      id: "invitation",
      label: labels.filterInvitation,
      icon: <Lock className="h-3.5 w-3.5" />,
    },
    {
      id: "public",
      label: labels.filterPublic,
      icon: <Globe className="h-3.5 w-3.5" />,
    },
    {
      id: "accessRequired",
      label: labels.filterAccessRequired,
      icon: <KeyRound className="h-3.5 w-3.5" />,
    },
  ];

  const filteredChildren = Children.toArray(children).filter((child) => {
    if (active === "all") return true;
    if (!isValidElement(child)) return true;
    const tagsAttr = (child.props as { "data-filter-tags"?: string })[
      "data-filter-tags"
    ];
    if (!tagsAttr) return false;
    const tags = tagsAttr.split(",");
    return tags.includes(active);
  });

  return (
    <>
      <div className="sticky top-0 z-10 -mx-4 md:-mx-6 mb-5 bg-background/95 backdrop-blur py-2 px-4 md:px-6 overflow-x-auto">
        <div className="flex gap-1.5 min-w-max">
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setActive(f.id)}
              className={`inline-flex items-center gap-1.5 h-8 rounded-full px-3 text-xs font-medium transition-colors border ${
                active === f.id
                  ? "bg-foreground text-background border-foreground"
                  : "bg-background text-muted-foreground hover:bg-muted border-border"
              }`}
            >
              {f.icon}
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filteredChildren.length === 0 ? (
          <div className="col-span-full rounded-xl border-2 border-dashed p-10 text-center text-sm text-muted-foreground">
            —
          </div>
        ) : (
          filteredChildren.map((child, i) => {
            if (!isValidElement(child)) return child;
            return cloneElement(child as ReactElement, { key: (child.key ?? i) as React.Key });
          })
        )}
      </div>
    </>
  );
}
