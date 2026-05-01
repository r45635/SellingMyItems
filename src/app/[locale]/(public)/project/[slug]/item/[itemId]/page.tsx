import type { Metadata } from "next";
import { getUser } from "@/lib/auth";
import { computeProjectAccessState } from "@/lib/access";
import { redirect } from "next/navigation";
import { ItemTeaserCard } from "@/components/shared/item-teaser-card";
import { ImageCarousel } from "@/components/shared/image-carousel";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Lock,
  ShoppingCart,
  User,
  Mail,
  ExternalLink,
  Clock,
  Eye,
  MessageCircle,
} from "lucide-react";
import { ItemDetailWishlistButton } from "@/features/wishlist/components/item-detail-wishlist-button";
import { ExpandableText } from "@/components/shared/expandable-text";
import { db } from "@/db";
import {
  buyerWishlistItems,
  buyerWishlists,
  items,
  profiles,
  projectCategories,
  projects,
  sellerAccounts,
} from "@/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ITEM_CONDITIONS } from "@/lib/validations";

import { siteConfig } from "@/config";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; itemId: string }>;
}): Promise<Metadata> {
  const { slug, itemId } = await params;

  const row = await db
    .select({
      itemTitle: items.title,
      itemDescription: items.description,
      itemCoverImageUrl: items.coverImageUrl,
      projectName: projects.name,
      projectIsSeoIndexable: projects.isSeoIndexable,
    })
    .from(items)
    .innerJoin(projects, eq(items.projectId, projects.id))
    .where(
      and(
        eq(items.id, itemId),
        eq(projects.slug, slug),
        eq(projects.isPublic, true),
        eq(projects.publishStatus, "approved"),
        isNull(projects.deletedAt),
        isNull(items.deletedAt)
      )
    )
    .limit(1);

  if (row.length === 0) return {};

  const { itemTitle, itemDescription, itemCoverImageUrl, projectName, projectIsSeoIndexable } = row[0];
  const noIndex = !projectIsSeoIndexable;

  const ogImages = itemCoverImageUrl
    ? [{ url: `${siteConfig.url}${itemCoverImageUrl}` }]
    : undefined;

  return {
    title: `${itemTitle} — ${projectName}`,
    description: itemDescription
      ? itemDescription.slice(0, 160)
      : `${itemTitle} for sale in ${projectName}`,
    robots: noIndex ? { index: false, follow: false } : undefined,
    openGraph: ogImages ? { images: ogImages } : undefined,
  };
}

