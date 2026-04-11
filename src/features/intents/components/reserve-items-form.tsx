"use client";

import { useTransition, useState } from "react";
import { reserveItemsFromIntentAction } from "../actions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface IntentItem {
  itemId: string;
  itemTitle: string;
  itemPrice: number | null;
  itemCurrency: string;
  itemStatus: string;
}

interface ReserveItemsFormProps {
  intentId: string;
  items: IntentItem[];
  labels: {
    reserveSelected: string;
    selectItems: string;
    reserving: string;
    itemUnavailable: string;
    reserved?: string;
  };
}

export function ReserveItemsForm({ intentId, items, labels }: ReserveItemsFormProps) {
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const availableItems = items.filter((i) => i.itemStatus === "available");

  function toggleItem(itemId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(availableItems.map((i) => i.itemId)));
  }

  function handleReserve() {
    if (selected.size === 0) return;
    startTransition(async () => {
      await reserveItemsFromIntentAction(intentId, Array.from(selected));
      toast.success(labels.reserved ?? "Items reserved");
    });
  }

  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs font-medium text-muted-foreground">{labels.selectItems}</p>
      <div className="space-y-1">
        {items.map((item) => {
          const isAvailable = item.itemStatus === "available";
          return (
            <label
              key={item.itemId}
              className={`flex items-center gap-2 rounded-md p-1.5 text-sm ${
                isAvailable ? "cursor-pointer hover:bg-muted" : "opacity-50 cursor-not-allowed"
              }`}
            >
              <input
                type="checkbox"
                checked={selected.has(item.itemId)}
                disabled={!isAvailable || isPending}
                onChange={() => toggleItem(item.itemId)}
                className="rounded border-gray-300"
              />
              <span className="flex-1">{item.itemTitle}</span>
              {!isAvailable && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                  {labels.itemUnavailable}
                </span>
              )}
              {item.itemPrice != null && (
                <span className="text-xs text-muted-foreground">
                  {item.itemPrice} {item.itemCurrency}
                </span>
              )}
            </label>
          );
        })}
      </div>
      {availableItems.length > 1 && (
        <Button
          type="button"
          variant="link"
          size="xs"
          onClick={selectAll}
          disabled={isPending}
        >
          Select all available
        </Button>
      )}
      <Button
        type="button"
        onClick={handleReserve}
        disabled={selected.size === 0 || isPending}
        className="bg-orange-600 text-white hover:bg-orange-700"
        size="sm"
      >
        {isPending ? labels.reserving : labels.reserveSelected} ({selected.size})
      </Button>
    </div>
  );
}
