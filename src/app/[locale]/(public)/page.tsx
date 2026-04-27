import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { db } from "@/db";
import { profiles, projects, sellerAccounts, items, buyerWishlists, buyerWishlistItems } from "@/db/schema";
import { and, count, desc, eq, isNull, ne, inArray, ilike } from "drizzle-orm";
import { MapPin, Package, Heart, MapPinned, HandCoins } from "lucide-react";
import { SearchBar } from "@/components/shared/search-bar";
import { EmptyState } from "@/components/shared/empty-state";
import { getUser } from "@/lib/auth";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q: searchQuery } = await searchParams;
  const t = await getTranslations("home");

  const activeSellerIds = await db
    .select({ id: sellerAccounts.id })
    .from(sellerAccounts)
    .innerJoin(profiles, eq(sellerAccounts.userId, profiles.id))
    .where(and(eq(profiles.isActive, true), eq(sellerAccounts.isActive, true)));

  const activeSellerIdSet = activeSellerIds.map((s) => s.id);

  const searchFilter = searchQuery?.trim()
    ? ilike(projects.name, `%${searchQuery.trim()}%`)
    : undefined;

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
              eq(projects.publishStatus, "approved"),
              isNull(projects.deletedAt),
              inArray(projects.sellerId, activeSellerIdSet),
              searchFilter
            )
          )
          .orderBy(desc(projects.createdAt))
          .limit(12)
      : Promise.resolve([]),
    getUser(),
  ]);

  const itemCounts = await db
    .select({
      projectId: items.projectId,
      count: count(),
    })
    .from(items)
    .where(and(isNull(items.deletedAt), ne(items.status, "hidden")))
    .groupBy(items.projectId);

  const itemCountMap = new Map(itemCounts.map((r) => [r.projectId, r.count]));

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

  const valueProps = [
    {
      icon: MapPinned,
      title: t("heroValueLocal"),
      desc: t("heroValueLocalDesc"),
    },
    {
      icon: Heart,
      title: t("heroValueWishlist"),
      desc: t("heroValueWishlistDesc"),
    },
    {
      icon: HandCoins,
      title: t("heroValueDirect"),
      desc: t("heroValueDirectDesc"),
    },
  ];

  return (
    <div className="flex flex-col">
      {/* Hero — compact, search-first. On mobile: ~150px tall vs the
          previous ~700px. The SearchBar replaces the two stacked CTAs as
          the primary action; the auth nudge is a single inline line. */}
      <section className="border-b bg-gradient-to-b from-orange-50/60 to-background dark:from-orange-950/15">
        <div className="container px-4 py-5 md:px-6 md:py-12 mx-auto max-w-3xl text-center animate-fade-up">
          <h1 className="text-2xl sm:text-4xl md:text-display font-extrabold tracking-tight bg-gradient-to-br from-foreground to-orange-600 bg-clip-text text-transparent dark:to-orange-400">
            {t("hero")}
          </h1>
          <p className="mt-2 text-sm md:text-lead text-muted-foreground max-w-xl mx-auto">
            {t("subtitle")}
          </p>
          <div className="mt-4 flex justify-center">
            <SearchBar />
          </div>
          {!user && (
            <p className="mt-3 text-xs text-muted-foreground">
              <Link
                href="/login"
                className="font-semibold text-orange-600 dark:text-orange-400 hover:underline"
              >
                {t("heroCtaSignIn")}
              </Link>
              <span className="mx-1.5">·</span>
              {t("signInPrompt")}
            </p>
          )}
        </div>
      </section>

      {/* Projects — front and center */}
      <section className="py-5 md:py-10">
        <div className="container px-4 md:px-6">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2 className="text-base sm:text-lg font-semibold flex items-baseline gap-2">
              {searchQuery?.trim() ? t("searchResultsFor", { q: searchQuery.trim() }) : t("browseProjects")}
              <span className="text-xs font-normal text-muted-foreground tabular-nums">
                {publicProjects.length}
              </span>
            </h2>
            {searchQuery?.trim() && (
              <Link
                href="/"
                className="text-xs text-muted-foreground hover:text-foreground hover:underline"
              >
                {t("clearSearch")}
              </Link>
            )}
          </div>

          {publicProjects.length === 0 ? (
            <EmptyState
              icon={Package}
              title={searchQuery?.trim() ? t("noSearchResults") : t("noProjects")}
              description={searchQuery?.trim() ? t("noSearchResultsDesc") : t("noProjectsDesc")}
              action={
                searchQuery?.trim() ? (
                  <Link
                    href="/"
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3.5 text-sm font-medium transition-all hover:bg-muted"
                  >
                    {t("clearSearch")}
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <ul className="grid gap-2.5 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3 stagger-fade-in">
              {publicProjects.map((project) => {
                const wishlistCount = wishlistCountMap.get(project.id) ?? 0;
                const itemCount = itemCountMap.get(project.id) ?? 0;
                return (
                  <li key={project.id}>
                    <Link
                      href={`/project/${project.slug}`}
                      className="group block rounded-xl border bg-card p-3 sm:p-4 transition-all active:scale-[0.99] sm:hover:-translate-y-0.5 sm:hover:shadow-md sm:hover:border-orange-300 dark:sm:hover:border-orange-700"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-base sm:text-heading-4 font-semibold leading-tight group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                          {project.name}
                        </h3>
                        {wishlistCount > 0 && (
                          <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 px-2 py-0.5 text-[10px] font-semibold">
                            <Heart className="h-2.5 w-2.5 fill-current" />
                            {wishlistCount}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                        {project.cityArea && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {project.cityArea}
                          </span>
                        )}
                        <span className="text-muted-foreground/40">·</span>
                        <span>{t("itemsForSale", { count: itemCount })}</span>
                      </div>
                      {/* Description shown only on tablet+ to keep mobile cards
                          compact and scannable. */}
                      {project.description && (
                        <p className="hidden sm:block text-sm text-muted-foreground mt-2 line-clamp-2">
                          {project.description}
                        </p>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* Value props — secondary placement, desktop only. Hidden on
          mobile to keep the projects above the fold. */}
      <section className="hidden md:block py-10 border-t bg-muted/20">
        <div className="container px-4 md:px-6">
          <div className="grid grid-cols-3 gap-4 max-w-4xl mx-auto">
            {valueProps.map((v) => (
              <div
                key={v.title}
                className="flex items-start gap-3 rounded-xl bg-card border p-4"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-950/50 dark:text-orange-400">
                  <v.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{v.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{v.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
