import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { db } from "@/db";
import { profiles, projects, sellerAccounts, items, buyerWishlists, buyerWishlistItems } from "@/db/schema";
import { and, count, desc, eq, isNull, isNotNull, max, min, ne, inArray, ilike, sql } from "drizzle-orm";
import { MapPin, Package, Heart, MapPinned, HandCoins, Tag, Navigation } from "lucide-react";
import { SearchBar } from "@/components/shared/search-bar";
import { EmptyState } from "@/components/shared/empty-state";
import { getUser, getUserCapabilities } from "@/lib/auth";
import { formatDistance, type DistanceUnit } from "@/lib/format";
import { cn } from "@/lib/utils";

function formatCurrency(value: number, currency: string = "USD") {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
}

const RADIUS_OPTIONS = [5, 10, 25, 50, 100] as const;

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; radius?: string }>;
}) {
  const { q: searchQuery, radius: radiusRaw } = await searchParams;
  const t = await getTranslations("home");

  const user = await getUser();

  // Pull the buyer's location + distance unit. We never auto-resolve;
  // they must have set country + postal in /account for filtering and
  // distance labels to kick in.
  const buyerProfile = user
    ? await db.query.profiles.findFirst({
        where: eq(profiles.id, user.id),
        columns: {
          latitude: true,
          longitude: true,
          countryCode: true,
          distanceUnit: true,
        },
      })
    : null;
  const buyerLat = buyerProfile?.latitude ?? null;
  const buyerLng = buyerProfile?.longitude ?? null;
  const buyerHasLocation = buyerLat != null && buyerLng != null;
  const distanceUnit: DistanceUnit =
    buyerProfile?.distanceUnit === "mi" ? "mi" : "km";

  // Selected radius — only honored when the buyer actually has a
  // saved location to measure from.
  const requestedRadius = Number(radiusRaw);
  const radiusKm =
    buyerHasLocation &&
    (RADIUS_OPTIONS as readonly number[]).includes(requestedRadius)
      ? requestedRadius
      : null;

  const activeSellerIds = await db
    .select({ id: sellerAccounts.id })
    .from(sellerAccounts)
    .innerJoin(profiles, eq(sellerAccounts.userId, profiles.id))
    .where(and(eq(profiles.isActive, true), eq(sellerAccounts.isActive, true)));

  const activeSellerIdSet = activeSellerIds.map((s) => s.id);

  const searchFilter = searchQuery?.trim()
    ? ilike(projects.name, `%${searchQuery.trim()}%`)
    : undefined;

  // Distance expression in metres, only meaningful when the buyer has
  // coords. We expose it on the SELECT so each card can render
  // "X km/mi away"; for users without a location we just push NULL.
  const distanceExpr = buyerHasLocation
    ? sql<number>`earth_distance(
        ll_to_earth(${projects.latitude}, ${projects.longitude}),
        ll_to_earth(${buyerLat}, ${buyerLng})
      )`
    : sql<number | null>`NULL`;

  // Seller-side restriction: hide a project when buyer is outside its
  // declared radius. If the buyer has no saved location, all
  // restricted projects are hidden too — safer default than leaking
  // them to anonymous viewers the seller didn't intend to reach.
  const sellerRestrictionFilter = buyerHasLocation
    ? sql`(${projects.radiusKm} IS NULL OR earth_distance(
        ll_to_earth(${projects.latitude}, ${projects.longitude}),
        ll_to_earth(${buyerLat}, ${buyerLng})
      ) < (${projects.radiusKm} * 1000))`
    : isNull(projects.radiusKm);

  // Buyer-asked radius: only applied when the user picked one and has
  // a saved location. Projects with unknown coords drop out (NULL <
  // anything is NULL → falsy in WHERE) which is correct: "near me"
  // requires a known centroid.
  const radiusFilter = radiusKm
    ? sql`earth_distance(
        ll_to_earth(${projects.latitude}, ${projects.longitude}),
        ll_to_earth(${buyerLat}, ${buyerLng})
      ) < ${radiusKm * 1000}`
    : undefined;

  const publicProjects =
    activeSellerIdSet.length > 0
      ? await db
          .select({
            id: projects.id,
            name: projects.name,
            slug: projects.slug,
            cityArea: projects.cityArea,
            description: projects.description,
            distanceMeters: distanceExpr,
          })
          .from(projects)
          .where(
            and(
              eq(projects.isPublic, true),
              eq(projects.publishStatus, "approved"),
              isNull(projects.deletedAt),
              inArray(projects.sellerId, activeSellerIdSet),
              searchFilter,
              sellerRestrictionFilter,
              radiusFilter
            )
          )
          .orderBy(desc(projects.createdAt))
          .limit(12)
      : [];

  const itemCounts = await db
    .select({
      projectId: items.projectId,
      count: count(),
    })
    .from(items)
    .where(and(isNull(items.deletedAt), ne(items.status, "hidden")))
    .groupBy(items.projectId);

  const itemCountMap = new Map(itemCounts.map((r) => [r.projectId, r.count]));

  // Available-only count per project for the "X available / Y items" line.
  const availableCounts = await db
    .select({
      projectId: items.projectId,
      count: count(),
    })
    .from(items)
    .where(and(isNull(items.deletedAt), eq(items.status, "available")))
    .groupBy(items.projectId);

  const availableCountMap = new Map(
    availableCounts.map((r) => [r.projectId, r.count])
  );

  // Price range per project (min/max) — drives the "from … to …" line on
  // each card. Currency is grabbed from the same group; we assume a project
  // sticks to a single currency, which is the case for everything we ship.
  const priceRanges = await db
    .select({
      projectId: items.projectId,
      min: min(items.price),
      max: max(items.price),
      currency: max(items.currency),
    })
    .from(items)
    .where(
      and(
        isNull(items.deletedAt),
        ne(items.status, "hidden"),
        isNotNull(items.price)
      )
    )
    .groupBy(items.projectId);

  const priceRangeMap = new Map(priceRanges.map((r) => [r.projectId, r]));

  let wishlistCountMap = new Map<string, number>();
  let canShowSellPrompt = false;
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

    // The "Sell something" prompt is for buyers who haven't yet activated
    // selling. Once they create their first project a sellerAccount is
    // minted and the prompt disappears — natural, low-friction graduation.
    const caps = await getUserCapabilities(user);
    canShowSellPrompt = !caps.seller;
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
    // Subtle dot pattern as a fixed full-page backdrop. Section-level
    // backgrounds sit on top, so the dots only show through where the
    // sections are transparent (mostly between hero and the projects list).
    <div className="flex flex-col bg-dot-pattern bg-fixed">
      {/* Hero — compact, search-first. On mobile: ~150px tall vs the
          previous ~700px. The SearchBar replaces the two stacked CTAs as
          the primary action; the auth nudge is a single inline line. */}
      <section className="border-b bg-[oklch(0.985_0.006_75)]">
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
          {canShowSellPrompt && (
            <p className="mt-3 text-xs text-muted-foreground">
              <Link
                href="/seller/projects/new"
                className="inline-flex items-center gap-1.5 font-semibold text-orange-600 dark:text-orange-400 hover:underline"
              >
                <Tag className="h-3 w-3" />
                {t("heroCtaSell")}
              </Link>
              <span className="mx-1.5">·</span>
              {t("heroCtaSellHint")}
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

          {/* Radius filter row — only meaningful for buyers with a
              saved location. Otherwise we offer a quick CTA to /account
              so they can set one. The chip URLs preserve ?q= when set
              so radius and search compose naturally. */}
          {buyerHasLocation ? (
            <div className="mb-4 flex flex-wrap items-center gap-1.5">
              <Navigation className="h-3.5 w-3.5 text-orange-500" />
              <span className="text-xs font-medium text-muted-foreground">
                {t("nearMe")}
              </span>
              {(["any", ...RADIUS_OPTIONS] as const).map((opt) => {
                const isActive =
                  opt === "any" ? radiusKm == null : radiusKm === opt;
                const params = new URLSearchParams();
                if (searchQuery?.trim()) params.set("q", searchQuery.trim());
                if (opt !== "any") params.set("radius", String(opt));
                const qs = params.toString();
                const href = qs ? `/?${qs}` : "/";
                return (
                  <Link
                    key={opt}
                    href={href}
                    className={cn(
                      "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 transition-colors",
                      isActive
                        ? "bg-foreground text-background ring-foreground"
                        : "bg-background text-muted-foreground ring-border hover:text-foreground"
                    )}
                  >
                    {opt === "any"
                      ? t("radiusAny")
                      : `${opt} ${distanceUnit === "mi" ? "mi" : "km"}`}
                  </Link>
                );
              })}
            </div>
          ) : user ? (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50/60 px-3 py-2 text-xs text-orange-800 dark:border-orange-900/50 dark:bg-orange-950/20 dark:text-orange-300">
              <Navigation className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1">{t("setLocationPrompt")}</span>
              <Link
                href="/account"
                className="font-semibold underline underline-offset-2"
              >
                {t("setLocationCta")}
              </Link>
            </div>
          ) : null}

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
                const totalItems = itemCountMap.get(project.id) ?? 0;
                const availableItems = availableCountMap.get(project.id) ?? 0;
                const priceRange = priceRangeMap.get(project.id);
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
                        {project.distanceMeters != null && (
                          <span className="inline-flex items-center gap-1 font-medium text-orange-700 dark:text-orange-400">
                            <Navigation className="h-3 w-3" />
                            {formatDistance(
                              project.distanceMeters / 1000,
                              distanceUnit
                            )}
                          </span>
                        )}
                        <span className="text-muted-foreground/40">·</span>
                        <span>
                          {t("availableOfTotal", {
                            available: availableItems,
                            total: totalItems,
                          })}
                        </span>
                      </div>
                      {priceRange?.min != null && (
                        <p className="text-xs font-semibold text-foreground mt-1">
                          {formatCurrency(
                            priceRange.min,
                            priceRange.currency ?? "USD"
                          )}
                          {priceRange.max != null && priceRange.max !== priceRange.min
                            ? ` – ${formatCurrency(priceRange.max, priceRange.currency ?? "USD")}`
                            : ""}
                        </p>
                      )}
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
