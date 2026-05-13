"use client";

import { useState, useMemo, useTransition } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { Clock, ImageOff, Loader2, User } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LocalizedDateTime } from "@/components/shared/localized-date-time";
import { BLUR_PLACEHOLDER } from "@/lib/image/placeholders";
import { SendRecapEmailForm } from "@/features/seller-dashboard/components/send-recap-email-form";
import { bulkUpdateReservedItemsAction } from "@/features/items/actions";

export interface BuyerItemData {
  id: string;
  title: string;
  price: number | null;
  currency: string | null;
  coverImageUrl: string | null;
}

export interface BuyerData {
  userId: string;
  realEmail: string;
  displayEmail: string;
  displayName: string | null;
  items: BuyerItemData[];
  lastRecapAt: string | null; // ISO string — safe to serialize across RSC boundary
}

export function ReservationsBulkPanel({
  buyers,
  projectId,
  locale,
}: {
  buyers: BuyerData[];
  projectId: string;
  locale: string;
}) {
  const t = useTranslations("seller");
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pendingAction, setPendingAction] = useState<"sold" | "available" | null>(null);
  const [note, setNote] = useState("");

  // Derive the active buyer from the current selection (single-buyer constraint).
  const activeBuyerId = useMemo<string | null>(() => {
    if (selected.size === 0) return null;
    const firstId = Array.from(selected)[0];
    for (const buyer of buyers) {
      if (buyer.items.some((i) => i.id === firstId)) return buyer.userId;
    }
    return null;
  }, [selected, buyers]);

  const selectedItems = useMemo(
    () => buyers.flatMap((b) => b.items).filter((i) => selected.has(i.id)),
    [selected, buyers]
  );

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

  function selectAllForBuyer(buyerId: string) {
    const buyer = buyers.find((b) => b.userId === buyerId);
    if (!buyer) return;
    setSelected(new Set(buyer.items.map((i) => i.id)));
  }

  function openActionForBuyer(buyerId: string, action: "sold" | "available") {
    selectAllForBuyer(buyerId);
    setPendingAction(action);
    setNote("");
  }

  function handleConfirm(withMessage: boolean) {
    const itemIds = Array.from(selected);
    const count = itemIds.length;
    startTransition(async () => {
      const result = await bulkUpdateReservedItemsAction(
        itemIds,
        projectId,
        pendingAction!,
        withMessage && note.trim() ? note.trim() : undefined
      );
      if (result && "error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(t("bulkActionDone", { count }));
      setSelected(new Set());
      setPendingAction(null);
      setNote("");
    });
  }

  function handleCancel() {
    setPendingAction(null);
    setNote("");
  }

  const hasSelection = selected.size > 0;

  return (
    <div className="space-y-6">
      {/* ── Sticky bulk action bar ────────────────────────────────── */}
      {hasSelection && (
        <div className="sticky top-2 z-10 rounded-xl border bg-card shadow-md px-4 py-3">
          {pendingAction === null ? (
            /* Selection summary + action triggers */
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm font-medium">
                {t("selectedCount", { count: selected.size })}
              </span>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelected(new Set())}
                  disabled={isPending}
                  aria-label="Clear selection"
                >
                  ✕
                </Button>
                <Button
                  size="sm"
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                  onClick={() => { setPendingAction("sold"); setNote(""); }}
                  disabled={isPending}
                >
                  {t("markAsSold")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setPendingAction("available"); setNote(""); }}
                  disabled={isPending}
                >
                  {t("releaseItems")}
                </Button>
              </div>
            </div>
          ) : (
            /* Confirmation zone */
            <div className="space-y-3">
              {/* Read-only item preview */}
              <div className="rounded-md bg-muted/50 px-3 py-2 space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {pendingAction === "sold" ? t("markAsSold") : t("releaseItems")}
                  {" — "}
                  {t("selectedCount", { count: selected.size })}
                </p>
                {selectedItems.map((item) => {
                  const priceStr =
                    item.price != null
                      ? new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", {
                          style: "currency",
                          currency: item.currency ?? "EUR",
                        }).format(item.price)
                      : null;
                  return (
                    <p key={item.id} className="text-xs text-muted-foreground">
                      {"• "}
                      {item.title}
                      {priceStr ? ` — ${priceStr}` : ""}
                    </p>
                  );
                })}
              </div>

              {/* Optional note for buyer */}
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t("buyerNotePlaceholder")}
                rows={2}
                className="resize-none text-sm"
                disabled={isPending}
              />

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                  onClick={() => handleConfirm(true)}
                  disabled={isPending || !note.trim()}
                >
                  {isPending && (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  )}
                  {t("confirmAndSend")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleConfirm(false)}
                  disabled={isPending}
                >
                  {isPending && (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  )}
                  {t("confirmWithoutMessage")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCancel}
                  disabled={isPending}
                >
                  {t("cancelAction")}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Buyer cards ───────────────────────────────────────────── */}
      {buyers.map((buyer) => {
        const buyerName =
          buyer.displayName || buyer.displayEmail || "Buyer";
        const total = buyer.items.reduce(
          (sum, i) => sum + (i.price ?? 0),
          0
        );
        const currency = buyer.items[0]?.currency ?? "USD";
        const formattedTotal = new Intl.NumberFormat(undefined, {
          style: "currency",
          currency,
        }).format(total);
        const lastRecapAt = buyer.lastRecapAt
          ? new Date(buyer.lastRecapAt)
          : null;
        // Dim cards belonging to a different buyer when a selection is active.
        const isLockedOut =
          activeBuyerId !== null && activeBuyerId !== buyer.userId;

        return (
          <div
            key={buyer.userId}
            className={`rounded-xl border bg-card overflow-hidden transition-opacity ${
              isLockedOut ? "opacity-40 pointer-events-none" : ""
            }`}
          >
            {/* Card header */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/50 px-5 py-4 border-b">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{buyerName}</p>
                  {buyer.displayName && buyer.displayEmail && (
                    <p className="text-xs text-muted-foreground">
                      {buyer.displayEmail}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Quick bulk-action buttons for this buyer */}
                <div className="flex gap-1.5">
                  <Button
                    size="xs"
                    variant="outline"
                    className="text-[11px]"
                    disabled={isPending}
                    onClick={() => openActionForBuyer(buyer.userId, "sold")}
                  >
                    {t("markAllSoldForBuyer")}
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    className="text-[11px]"
                    disabled={isPending}
                    onClick={() =>
                      openActionForBuyer(buyer.userId, "available")
                    }
                  >
                    {t("releaseAllForBuyer")}
                  </Button>
                </div>

                <div className="text-right">
                  <p className="text-xs text-muted-foreground">
                    {t("reservationItemCount", {
                      count: buyer.items.length,
                    })}
                  </p>
                  <p className="font-semibold text-sm">{formattedTotal}</p>
                </div>
              </div>
            </div>

            {/* Item rows with checkboxes */}
            <div className="divide-y">
              {buyer.items.map((item) => {
                const formattedPrice =
                  item.price != null
                    ? new Intl.NumberFormat(undefined, {
                        style: "currency",
                        currency: item.currency ?? "USD",
                      }).format(item.price)
                    : null;
                const isChecked = selected.has(item.id);

                return (
                  <label
                    key={item.id}
                    className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-muted/40"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={isPending}
                      onChange={() => toggleItem(item.id)}
                      className="rounded border-gray-300 shrink-0"
                    />
                    <div className="relative h-10 w-10 shrink-0 rounded-md overflow-hidden bg-muted">
                      {item.coverImageUrl ? (
                        <Image
                          src={item.coverImageUrl}
                          alt={item.title}
                          fill
                          className="object-cover"
                          sizes="40px"
                          loading="lazy"
                          placeholder="blur"
                          blurDataURL={BLUR_PLACEHOLDER}
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <ImageOff className="h-4 w-4 text-muted-foreground/40" />
                        </div>
                      )}
                    </div>
                    <p className="text-sm font-medium flex-1">{item.title}</p>
                    {formattedPrice && (
                      <span className="text-sm font-semibold text-primary">
                        {formattedPrice}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>

            {/* Footer: recap email */}
            <div className="px-5 py-4 border-t bg-muted/30 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  {t("recapEmailDescription")}
                </p>
                {lastRecapAt && (
                  <p className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {t("lastRecapSent")}:{" "}
                    <LocalizedDateTime value={lastRecapAt} />
                  </p>
                )}
              </div>
              <SendRecapEmailForm
                projectId={projectId}
                buyerUserId={buyer.userId}
                buyerName={buyerName}
                locale={locale}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
