import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/db";
import { buyerWishlistItems, buyerWishlists, items, projects } from "@/db/schema";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { Link } from "@/i18n/navigation";
import { removeWishlistItemAction } from "@/features/wishlist/actions";
import { IntentSubmitDialog } from "@/features/intents/components/intent-submit-dialog";
import Image from "next/image";
import { ImageOff, Tag } from "lucide-react";
import { BLUR_PLACEHOLDER } from "@/lib/image/placeholders";
import { Badge } from "@/components/ui/badge";

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
}

function computeSummary(
  items: { itemPrice: number | null; itemOriginalPrice: number | null; itemCurrency: string }[]
) {
  // Group by currency
  const byCurrency = new Map<string, { selling: number; original: number; count: number }>();
  for (const item of items) {
    const curr = item.itemCurrency;
    if (!byCurrency.has(curr)) byCurrency.set(curr, { selling: 0, original: 0, count: 0 });
    const entry = byCurrency.get(curr)!;
    entry.count++;
    if (item.itemPrice != null) entry.selling += item.itemPrice;
    if (item.itemOriginalPrice != null) entry.original += item.itemOriginalPrice;
    else if (item.itemPrice != null) entry.original += item.itemPrice; // fallback: no discount
  }
  return byCurrency;
}

export default async function WishlistPage() {
  const t = await getTranslations("wishlist");
  const tItem = await getTranslations("item");
  const tIntent = await getTranslations("intent");
  const user = await requireUser();

  const profileId = user.id;

  const wishlists = await db
    .select({ id: buyerWishlists.id, projectId: buyerWishlists.projectId })
    .from(buyerWishlists)
    .where(eq(buyerWishlists.userId, profileId));

  const wishlistIds = wishlists.map((wishlist) => wishlist.id);

  const rows = wishlistIds.length
    ? await db
        .select({
          itemId: items.id,
          itemTitle: items.title,
          itemStatus: items.status,
          itemPrice: items.price,
          itemOriginalPrice: items.originalPrice,
          itemCurrency: items.currency,
          itemCoverImageUrl: items.coverImageUrl,
          projectId: projects.id,
          projectSlug: projects.slug,
          projectName: projects.name,
        })
        .from(buyerWishlistItems)
        .innerJoin(items, eq(buyerWishlistItems.itemId, items.id))
        .innerJoin(projects, eq(items.projectId, projects.id))
        .where(
          and(
            inArray(buyerWishlistItems.wishlistId, wishlistIds),
            isNull(items.deletedAt),
            isNull(projects.deletedAt)
          )
        )
    : [];

  // Group items by project
  const byProject = new Map<
    string,
    { projectName: string; projectSlug: string; items: typeof rows }
  >();

  for (const row of rows) {
    if (!byProject.has(row.projectId)) {
      byProject.set(row.projectId, {
        projectName: row.projectName,
        projectSlug: row.projectSlug,
        items: [],
      });
    }
    byProject.get(row.projectId)!.items.push(row);
  }

  // Global summary
  const globalSummary = computeSummary(rows);

  return (
    <div className="container px-4 md:px-6 py-6">
      <h1 className="text-2xl font-bold mb-4">{t("title")}</h1>

      {rows.length === 0 ? (
        <div className="rounded-lg border p-6 text-center text-muted-foreground">
          {t("empty")}
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(byProject.entries()).map(
            ([projectId, { projectName, projectSlug, items: projectItems }]) => {
              const projectSummary = computeSummary(projectItems);

              return (
                <div key={projectId} className="space-y-3">
                  <h2 className="text-lg font-semibold">
                    <Link
                      href={`/project/${projectSlug}`}
                      className="hover:underline"
                    >
                      {projectName}
                    </Link>
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      {t("itemCount", { count: projectItems.length })}
                    </span>
                  </h2>

                  <div className="space-y-2">
                    {projectItems.map((row) => {
                      const hasDiscount =
                        row.itemOriginalPrice != null &&
                        row.itemPrice != null &&
                        row.itemOriginalPrice > row.itemPrice;
                      const discountPct = hasDiscount
                        ? Math.round(
                            ((row.itemOriginalPrice! - row.itemPrice!) /
                              row.itemOriginalPrice!) *
                              100
                          )
                        : null;

                      const isUnavailable = row.itemStatus === "reserved" || row.itemStatus === "sold";

                      return (
                        <div
                          key={row.itemId}
                          className={`rounded-lg border p-3 flex items-center gap-3 ${
                            row.itemStatus === "sold"
                              ? "opacity-60 border-gray-300 bg-gray-50 dark:bg-gray-900/30"
                              : row.itemStatus === "reserved"
                                ? "border-red-300 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20"
                                : ""
                          }`}
                        >
                          {/* Thumbnail */}
                          <Link
                            href={`/project/${row.projectSlug}/item/${row.itemId}`}
                            className="shrink-0"
                          >
                            <div className="relative w-14 h-14 rounded-md overflow-hidden bg-muted">
                              {row.itemCoverImageUrl ? (
                                <Image
                                  src={row.itemCoverImageUrl}
                                  alt={row.itemTitle}
                                  fill
                                  className="object-cover"
                                  sizes="56px"
                                  loading="lazy"
                                  placeholder="blur"
                                  blurDataURL={BLUR_PLACEHOLDER}
                                />
                              ) : (
                                <div className="flex items-center justify-center h-full">
                                  <ImageOff className="h-5 w-5 text-muted-foreground/40" />
                                </div>
                              )}
                            </div>
                          </Link>

                          {/* Title + status */}
                          <div className="flex-1 min-w-0">
                            <Link
                              href={`/project/${row.projectSlug}/item/${row.itemId}`}
                              className="font-medium hover:underline line-clamp-1 text-sm"
                            >
                              {row.itemTitle}
                            </Link>
                            <div className="flex items-center gap-2 mt-0.5">
                              {row.itemStatus === "reserved" ? (
                                <Badge className="bg-red-600 text-white border-red-600 hover:bg-red-600 font-bold text-[10px] px-2 py-0.5">
                                  {tItem("reserved")}
                                </Badge>
                              ) : row.itemStatus === "sold" ? (
                                <Badge className="bg-gray-900 text-white border-gray-900 hover:bg-gray-900 font-bold text-[10px] px-2 py-0.5">
                                  {tItem("sold")}
                                </Badge>
                              ) : (
                                <p className="text-xs text-muted-foreground">
                                  {tItem(row.itemStatus)}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Prices */}
                          <div className="shrink-0 text-right">
                            {row.itemPrice != null && (
                              <p className="font-bold text-primary text-sm">
                                {formatCurrency(row.itemPrice, row.itemCurrency)}
                              </p>
                            )}
                            {hasDiscount && (
                              <div className="flex items-center justify-end gap-1.5">
                                <p className="text-xs text-muted-foreground line-through">
                                  {formatCurrency(row.itemOriginalPrice!, row.itemCurrency)}
                                </p>
                                <span className="inline-flex items-center rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-1.5 py-0.5 text-[10px] font-semibold">
                                  -{discountPct}%
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Remove */}
                          <form action={removeWishlistItemAction} className="shrink-0">
                            <input type="hidden" name="itemId" value={row.itemId} />
                            <input type="hidden" name="returnPath" value="/wishlist" />
                            <button
                              type="submit"
                              className="inline-flex h-8 items-center justify-center rounded-lg border border-border px-2.5 text-sm hover:bg-muted"
                            >
                              {t("removeItem")}
                            </button>
                          </form>
                        </div>
                      );
                    })}
                  </div>

                  {/* Project subtotal */}
                  {Array.from(projectSummary.entries()).map(([currency, totals]) => {
                    const hasSavings = totals.original > totals.selling;
                    const savedAmount = totals.original - totals.selling;
                    const savedPct = hasSavings
                      ? Math.round((savedAmount / totals.original) * 100)
                      : 0;

                    return (
                      <div
                        key={currency}
                        className="rounded-lg bg-muted/50 px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-sm"
                      >
                        <div className="flex items-center gap-4">
                          <span>
                            <span className="text-muted-foreground">{t("sellingPrice")}:</span>{" "}
                            <span className="font-bold text-primary">
                              {formatCurrency(totals.selling, currency)}
                            </span>
                          </span>
                          {hasSavings && (
                            <span>
                              <span className="text-muted-foreground">{t("originalValue")}:</span>{" "}
                              <span className="line-through text-muted-foreground">
                                {formatCurrency(totals.original, currency)}
                              </span>
                            </span>
                          )}
                        </div>
                        {hasSavings && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2.5 py-1 text-xs font-semibold">
                            <Tag className="h-3 w-3" />
                            {t("savings")} {formatCurrency(savedAmount, currency)} (-{savedPct}%)
                          </span>
                        )}
                      </div>
                    );
                  })}

                  {/* Intent submission dialog for this project */}
                  <IntentSubmitDialog
                    projectId={projectId}
                    items={projectItems.map((row) => ({
                      itemId: row.itemId,
                      itemTitle: row.itemTitle,
                      itemStatus: row.itemStatus,
                    }))}
                    labels={{
                      sendIntent: t("sendIntent"),
                      phone: tIntent("phone"),
                      optional: tIntent("optional"),
                      pickupNotes: tIntent("pickupNotes"),
                      submit: tIntent("submit"),
                      submitted: tIntent("submitted"),
                      unavailableItemsWarning: t("unavailableItemsWarning", {
                        count: projectItems.filter((r) => r.itemStatus !== "available").length,
                      }),
                      noAvailableItems: t("noAvailableItems"),
                    }}
                  />
                </div>
              );
            }
          )}

          {/* Global summary card */}
          <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-4 space-y-3">
            <h3 className="font-bold text-lg">{t("summaryTitle")}</h3>
            <p className="text-sm text-muted-foreground">
              {t("itemCount", { count: rows.length })}
            </p>
            {Array.from(globalSummary.entries()).map(([currency, totals]) => {
              const hasSavings = totals.original > totals.selling;
              const savedAmount = totals.original - totals.selling;
              const savedPct = hasSavings
                ? Math.round((savedAmount / totals.original) * 100)
                : 0;

              return (
                <div key={currency} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-muted-foreground text-sm">{t("sellingPrice")}</span>
                    <span className="text-2xl font-bold text-primary">
                      {formatCurrency(totals.selling, currency)}
                    </span>
                  </div>
                  {hasSavings && (
                    <>
                      <div className="flex items-baseline justify-between gap-4">
                        <span className="text-muted-foreground text-sm">{t("originalValue")}</span>
                        <span className="text-lg text-muted-foreground line-through">
                          {formatCurrency(totals.original, currency)}
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between gap-4">
                        <span className="text-muted-foreground text-sm">{t("savings")}</span>
                        <span className="text-lg font-semibold text-green-600 dark:text-green-400">
                          -{formatCurrency(savedAmount, currency)} (-{savedPct}%)
                        </span>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
