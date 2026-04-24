import { getUser } from "@/lib/auth";
import { computeProjectAccessState } from "@/lib/access";
import { redirect } from "next/navigation";
import { ItemTeaserCard } from "@/components/shared/item-teaser-card";
import { ImageCarousel } from "@/components/shared/image-carousel";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import {
  ArrowLeft,
  Lock,
  ShoppingCart,
  User,
  Mail,
  AlertTriangle,
  Ban,
  ExternalLink,
  Clock,
  Eye,
  Heart,
} from "lucide-react";
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
import {
  addWishlistItemAction,
  removeWishlistItemAction,
} from "@/features/wishlist/actions";
import { getTranslations } from "next-intl/server";
import { ITEM_CONDITIONS } from "@/lib/validations";

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
        }).format(item.price)
      : null;

  const formattedOriginalPrice =
    item.originalPrice != null
      ? new Intl.NumberFormat(undefined, {
          style: "currency",
          currency: item.currency ?? "USD",
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

  return (
    <div className="container px-4 md:px-6 py-6 md:py-8 max-w-6xl">
      <Link
        href={`/project/${slug}`}
        className="mb-6 inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {tProject("backToProject")}
      </Link>

      {user ? (
        <div className="grid gap-6 md:grid-cols-5 md:gap-8 animate-fade-up">
          {/* Left: gallery */}
          <div className="md:col-span-3">
            <Card className="overflow-hidden md:sticky md:top-4">
              <ImageCarousel images={allImages} title={item.title} />
            </Card>
          </div>

          {/* Right: details */}
          <div className="md:col-span-2 space-y-5">
            {/* Status alerts */}
            {item.status === "reserved" && (
              <div className="rounded-lg border border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/30 p-3 flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0" />
                <p className="text-sm font-semibold text-red-800 dark:text-red-200">
                  {isReservedForCurrentUser
                    ? tItem("reservedForYouAlert")
                    : tItem("reservedAlert")}
                </p>
              </div>
            )}
            {item.status === "sold" && (
              <div className="rounded-lg border border-gray-300 bg-gray-100 dark:border-gray-700 dark:bg-gray-800 p-3 flex items-center gap-3">
                <Ban className="h-5 w-5 text-gray-600 dark:text-gray-400 shrink-0" />
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                  {tItem("soldAlert")}
                </p>
              </div>
            )}

            {/* Title + status */}
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <h1 className="text-heading-3 flex-1">{item.title}</h1>
                <Badge
                  variant={
                    item.status === "sold"
                      ? "destructive"
                      : item.status === "pending" || item.status === "reserved"
                        ? "secondary"
                        : "default"
                  }
                  className={`shrink-0 ${
                    item.status === "reserved"
                      ? "bg-red-600 text-white border-red-600 hover:bg-red-600 font-bold px-3 py-1 text-sm"
                      : item.status === "sold"
                        ? "bg-gray-900 text-white border-gray-900 hover:bg-gray-900 font-bold px-3 py-1 text-sm"
                        : ""
                  }`}
                >
                  {isReservedForCurrentUser && item.status === "reserved"
                    ? tItem("reservedForYou")
                    : statusLabel}
                </Badge>
              </div>

              {(formattedPrice || formattedOriginalPrice) && (
                <div className="flex items-baseline gap-2">
                  {formattedPrice && (
                    <p className="text-3xl font-bold text-primary tracking-tight">
                      {formattedPrice}
                    </p>
                  )}
                  {formattedOriginalPrice && (
                    <p className="text-lg text-muted-foreground line-through">
                      {formattedOriginalPrice}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Wishlist action */}
            {item.status === "available" && (
              <form
                action={
                  isWishlisted ? removeWishlistItemAction : addWishlistItemAction
                }
              >
                <input type="hidden" name="itemId" value={item.id} />
                <input
                  type="hidden"
                  name="returnPath"
                  value={`/project/${slug}/item/${item.id}`}
                />
                <button
                  type="submit"
                  className={`inline-flex w-full sm:w-auto h-11 items-center justify-center gap-2 rounded-lg border px-5 text-sm font-semibold transition-all ${
                    isWishlisted
                      ? "border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100 dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-400"
                      : "border-border bg-card hover:bg-muted hover:border-orange-200 dark:hover:border-orange-900"
                  }`}
                >
                  <Heart
                    className={`h-4 w-4 ${isWishlisted ? "fill-current" : ""}`}
                  />
                  {isWishlisted
                    ? tItem("removeFromSelection")
                    : tItem("addToSelection")}
                </button>
              </form>
            )}

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

            {/* Description / notes */}
            {(item.description || item.notes) && (
              <div className="space-y-3 text-sm leading-relaxed">
                {item.description && <p>{item.description}</p>}
                {item.notes && (
                  <p className="text-muted-foreground italic">{item.notes}</p>
                )}
              </div>
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

            {/* Seller contact */}
            {sellerInfo && (
              <div className="rounded-xl border bg-muted/30 p-4 flex items-center gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-600 dark:bg-orange-950/50 dark:text-orange-400">
                  <User className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="truncate font-semibold">
                    {sellerInfo.displayName ?? tProject("contactSeller")}
                  </p>
                  <a
                    href={`mailto:${sellerInfo.email}`}
                    className="inline-flex items-center gap-1 truncate text-muted-foreground hover:text-primary transition-colors"
                  >
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{sellerInfo.email}</span>
                  </a>
                </div>
              </div>
            )}
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