export default async function ItemPage({
  params,
}: {
  params: Promise<{ slug: string; itemId: string; locale: string }>;
}) {
  const { slug, itemId, locale } = await params;
  const user = await getUser();

  const project = await db.query.projects.findFirst({
    where: and(
      eq(projects.slug, slug),
      eq(projects.isPublic, true),
      eq(projects.publishStatus, "approved"),
      isNull(projects.deletedAt)
    ),
  });

  if (!project) {
    notFound();
  }

  if (project.visibility === "invitation_only") {
    if (!user) {
      redirect(`/${locale}/login?returnTo=/project/${slug}`);
    }
    const accessState = await computeProjectAccessState(
      user.id,
      user.email,
      project.id
    );
    if (accessState !== "granted") {
      redirect(`/${locale}/project/${slug}`);
    }
  }

  const item = await db.query.items.findFirst({
    where: and(
      eq(items.id, itemId),
      eq(items.projectId, project.id),
      isNull(items.deletedAt)
    ),
    with: {
      images: { orderBy: (img, { asc }) => [asc(img.sortOrder)] },
      links: true,
    },
  });

  if (!item) {
    notFound();
  }

  if (item.status === "hidden") {
    notFound();
  }

  const [updatedItem] = await db
    .update(items)
    .set({
      viewCount: sql`${items.viewCount} + 1`,
    })
    .where(eq(items.id, item.id))
    .returning({ viewCount: items.viewCount });

  const currentViewCount = updatedItem?.viewCount ?? item.viewCount;

  const profileId = user ? user.id : null;

  const wishlist = profileId
    ? await db.query.buyerWishlists.findFirst({
        where: and(
          eq(buyerWishlists.userId, profileId),
          eq(buyerWishlists.projectId, project.id)
        ),
      })
    : null;

  const wishlistEntry = wishlist
    ? await db.query.buyerWishlistItems.findFirst({
        where: and(
          eq(buyerWishlistItems.wishlistId, wishlist.id),
          eq(buyerWishlistItems.itemId, item.id)
        ),
      })
    : null;

  const isWishlisted = Boolean(wishlistEntry);

  const category = item.categoryId
    ? await db.query.projectCategories.findFirst({
        where: eq(projectCategories.id, item.categoryId),
      })
    : null;

  const sellerRows = await db
    .select({
      displayName: profiles.displayName,
      email: profiles.email,
      emailVisibility: profiles.emailVisibility,
    })
    .from(sellerAccounts)
    .innerJoin(profiles, eq(sellerAccounts.userId, profiles.id))
    .where(eq(sellerAccounts.id, project.sellerId))
    .limit(1);
  const sellerInfo = sellerRows[0] ?? null;

  const tItem = await getTranslations("item");
  const tProject = await getTranslations("project");

  const allImages =
    item.images.length > 0
      ? item.images.map((img) => ({ url: img.url, alt: img.altText ?? undefined }))
      : item.coverImageUrl
        ? [{ url: item.coverImageUrl, alt: item.title }]
        : [];

  const formattedPrice =
    item.price != null
      ? new Intl.NumberFormat(undefined, {
          style: "currency",
          currency: item.currency ?? "USD",
          maximumFractionDigits: item.price % 1 === 0 ? 0 : 2,
        }).format(item.price)
      : null;

  const formattedOriginalPrice =
    item.originalPrice != null
      ? new Intl.NumberFormat(undefined, {
          style: "currency",
          currency: item.currency ?? "USD",
          maximumFractionDigits: item.originalPrice % 1 === 0 ? 0 : 2,
        }).format(item.originalPrice)
      : null;

  const isKnownCondition =
    item.condition && (ITEM_CONDITIONS as readonly string[]).includes(item.condition);
  const conditionLabel = isKnownCondition
    ? tItem(`conditions.${item.condition}` as never)
    : item.condition;

  const formattedDate = item.updatedAt
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(
        typeof item.updatedAt === "string" ? new Date(item.updatedAt) : item.updatedAt
      )
    : null;

  const statusLabel = tItem(item.status);
  const isReservedForCurrentUser =
    item.status === "reserved" && item.reservedForUserId === profileId;

  const discountPct =
    item.originalPrice != null &&
    item.price != null &&
    item.originalPrice > item.price
      ? Math.round((1 - item.price / item.originalPrice) * 100)
      : 0;

  return (
    <div className="container px-4 md:px-6 pt-6 md:pt-8 pb-28 md:pb-8 max-w-6xl">
      <Link
        href={`/project/${slug}`}
        className="mb-6 inline-flex items-center gap-1.5 h-7 px-3 rounded-full border border-border bg-white shadow-sm text-xs font-semibold text-foreground hover:border-orange-300 transition-all"
      >
        <ArrowLeft className="h-3 w-3" />
        {tProject("backToProject")}
      </Link>

      {user ? (
        <div className="md:grid md:grid-cols-[58%_42%] min-h-screen animate-fade-up">
          {/* Left: gallery, sticky on md+ */}
          <div className="md:sticky md:top-14 md:self-start">
            <ImageCarousel images={allImages} title={item.title} />
          </div>

          {/* Right: details. The slim coloured top border replaces the
              previous full alert banners — status badge inline with the
              title still carries the explicit label. */}
          <div
            className={cn(
              "p-6 space-y-6 md:border-l",
              item.status === "reserved" && "border-t-4 border-t-red-500",
              item.status === "sold" && "border-t-4 border-t-gray-400"
            )}
          >
            {/* Status pill above title, on its own line */}
            <div className="flex items-center gap-2">
              <Badge
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-bold",
                  item.status === "reserved"
                    ? "bg-red-100 text-red-700 border-red-200 hover:bg-red-100"
                    : item.status === "sold"
                      ? "bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-100"
                      : "bg-green-100 text-green-700 border-green-200 hover:bg-green-100"
                )}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current inline-block mr-1.5" />
                {isReservedForCurrentUser && item.status === "reserved"
                  ? tItem("reservedForYou")
                  : statusLabel}
              </Badge>
              {item.status === "reserved" && (
                <span className="text-xs text-muted-foreground">
                  · {isReservedForCurrentUser ? tItem("youAreBuyingThis") : tItem("reservedSubtle")}
                </span>
              )}
            </div>
            <h1 className="text-xl md:text-2xl font-extrabold tracking-tight -mt-4">
              {item.title}
            </h1>

            {/* Price block — first thing under the title, with optional
                discount badge when an originalPrice is set and lower
                than today's price was. */}
            {(formattedPrice || formattedOriginalPrice) && (
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                {formattedPrice && (
                  <p className="text-3xl font-extrabold text-orange-600">
                    {formattedPrice}
                  </p>
                )}
                {formattedOriginalPrice && (
                  <p className="text-lg text-muted-foreground line-through">
                    {formattedOriginalPrice}
                  </p>
                )}
                {discountPct > 0 && (
                  <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100 dark:bg-green-950/40 dark:text-green-300 dark:border-green-900">
                    {discountPct}% off
                  </Badge>
                )}
              </div>
            )}

            {/* Primary CTA block — stacked Message + Wishlist, full width.
                Sits between price block and description for prominence. */}
            <div className="flex flex-col gap-2 mt-4">
              <Link
                href={`/messages/new?projectId=${project.id}`}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold py-3 px-4 text-sm shadow-sm shadow-orange-200 transition-all"
              >
                <MessageCircle className="h-4 w-4" />
                {tProject("sendMessageCta")}
              </Link>
              {item.status === "available" && (
                <ItemDetailWishlistButton
                  itemId={item.id}
                  initialIsWishlisted={isWishlisted}
                  returnPath={`/project/${slug}/item/${item.id}`}
                  addLabel={tItem("addToSelection")}
                  removeLabel={tItem("removeFromSelection")}
                  addedToast={tItem("addToSelection")}
                  removedToast={tItem("removeFromSelection")}
                  className="w-full py-3 font-semibold"
                />
              )}
            </div>

            {isWishlisted && item.status === "available" && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30 p-3.5 flex items-start gap-3">
                <ShoppingCart className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold text-blue-900 dark:text-blue-200">
                    {tItem("inSelectionNotice")}
                  </p>
                  <p className="text-blue-700 dark:text-blue-300 mt-0.5">
                    {tItem.rich("finalizeInSelection", {
                      link: (chunks) => (
                        <Link
                          href="/wishlist"
                          className="underline font-medium hover:text-blue-900 dark:hover:text-blue-100"
                        >
                          {chunks}
                        </Link>
                      ),
                    })}
                  </p>
                </div>
              </div>
            )}

            {/* Description / notes */}
            {(item.description || item.notes) && (
              <div className="space-y-3">
                {item.description && (
                  <ExpandableText
                    text={item.description}
                    maxLines={4}
                    expandLabel={tItem("readMore")}
                    collapseLabel={tItem("showLess")}
                  />
                )}
                {item.notes && (
                  <div className="bg-orange-50 border-l-2 border-orange-400 rounded-r-lg px-3 py-2 text-xs text-orange-900 italic leading-relaxed dark:bg-orange-950/30 dark:text-orange-200 dark:border-orange-600">
                    📌 {item.notes}
                  </div>
                )}
              </div>
            )}

            {/* Attributes */}
            {(category?.name ||
              item.brand ||
              item.condition ||
              item.approximateAge) && (
              <Card>
                <CardContent className="p-4 space-y-2.5 text-sm">
                  {category?.name && (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">{tItem("category")}</span>
                      <Badge variant="outline" className="font-normal">
                        {category.name}
                      </Badge>
                    </div>
                  )}
                  {item.brand && (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">{tItem("brand")}</span>
                      <span className="font-medium text-right">{item.brand}</span>
                    </div>
                  )}
                  {item.condition && (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">{tItem("condition")}</span>
                      <span className="font-medium text-right">{conditionLabel}</span>
                    </div>
                  )}
                  {item.approximateAge && (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">{tItem("age")}</span>
                      <span className="font-medium text-right">{item.approximateAge}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Links */}
            {item.links.length > 0 && (
              <div className="space-y-1.5 border-t pt-4">
                <p className="text-sm font-semibold">{tItem("links")}</p>
                {item.links.map((link, idx) => (
                  <a
                    key={idx}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    {link.label || link.url}
                  </a>
                ))}
              </div>
            )}

            {/* Meta */}
            {(formattedDate || currentViewCount != null) && (
              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground border-t pt-4">
                {formattedDate && (
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    <span>
                      {tItem("lastUpdated")}: {formattedDate}
                    </span>
                  </div>
                )}
                {currentViewCount != null && (
                  <div className="flex items-center gap-1.5">
                    <Eye className="h-3.5 w-3.5" />
                    <span>
                      {currentViewCount} {tItem("views")}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Seller info — message CTA lives in the primary CTA block above */}
            {sellerInfo && (
              <div className="rounded-xl border bg-muted/30 p-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-600 dark:bg-orange-950/50 dark:text-orange-400">
                    <User className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="truncate font-semibold">
                      {sellerInfo.displayName ?? tProject("contactSeller")}
                    </p>
                    {sellerInfo.emailVisibility === "direct" ? (
                      <a
                        href={`mailto:${sellerInfo.email}`}
                        className="inline-flex items-center gap-1 truncate text-muted-foreground hover:text-primary transition-colors"
                      >
                        <Mail className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{sellerInfo.email}</span>
                      </a>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {tProject("contactViaAppHint")}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
          {/* Mobile sticky bottom action bar — sits above the global mobile
              bottom nav (h-14). Hidden on md+. */}
          <div className="fixed bottom-14 left-0 right-0 z-50 md:hidden bg-white/95 backdrop-blur border-t border-border px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] dark:bg-neutral-900/95">
            <div className="flex gap-3">
              {item.status === "available" && (
                <ItemDetailWishlistButton
                  itemId={item.id}
                  initialIsWishlisted={isWishlisted}
                  returnPath={`/project/${slug}/item/${item.id}`}
                  addLabel={tItem("addToSelection")}
                  removeLabel={tItem("removeFromSelection")}
                  addedToast={tItem("addToSelection")}
                  removedToast={tItem("removeFromSelection")}
                  className="flex-1 border border-border rounded-xl py-3 font-semibold"
                />
              )}
              <Link
                href={`/messages/new?projectId=${project.id}`}
                className="flex-[2] inline-flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold text-sm rounded-xl py-3"
              >
                <MessageCircle className="h-4 w-4" />
                {tItem("messageSeller")}
              </Link>
            </div>
          </div>
        </div>
      ) : (
        /* Guest: teaser + sign-in CTA */
        <div className="mx-auto max-w-3xl space-y-6 animate-fade-up">
          <ItemTeaserCard
            title={item.title}
            coverImageUrl={item.coverImageUrl}
            status={item.status}
            updatedAt={item.updatedAt}
            viewCount={currentViewCount}
            price={item.price}
            currency={item.currency}
          />
          <div className="rounded-2xl border bg-gradient-to-b from-orange-50/60 to-card p-8 text-center space-y-4 dark:from-orange-950/20">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 text-orange-600 ring-8 ring-orange-50/60 dark:bg-orange-950/50 dark:text-orange-400 dark:ring-orange-950/20">
              <Lock className="h-5 w-5" />
            </div>
            <div className="mx-auto max-w-md space-y-1">
              <p className="font-semibold">{tItem("signInToSeeDetails")}</p>
              <p className="text-sm text-muted-foreground">
                {tItem("guestBody")}
              </p>
            </div>
            <Link
              href={`/login?returnTo=/project/${slug}/item/${itemId}`}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow"
            >
              {tProject("guestSignIn")}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
