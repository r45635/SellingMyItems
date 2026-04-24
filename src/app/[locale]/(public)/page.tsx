import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { db } from "@/db";
import { profiles, projects, sellerAccounts, items, buyerWishlists, buyerWishlistItems } from "@/db/schema";
import { and, count, desc, eq, isNull, ne, inArray, ilike } from "drizzle-orm";
import { MapPin, ArrowRight, Package, ShoppingBag, Heart, Search, MapPinned, HandCoins } from "lucide-react";
import { SmiLogo } from "@/components/shared/smi-logo";
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
      <section className="relative overflow-hidden border-b bg-gradient-to-b from-orange-50/70 via-background to-background">
        <div className="absolute inset-0 bg-dot-pattern opacity-40 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
        <div
          className="pointer-events-none absolute -top-24 -right-16 h-72 w-72 rounded-full bg-orange-200/40 blur-3xl dark:bg-orange-900/20"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-32 -left-16 h-72 w-72 rounded-full bg-amber-100/40 blur-3xl dark:bg-amber-900/10"
          aria-hidden
        />

        <div className="container relative px-4 py-12 md:px-6 md:py-20">
          <div className="mx-auto flex max-w-3xl flex-col items-center text-center animate-fade-up">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-card/80 px-3 py-1 shadow-sm backdrop-blur">
              <SmiLogo size="sm" showText={false} />
              <span className="text-xs font-semibold tracking-wide text-muted-foreground">
                SellingMyItems
              </span>
            </div>

            <h1 className="text-display bg-gradient-to-br from-foreground via-foreground to-orange-600 bg-clip-text text-transparent dark:to-orange-400">
              {t("hero")}
            </h1>
            <p className="text-lead mt-4 max-w-xl">{t("subtitle")}</p>

            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
              {!user ? (
                <Link
                  href="/auth/signin"
                  className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow"
                >
                  {t("heroCtaSignIn")}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : null}
              <a
                href="#browse"
                className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg border border-border bg-background/80 px-5 text-sm font-semibold backdrop-blur transition-all hover:bg-muted"
              >
                <Search className="h-4 w-4" />
                {t("heroCtaBrowse")}
              </a>
            </div>
          </div>

          <div className="mx-auto mt-12 grid max-w-4xl gap-3 sm:grid-cols-3 stagger-fade-in">
            {valueProps.map((v) => (
              <div
                key={v.title}
                className="flex items-start gap-3 rounded-xl border bg-card/70 p-4 backdrop-blur-sm"
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

      <section id="browse" className="py-10 md:py-14 scroll-mt-16">
        <div className="container px-4 md:px-6">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-eyebrow">{t("browseProjects")}</p>
              <h2 className="text-heading-2 mt-1 flex items-center gap-2">
                <Package className="h-6 w-6 text-orange-500" />
                {t("browseProjects")}
              </h2>
            </div>
            <div className="sm:ml-auto">
              <SearchBar />
            </div>
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
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 stagger-fade-in">
              {publicProjects.map((project) => (
                <Link
                  key={project.id}
                  href={`/project/${project.slug}`}
                  className="group relative rounded-xl border bg-card p-4 transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-orange-300 dark:hover:border-orange-700"
                >
                  {(wishlistCountMap.get(project.id) ?? 0) > 0 && (
                    <span className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 px-2 py-0.5 text-xs font-semibold shadow-sm">
                      <Heart className="h-3 w-3 fill-current" />
                      {t("inSelection", { count: wishlistCountMap.get(project.id) ?? 0 })}
                    </span>
                  )}

                  <h3 className="text-heading-4 pr-24 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
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
                  <div className="flex items-center justify-between mt-3">
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-orange-600 dark:text-orange-400 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all">
                      View items <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <ShoppingBag className="h-3.5 w-3.5" />
                      {t("itemsForSale", { count: itemCountMap.get(project.id) ?? 0 })}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {!user && publicProjects.length > 0 && (
            <p className="mt-8 text-center text-sm text-muted-foreground">
              {t("signInPrompt")}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
