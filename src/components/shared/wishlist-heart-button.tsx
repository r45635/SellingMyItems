"use client";

import { Heart } from "lucide-react";
import { useTransition, useState } from "react";
import { addWishlistItemAction, removeWishlistItemAction } from "@/features/wishlist/actions";
import { toast } from "sonner";

interface WishlistHeartButtonProps {
  itemId: string;
  isWishlisted: boolean;
  returnPath: string;
  addTitle?: string;
  removeTitle?: string;
  confirmRemoveMessage?: string;
  addedMessage?: string;
  removedMessage?: string;
}

export function WishlistHeartButton({
  itemId,
  isWishlisted: initialIsWishlisted,
  returnPath,
  addTitle = "Click to add to favorites",
  removeTitle = "Click to remove from favorites",
  confirmRemoveMessage = "Remove this item from your favorites?",
  addedMessage = "Added to wishlist",
  removedMessage = "Removed from wishlist",
}: WishlistHeartButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [optimisticWishlisted, setOptimisticWishlisted] = useState(initialIsWishlisted);

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (isPending) return;

    if (optimisticWishlisted) {
      if (!window.confirm(confirmRemoveMessage)) return;

      setOptimisticWishlisted(false);
      startTransition(async () => {
        const formData = new FormData();
        formData.set("itemId", itemId);
        formData.set("returnPath", returnPath);
        await removeWishlistItemAction(formData);
        toast.success(removedMessage);
      });
    } else {
      setOptimisticWishlisted(true);
      startTransition(async () => {
        const formData = new FormData();
        formData.set("itemId", itemId);
        formData.set("returnPath", returnPath);
        await addWishlistItemAction(formData);
        toast.success(addedMessage);
      });
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      title={optimisticWishlisted ? removeTitle : addTitle}
      className="absolute top-2 left-2 z-10 p-1 rounded-full transition-transform hover:scale-110 disabled:opacity-60"
      aria-label={optimisticWishlisted ? removeTitle : addTitle}
    >
      <Heart
        className={`h-5 w-5 drop-shadow transition-colors ${
          optimisticWishlisted
            ? "fill-red-500 text-red-500"
            : "fill-transparent text-white stroke-[2.5]"
        }`}
      />
    </button>
  );
}
