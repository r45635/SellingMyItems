import { getUser } from "@/lib/auth";
import { ItemTeaserCard } from "@/components/shared/item-teaser-card";
import { ItemDetailCard } from "@/components/shared/item-detail-card";
import { Link } from "@/i18n/navigation";
import { ArrowLeft, Lock } from "lucide-react";
import { db } from "@/db";
import {
  buyerWishlistItems,
  buyerWishlists,
  items,
  projectCategories,
  projects,
} from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { notFound } from "next/navigation";
import {
  addWishlistItemAction,
  removeWishlistItemAction,
} from "@/features/wishlist/actions";

export default async function ItemPage({
  params,
}: {
  params: Promise<{ slug: string; itemId: string; locale: string }>;
}) {
  const { slug, itemId } = await params;
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

  // Hidden (suspended) items are not visible to the public
  if (item.status === "hidden") {
    notFound();
  }

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

  return (
    <div className="container px-4 md:px-6 py-8 max-w-3xl">
      <Link
        href={`/project/${slug}`}
        className="mb-6 inline-flex h-7 items-center gap-1 rounded-lg px-2.5 text-sm text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to project
      </Link>

      {user ? (
        /* Authenticated: show full details */
        <div className="space-y-4">
          <ItemDetailCard
            title={item.title}
            coverImageUrl={item.coverImageUrl}
            images={item.images.map((img) => ({ url: img.url, alt: img.altText ?? undefined }))}
            links={item.links.map((l) => ({ url: l.url, label: l.label ?? undefined }))}
            price={item.price}
            originalPrice={item.originalPrice}
            currency={item.currency}
            brand={item.brand}
            description={item.description}
            condition={item.condition}
            approximateAge={item.approximateAge}
            notes={item.notes}
            status={item.status}
            categoryName={category?.name}
            updatedAt={item.updatedAt}
          />

          <form action={isWishlisted ? removeWishlistItemAction : addWishlistItemAction}>
            <input type="hidden" name="itemId" value={item.id} />
            <input
              type="hidden"
              name="returnPath"
              value={`/project/${slug}/item/${item.id}`}
            />
            <button
              type="submit"
              className={`inline-flex h-10 items-center justify-center rounded-lg border px-4 text-sm font-medium transition-colors ${
                isWishlisted
                  ? "border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100"
                  : "border-border hover:bg-muted"
              }`}
            >
              {isWishlisted ? "❤️ Retirer de ma sélection" : "🤍 Ajouter à ma sélection"}
            </button>
          </form>
        </div>
      ) : (
        /* Guest: show teaser + sign-in prompt */
        <div className="space-y-6">
          <ItemTeaserCard
            title={item.title}
            coverImageUrl={item.coverImageUrl}
            status={item.status}
            updatedAt={item.updatedAt}
          />
          <div className="rounded-xl border bg-muted/30 p-8 text-center space-y-4">
            <Lock className="h-10 w-10 mx-auto text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              Sign in to see full details, price, and more.
            </p>
            <Link
              href="/login"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-foreground px-6 text-sm font-semibold text-background shadow-lg transition-all hover:bg-foreground/90"
            >
              Sign in
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
