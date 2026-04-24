"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ItemTeaserCard } from "@/components/shared/item-teaser-card";
import { WishlistHeartButton } from "@/components/shared/wishlist-heart-button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Package, SlidersHorizontal } from "lucide-react";

export interface ProjectItem {
  id: string;
  title: string;
  coverImageUrl: string | null;
  status: "available" | "pending" | "reserved" | "sold" | "hidden";
  updatedAt: Date | string | null;
  viewCount: number;
  price: number | null;
  reservedForUserId: string | null;
}

interface ProjectItemsGridProps {
  items: ProjectItem[];
  slug: string;
  userId?: string;
  wishlistedItemIds: string[];
  labels: {
    addToFavorites: string;
    removeFromFavorites: string;
    confirmRemove: string;
    addedToWishlist: string;
    removedFromWishlist: string;
  };
}

type StatusFilter = "all" | "available" | "pending" | "reserved" | "sold";
type SortOption = "default" | "price-asc" | "price-desc" | "newest";

export function ProjectItemsGrid({
  items,
  slug,
  userId,
  wishlistedItemIds,
  labels,
}: ProjectItemsGridProps) {
  const t = useTranslations("project");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortOption, setSortOption] = useState<SortOption>("default");

  const wishlistedSet = useMemo(() => new Set(wishlistedItemIds), [wishlistedItemIds]);

  const filteredAndSorted = useMemo(() => {
    let result = items;

    // Filter by status
    if (statusFilter !== "all") {
      result = result.filter((item) => item.status === statusFilter);
    }

    // Sort
    if (sortOption === "price-asc") {
      result = [...result].sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
    } else if (sortOption === "price-desc") {
      result = [...result].sort((a, b) => (b.price ?? -1) - (a.price ?? -1));
    } else if (sortOption === "newest") {
      result = [...result].sort((a, b) => {
        const da = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const db = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return db - da;
      });
    }

    return result;
  }, [items, statusFilter, sortOption]);

  return (
    <>
      {/* Filter & Sort Bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-orange-500" />
          <h2 className="text-heading-4">
            {items.length} {t("itemCount", { count: items.length })}
          </h2>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground hidden sm:block" />

          <Select onValueChange={(v) => setStatusFilter((v ?? "all") as StatusFilter)} defaultValue="all">
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("filterAll")}</SelectItem>
              <SelectItem value="available">{t("filterAvailable")}</SelectItem>
              <SelectItem value="reserved">{t("filterReserved")}</SelectItem>
              <SelectItem value="sold">{t("filterSold")}</SelectItem>
            </SelectContent>
          </Select>

          <Select onValueChange={(v) => setSortOption((v ?? "default") as SortOption)} defaultValue="default">
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">{t("sortDefault")}</SelectItem>
              <SelectItem value="price-asc">{t("sortPriceAsc")}</SelectItem>
              <SelectItem value="price-desc">{t("sortPriceDesc")}</SelectItem>
              <SelectItem value="newest">{t("sortNewest")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Filtered count badge when filter is active */}
      {statusFilter !== "all" && (
        <div className="mb-3">
          <Badge variant="secondary" className="text-xs">
            {filteredAndSorted.length} / {items.length}
          </Badge>
        </div>
      )}

      {/* Items Grid */}
      {filteredAndSorted.length > 0 ? (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 stagger-fade-in">
          {filteredAndSorted.map((item) => (
            <ItemTeaserCard
              key={item.id}
              title={item.title}
              coverImageUrl={item.coverImageUrl}
              status={item.status}
              updatedAt={item.updatedAt}
              viewCount={item.viewCount}
              href={`/project/${slug}/item/${item.id}`}
              isWishlisted={wishlistedSet.has(item.id)}
              isReservedForCurrentUser={item.status === "reserved" && item.reservedForUserId === userId}
              wishlistButton={
                <WishlistHeartButton
                  itemId={item.id}
                  isWishlisted={wishlistedSet.has(item.id)}
                  returnPath={`/project/${slug}`}
                  addTitle={labels.addToFavorites}
                  removeTitle={labels.removeFromFavorites}
                  confirmRemoveMessage={labels.confirmRemove}
                  addedMessage={labels.addedToWishlist}
                  removedMessage={labels.removedFromWishlist}
                />
              }
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-10 text-muted-foreground">
          <Package className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
          <p className="text-sm">{t("noMatchingItems")}</p>
        </div>
      )}
    </>
  );
}
