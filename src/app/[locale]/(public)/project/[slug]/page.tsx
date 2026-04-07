import { ItemTeaserCard } from "@/components/shared/item-teaser-card";
import { Badge } from "@/components/ui/badge";
import { MapPin, ArrowLeft, Package, User, Mail, Lock } from "lucide-react";
import { db } from "@/db";
import { buyerWishlistItems, buyerWishlists, items, profiles, projectCategories, projects, sellerAccounts } from "@/db/schema";
import { and, asc, eq, inArray, isNull, ne } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { getUser } from "@/lib/auth";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}) {
  const { slug } = await params;
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

  // Check that the seller's profile is active and get contact info
  const sellerRows = await db
    .select({
      isActive: profiles.isActive,
      displayName: profiles.displayName,
      email: profiles.email,
    })
    .from(sellerAccounts)
    .innerJoin(profiles, eq(sellerAccounts.userId, profiles.id))
    .where(and(eq(sellerAccounts.id, project.sellerId), eq(profiles.isActive, true)))
    .limit(1);

  if (sellerRows.length === 0) {
    notFound();
  }

  const sellerInfo = sellerRows[0];

  const categories = await db
    .select({ id: projectCategories.id, name: projectCategories.name })
    .from(projectCategories)
    .where(eq(projectCategories.projectId, project.id))
    .orderBy(asc(projectCategories.sortOrder), asc(projectCategories.name));

  const projectItems = await db
    .select({
      id: items.id,
      title: items.title,
      coverImageUrl: items.coverImageUrl,
      status: items.status,
      updatedAt: items.updatedAt,
    })
    .from(items)
    .where(and(eq(items.projectId, project.id), isNull(items.deletedAt), ne(items.status, "hidden")))
    .orderBy(asc(items.sortOrder), asc(items.createdAt));

  // Fetch wishlisted item IDs for the logged-in user
  const user = await getUser();
  const wishlistedItemIds = new Set<string>();
  if (user) {
    const wishlist = await db.query.buyerWishlists.findFirst({
      where: and(
        eq(buyerWishlists.userId, user.id),
        eq(buyerWishlists.projectId, project.id)
      ),
    });
    if (wishlist) {
      const wishlistItems = await db
        .select({ itemId: buyerWishlistItems.itemId })
        .from(buyerWishlistItems)
        .where(eq(buyerWishlistItems.wishlistId, wishlist.id));
      for (const wi of wishlistItems) {
        wishlistedItemIds.add(wi.itemId);
      }
    }
  }

  return (
    <div className="container px-4 md:px-6 py-6">
      <Link
        href="/"
        className="mb-6 inline-flex h-7 items-center gap-1 rounded-lg px-2.5 text-sm text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>

      {/* Project Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold tracking-tight mb-2">{project.name}</h1>
        {project.cityArea && (
          <div className="flex items-center gap-1.5 text-muted-foreground mb-4">
            <MapPin className="h-4 w-4" />
            <span>{project.cityArea}</span>
          </div>
        )}
        {project.description && (
          <p className="text-muted-foreground max-w-2xl leading-relaxed">
            {project.description}
          </p>
        )}
        {categories.length > 0 && (
          <div className="flex gap-2 mt-3 flex-wrap">
            {categories.map((category) => (
              <Badge key={category.id} variant="outline" className="rounded-full">
                {category.name}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Seller contact — visible to authenticated users */}
      {user && (
        <div className="mb-6 rounded-lg border bg-muted/30 p-4 flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div className="text-sm">
            <p className="font-medium">{sellerInfo.displayName ?? "Vendeur"}</p>
            <a
              href={`mailto:${sellerInfo.email}`}
              className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
            >
              <Mail className="h-3.5 w-3.5" />
              {sellerInfo.email}
            </a>
          </div>
        </div>
      )}

      {/* Items Grid */}
      {user ? (
        /* Authenticated: full items grid */
        projectItems.length > 0 ? (
          <>
            <div className="flex items-center gap-2 mb-4">
              <Package className="h-5 w-5 text-orange-500" />
              <h2 className="text-lg font-semibold">{projectItems.length} item{projectItems.length !== 1 ? "s" : ""}</h2>
            </div>
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
              {projectItems.map((item) => (
                <ItemTeaserCard
                  key={item.id}
                  title={item.title}
                  coverImageUrl={item.coverImageUrl}
                  status={item.status}
                  updatedAt={item.updatedAt}
                  href={`/project/${slug}/item/${item.id}`}
                  isWishlisted={wishlistedItemIds.has(item.id)}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-16 text-muted-foreground">
            <Package className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
            <p>No items yet</p>
          </div>
        )
      ) : (
        /* Guest: blurred preview + sign-in CTA */
        <div className="relative">
          {projectItems.length > 0 && (
            <div className="flex items-center gap-2 mb-4">
              <Package className="h-5 w-5 text-orange-500" />
              <h2 className="text-lg font-semibold">{projectItems.length} item{projectItems.length !== 1 ? "s" : ""}</h2>
            </div>
          )}
          <div className="relative overflow-hidden rounded-lg">
            {/* Blurred item previews */}
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 blur-sm pointer-events-none select-none" aria-hidden="true">
              {projectItems.slice(0, 4).map((item) => (
                <ItemTeaserCard
                  key={item.id}
                  title={item.title}
                  coverImageUrl={item.coverImageUrl}
                  status={item.status}
                  updatedAt={item.updatedAt}
                />
              ))}
            </div>
            {/* Overlay with CTA */}
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/60 backdrop-blur-[2px] rounded-lg">
              <Lock className="h-10 w-10 text-muted-foreground/50 mb-4" />
              <p className="text-sm text-muted-foreground mb-4 text-center px-4">
                Connectez-vous pour voir les articles, photos et prix.
              </p>
              <Link
                href={`/login?returnTo=/project/${slug}`}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-foreground px-6 text-sm font-semibold text-background shadow-lg transition-all hover:bg-foreground/90"
              >
                Se connecter
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
