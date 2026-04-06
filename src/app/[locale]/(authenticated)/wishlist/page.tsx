import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/db";
import { buyerWishlistItems, buyerWishlists, items, projects } from "@/db/schema";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { Link } from "@/i18n/navigation";
import { removeWishlistItemAction } from "@/features/wishlist/actions";
import { submitIntentAction } from "@/features/intents/actions";
import Image from "next/image";
import { ImageOff, Tag } from "lucide-react";

const DEMO_SELLER_PROFILE_ID = "11111111-1111-1111-1111-111111111111";
const DEMO_GUEST_PROFILE_ID = "22222222-2222-2222-2222-222222222222";

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

  const profileId = user.isDemo
    ? user.role === "seller"
      ? DEMO_SELLER_PROFILE_ID
      : DEMO_GUEST_PROFILE_ID
    : user.id;

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

                      return (
                        <div
                          key={row.itemId}
                          className="rounded-lg border p-3 flex items-center gap-3"
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
                            <p className="text-xs text-muted-foreground">
                              {tItem(row.itemStatus)}
                            </p>
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

                  {/* Intent submission form for this project */}
                  <details className="rounded-lg border p-4">
                    <summary className="cursor-pointer font-medium text-sm">
                      {t("sendIntent")}
                    </summary>
                    <form action={submitIntentAction} className="mt-4 space-y-3">
                      {projectItems.map((row) => (
                        <input
                          key={row.itemId}
                          type="hidden"
                          name="itemId"
                          value={row.itemId}
                        />
                      ))}

                      <div>
                        <label
                          htmlFor={`phone-${projectId}`}
                          className="block text-sm font-medium mb-1"
                        >
                          {tIntent("phone")}
                        </label>
                        <input
                          id={`phone-${projectId}`}
                          name="phone"
                          type="tel"
                          className="w-full rounded-md border border-input px-3 py-2 text-sm"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor={`contact-${projectId}`}
                          className="block text-sm font-medium mb-1"
                        >
                          {tIntent("contactMethod")}
                        </label>
                        <select
                          id={`contact-${projectId}`}
                          name="contactMethod"
                          defaultValue="email"
                          className="w-full rounded-md border border-input px-3 py-2 text-sm"
                        >
                          <option value="email">{tIntent("email")}</option>
                          <option value="phone">{tIntent("phoneOption")}</option>
                          <option value="app_message">
                            {tIntent("appMessage")}
                          </option>
                        </select>
                      </div>

                      <div>
                        <label
                          htmlFor={`notes-${projectId}`}
                          className="block text-sm font-medium mb-1"
                        >
                          {tIntent("pickupNotes")}
                        </label>
                        <textarea
                          id={`notes-${projectId}`}
                          name="pickupNotes"
                          rows={2}
                          className="w-full rounded-md border border-input px-3 py-2 text-sm"
                        />
                      </div>

                      <button
                        type="submit"
                        className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/80"
                      >
                        {tIntent("submit")}
                      </button>
                    </form>
                  </details>
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
