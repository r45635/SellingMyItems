import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { db } from "@/db";
import { profiles, projects, sellerAccounts, items, buyerWishlists, buyerWishlistItems } from "@/db/schema";
import { and, count, desc, eq, isNull, ne, inArray } from "drizzle-orm";
import { MapPin, ArrowRight, Tag, Package, ShoppingBag, Heart } from "lucide-react";
import { SmiLogo } from "@/components/shared/smi-logo";
import { getUser } from "@/lib/auth";

export default async function HomePage() {
  const t = await getTranslations("home");

  // Get seller accounts whose profile is active
  const activeSellerIds = await db
    .select({ id: sellerAccounts.id })
    .from(sellerAccounts)
    .innerJoin(profiles, eq(sellerAccounts.userId, profiles.id))
    .where(and(eq(profiles.isActive, true), eq(sellerAccounts.isActive, true)));

  const activeSellerIdSet = activeSellerIds.map((s) => s.id);

  const [publicProjects, user] = await Promise.all([
    activeSellerIdSet.length > 0
      ? db
          .select({
            id: projects.id,
            name: projects.name,
            slug: projects.slug,
            cityArea: projects.cityArea,
            description: projects.description,
          })
          .from(projects)
          .where(
            and(
              eq(projects.isPublic, true),
              isNull(projects.deletedAt),
              inArray(projects.sellerId, activeSellerIdSet)
            )
          )
          .orderBy(desc(projects.createdAt))
          .limit(12)
      : Promise.resolve([]),
    getUser(),
  ]);

  // Count available items per project
  const itemCounts = await db
    .select({
      projectId: items.projectId,
      count: count(),
    })
    .from(items)
    .where(and(isNull(items.deletedAt), ne(items.status, "hidden")))
    .groupBy(items.projectId);

  const itemCountMap = new Map(itemCounts.map((r) => [r.projectId, r.count]));

  // Count wishlist items per project (only if user is logged in)
  let wishlistCountMap = new Map<string, number>();
  if (user) {
    const wishlistCounts = await db
      .select({
        projectId: buyerWishlists.projectId,
        count: count(),
      })
      .from(buyerWishlistItems)
      .innerJoin(buyerWishlists, eq(buyerWishlistItems.wishlistId, buyerWishlists.id))
      .where(eq(buyerWishlists.userId, user.id))
      .groupBy(buyerWishlists.projectId);

    wishlistCountMap = new Map(wishlistCounts.map((r) => [r.projectId, r.count]));
  }

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b bg-gradient-to-b from-orange-50/60 to-background py-5 md:py-6">
        <div className="container px-4 md:px-6">
          <div className="flex items-center justify-center gap-4 text-center">
            <SmiLogo size="md" showText={false} />
            <div>
              <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl md:text-3xl">
                {t("hero")}
              </h1>
              <p className="text-sm text-muted-foreground md:text-base mt-0.5">
                {t("subtitle")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Sign-in prompt */}
      <section className="border-b bg-muted/40 py-4">
        <div className="container px-4 md:px-6">
          <p className="text-center text-sm text-muted-foreground max-w-[600px] mx-auto">
            {t("signInPrompt")}
          </p>
        </div>
      </section>

      {/* Projects */}
      <section className="py-8 md:py-10">
        <div className="container px-4 md:px-6">
          <div className="flex items-center gap-2 mb-5">
            <Package className="h-5 w-5 text-orange-500" />
            <h2 className="text-xl font-bold">{t("browseProjects")}</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {publicProjects.length === 0 ? (
              <div className="col-span-full rounded-xl border-2 border-dashed p-12 text-center text-muted-foreground">
                <Tag className="h-8 w-8 mx-auto mb-3 text-muted-foreground/40" />
                <p>Projects will appear here</p>
              </div>
            ) : (
              publicProjects.map((project) => (
                <Link
                  key={project.id}
                  href={`/project/${project.slug}`}
                  className="group relative rounded-xl border bg-card p-4 transition-all hover:shadow-md hover:border-orange-200"
                >
                  {/* Wishlist badge - top right */}
                  {(wishlistCountMap.get(project.id) ?? 0) > 0 && (
                    <span className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 px-2 py-0.5 text-xs font-semibold shadow-sm">
                      <Heart className="h-3 w-3 fill-current" />
                      {t("inSelection", { count: wishlistCountMap.get(project.id) ?? 0 })}
                    </span>
                  )}

                  <h3 className="text-lg font-semibold group-hover:text-orange-600 transition-colors pr-24">
                    {project.name}
                  </h3>
                  {project.cityArea && (
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1.5">
                      <MapPin className="h-3.5 w-3.5" />
                      <span>{project.cityArea}</span>
                    </div>
                  )}
                  {project.description && (
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                      {project.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-orange-600 opacity-0 group-hover:opacity-100 transition-opacity">
                      View items <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <ShoppingBag className="h-3.5 w-3.5" />
                      {t("itemsForSale", { count: itemCountMap.get(project.id) ?? 0 })}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
