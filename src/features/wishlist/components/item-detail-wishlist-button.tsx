"use client";

import { useState, useTransition } from "react";
import { Heart, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  addWishlistItemAction,
  removeWishlistItemAction,
} from "@/features/wishlist/actions";
import { cn } from "@/lib/utils";

interface Props {
  itemId: string;
  initialIsWishlisted: boolean;
  returnPath: string;
  addLabel: string;
  removeLabel: string;
  addedToast?: string;
  removedToast?: string;
  className?: string;
}

/**
 * Full-width labelled wishlist toggle for the item detail page. Same server
 * actions as the heart button used in the items grid, but with optimistic
 * state and a button-shaped surface that fits next to the price block.
 */
export function ItemDetailWishlistButton({
  itemId,
  initialIsWishlisted,
  returnPath,
  addLabel,
  removeLabel,
  addedToast = "Added to wishlist",
  removedToast = "Removed from wishlist",
  className,
}: Props) {
  const [isWishlisted, setIsWishlisted] = useState(initialIsWishlisted);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (isPending) return;
    const nextWishlisted = !isWishlisted;
    setIsWishlisted(nextWishlisted);
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("itemId", itemId);
        formData.set("returnPath", returnPath);
        if (nextWishlisted) {
          await addWishlistItemAction(formData);
          toast.success(addedToast);
        } else {
          await removeWishlistItemAction(formData);
          toast.success(removedToast);
        }
      } catch {
        // Roll back optimistic state if the server action throws.
        setIsWishlisted(!nextWishlisted);
        toast.error("Could not update wishlist");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-pressed={isWishlisted}
      className={cn(
        "inline-flex w-full sm:w-auto h-11 items-center justify-center gap-2 rounded-lg border px-5 text-sm font-semibold transition-all",
        isWishlisted
          ? "border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100 dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-400"
          : "border-border bg-card hover:bg-muted hover:border-orange-200 dark:hover:border-orange-900",
        isPending && "opacity-70",
        className
      )}
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Heart className={cn("h-4 w-4", isWishlisted && "fill-current")} />
      )}
      {isWishlisted ? removeLabel : addLabel}
    </button>
  );
}
