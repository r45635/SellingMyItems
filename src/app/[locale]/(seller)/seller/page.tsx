import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import {
  Package,
  Eye,
  Heart,
  ShoppingCart,
  MessageSquare,
  FolderOpen,
  ArrowRight,
  Plus,
  DollarSign,
} from "lucide-react";
import { requireSeller } from "@/lib/auth";
import { EmptyState } from "@/components/shared/empty-state";
import { db } from "@/db";
import {
  projects,
  items,
  buyerWishlists,
  buyerWishlistItems,
  buyerIntents,
  conversationThreads,
} from "@/db/schema";
import {
  eq,
  and,
  inArray,
  isNull,
  isNotNull,
  count,
  sum,
  sql,
} from "drizzle-orm";
import { getSellerAccountIdsForUser } from "@/lib/seller-accounts";

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

export default async function SellerDashboardPage() {
  const t = await getTranslations("seller");
  const user = await requireSeller();
  const sellerAccountIds = await getSellerAccountIdsForUser(user.id);

  if (sellerAccountIds.length === 0) {
    return (
      <div>
        <h1 className="text-heading-2 mb-6">{t("dashboard")}</h1>
        <EmptyState
          icon={FolderOpen}
          title={t("noProjects")}
          description={t("noProjectsDesc")}
          action={
            <Link
              href="/seller/projects/new"
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-primary px-3.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/80"
            >
              <Plus className="h-4 w-4" />
              {t("createProject")}
            </Link>
          }
        />
      </div>
    );
  }

  // Fetch all seller projects
  const sellerProjects = await db
    .select({ id: projects.id, name: projects.name, slug: projects.slug })
    .from(projects)
    .where(
      and(
        inArray(projects.sellerId, sellerAccountIds),
        isNull(projects.deletedAt)
      )
    );

  const projectIds = sellerProjects.map((p) => p.id);

  if (projectIds.length === 0) {
    return (
      <div>
        <h1 className="text-heading-2 mb-6">{t("dashboard")}</h1>
        <EmptyState
          icon={FolderOpen}
          title={t("noProjects")}
          description={t("noProjectsDesc")}
          action={
            <Link
              href="/seller/projects/new"
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-primary px-3.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/80"
            >
              <Plus className="h-4 w-4" />
              {t("createProject")}
            </Link>
          }
        />
      </div>
    );
  }

  // Parallel queries for stats
  const [
    itemStats,
    perProjectStatusStats,
    listedValueResult,
    totalViewsResult,
    wishlistCountResult,
    intentCountResult,
    threadCountResult,
  ] = await Promise.all([
    // Items by status (aggregate)
    db
      .select({
        status: items.status,
        count: count(),
      })
      .from(items)
      .where(
        and(inArray(items.projectId, projectIds), isNull(items.deletedAt))
      )
      .groupBy(items.status),

    // Items by (project, status) — drives the per-project status bar.
    db
      .select({
        projectId: items.projectId,
        status: items.status,
        count: count(),
      })
      .from(items)
      .where(
        and(inArray(items.projectId, projectIds), isNull(items.deletedAt))
      )
      .groupBy(items.projectId, items.status),

    // Total listed value across all currently-available items, broken
    // down by currency. Sellers can mix USD/EUR/CAD across projects, so
    // we surface one row per currency rather than the previous
    // `min(currency)` shortcut that displayed an arbitrary single one.
    db
      .select({
        currency: items.currency,
        total: sum(items.price),
      })
      .from(items)
      .where(
        and(
          inArray(items.projectId, projectIds),
          isNull(items.deletedAt),
          eq(items.status, "available"),
          isNotNull(items.price)
        )
      )
      .groupBy(items.currency),

    // Total views
    db
      .select({ total: sum(items.viewCount) })
      .from(items)
      .where(
        and(inArray(items.projectId, projectIds), isNull(items.deletedAt))
      ),

    // Wishlist items count (items wishlisted by buyers)
    db
      .select({ count: count() })
      .from(buyerWishlistItems)
      .innerJoin(
        buyerWishlists,
        eq(buyerWishlistItems.wishlistId, buyerWishlists.id)
      )
      .where(inArray(buyerWishlists.projectId, projectIds)),

    // Purchase intents count
    db
      .select({ count: count() })
      .from(buyerIntents)
      .where(inArray(buyerIntents.projectId, projectIds)),

    // Conversation threads count
    db
      .select({ count: count() })
      .from(conversationThreads)
      .where(inArray(conversationThreads.projectId, projectIds)),
  ]);

  // Process item stats
  const statusMap: Record<string, number> = {};
  let totalItems = 0;
  for (const row of itemStats) {
    statusMap[row.status] = row.count;
    totalItems += row.count;
  }

  const availableCount = statusMap["available"] ?? 0;
  const reservedCount = statusMap["reserved"] ?? 0;
  const soldCount = statusMap["sold"] ?? 0;
  const pendingCount = statusMap["pending"] ?? 0;
  const totalViews = Number(totalViewsResult[0]?.total ?? 0);
  const wishlistCount = wishlistCountResult[0]?.count ?? 0;
  const intentCount = intentCountResult[0]?.count ?? 0;
  const threadCount = threadCountResult[0]?.count ?? 0;
  // Listed value broken down by currency. We render the largest single
  // currency as the headline number, then surface any extras as a
  // small chip row underneath so a EUR/CAD seller doesn't see a stale
  // USD$0 because the previous code picked alphabetically.
  const listedTotalsByCurrency = (
    listedValueResult as Array<{ currency: string; total: string | number }>
  )
    .map((row) => ({
      currency: row.currency,
      total: Number(row.total ?? 0),
    }))
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total);
  const listedValue = listedTotalsByCurrency[0]?.total ?? 0;
  const listedCurrency = listedTotalsByCurrency[0]?.currency ?? "USD";
  const otherListedTotals = listedTotalsByCurrency.slice(1);

  // Per-project status counts → drives the inline health bar on each card.
  type ProjectHealth = {
    available: number;
    reserved: number;
    sold: number;
    pending: number;
    total: number;
  };
  const projectHealth = new Map<string, ProjectHealth>();
  for (const row of perProjectStatusStats) {
    const entry =
      projectHealth.get(row.projectId) ?? {
        available: 0,
        reserved: 0,
        sold: 0,
        pending: 0,
        total: 0,
      };
    if (row.status === "available") entry.available += row.count;
    else if (row.status === "reserved") entry.reserved += row.count;
    else if (row.status === "sold") entry.sold += row.count;
    else if (row.status === "pending") entry.pending += row.count;
    // Hidden items don't contribute to the visible health bar.
    if (row.status !== "hidden") entry.total += row.count;
    projectHealth.set(row.projectId, entry);
  }

  // Aligned with the shared NavIconBadge tone palette so the dashboard
  // stat cards use the same colour identity as the menus.
  const statCards = [
    {
      label: t("dashboardListedValue"),
      value: formatCurrency(listedValue, listedCurrency),
      icon: DollarSign,
      color: "text-emerald-600 dark:text-emerald-300",
      bg: "bg-emerald-100/70 dark:bg-emerald-950/30",
    },
    {
      label: t("dashboardTotalItems"),
      value: totalItems.toLocaleString(),
      icon: Package,
      color: "text-orange-600 dark:text-orange-300",
      bg: "bg-orange-100/70 dark:bg-orange-950/30",
    },
    {
      label: t("dashboardTotalViews"),
      value: totalViews.toLocaleString(),
      icon: Eye,
      color: "text-indigo-600 dark:text-indigo-300",
      bg: "bg-indigo-100/70 dark:bg-indigo-950/30",
    },
    {
      label: t("dashboardWishlisted"),
      value: wishlistCount.toLocaleString(),
      icon: Heart,
      color: "text-rose-600 dark:text-rose-300",
      bg: "bg-rose-100/70 dark:bg-rose-950/30",
    },
    {
      label: t("dashboardIntents"),
      value: intentCount.toLocaleString(),
      icon: ShoppingCart,
      color: "text-amber-600 dark:text-amber-300",
      bg: "bg-amber-100/70 dark:bg-amber-950/30",
    },
    {
      label: t("dashboardConversations"),
      value: threadCount.toLocaleString(),
      icon: MessageSquare,
      color: "text-sky-600 dark:text-sky-300",
      bg: "bg-sky-100/70 dark:bg-sky-950/30",
    },
  ];

  return (
    <div>
      <h1 className="text-heading-2 mb-6">{t("dashboard")}</h1>

      {/* Quick actions — primary "+ create project", secondary
          "intents" with live count badge */}
      <div className="flex flex-wrap gap-2 mb-6">
        <Link
          href="/seller/projects/new"
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-primary px-3.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          {t("createProject")}
        </Link>
        <Link
          href="/seller/intents"
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3.5 text-sm font-medium transition-all hover:bg-muted"
        >
          <ShoppingCart className="h-4 w-4 text-amber-600 dark:text-amber-300" />
          {t("dashboardIntents")}
          {intentCount > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-100 px-1.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              {intentCount}
            </span>
          )}
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-2 stagger-fade-in">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border bg-card p-4 flex flex-col gap-2 transition-all hover:-translate-y-0.5 hover:shadow-sm"
          >
            <div className={`w-9 h-9 rounded-lg ${card.bg} flex items-center justify-center`}>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </div>
            <p className="text-2xl font-bold tabular-nums tracking-tight">
              {card.value}
            </p>
            <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
          </div>
        ))}
      </div>
      {otherListedTotals.length > 0 && (
        <div className="mb-8 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span>+</span>
          {otherListedTotals.map((row) => (
            <span
              key={row.currency}
              className="inline-flex items-center rounded-full bg-muted/50 px-2 py-0.5 text-[11px] font-medium tabular-nums"
            >
              {formatCurrency(row.total, row.currency)}
            </span>
          ))}
        </div>
      )}
      {otherListedTotals.length === 0 && <div className="mb-8" />}

      {/* Item status breakdown */}
      <div className="rounded-xl border bg-card p-5 mb-8">
        <h2 className="text-sm font-semibold mb-4">{t("dashboardItemStatus")}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: t("status.available"), count: availableCount, dot: "bg-emerald-500" },
            { label: t("status.pending"), count: pendingCount, dot: "bg-amber-500" },
            { label: t("status.reserved"), count: reservedCount, dot: "bg-red-500" },
            { label: t("status.sold"), count: soldCount, dot: "bg-gray-700 dark:bg-gray-400" },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${s.dot}`} />
              <span className="text-sm">
                {s.label}: <span className="font-semibold">{s.count}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Projects list — health cards. Each project shows a thin status
          bar (available/reserved/sold proportions) so the seller can see
          inventory state at a glance without opening the project. */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold">{t("projects")}</h2>
          <Link
            href="/seller/projects"
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            {t("dashboardViewAll")}
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {sellerProjects.map((project) => {
            const h = projectHealth.get(project.id) ?? {
              available: 0,
              reserved: 0,
              sold: 0,
              pending: 0,
              total: 0,
            };
            const denom = h.total || 1;
            const availPct = (h.available / denom) * 100;
            const reservedPct = (h.reserved / denom) * 100;
            const soldPct = (h.sold / denom) * 100;
            const pendingPct = (h.pending / denom) * 100;

            return (
              <Link
                key={project.id}
                href={`/seller/projects/${project.slug}/items`}
                className="block rounded-lg border bg-background p-3.5 transition-all hover:-translate-y-0.5 hover:shadow-sm hover:border-orange-200 dark:hover:border-orange-900"
              >
                <div className="flex items-center gap-3">
                  <FolderOpen className="h-4 w-4 text-orange-500 shrink-0" />
                  <span className="text-sm font-semibold truncate flex-1">
                    {project.name}
                  </span>
                  <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                    {h.total}
                  </span>
                </div>

                {h.total > 0 ? (
                  <>
                    <div className="flex h-1.5 rounded-full overflow-hidden mt-2 bg-muted">
                      {availPct > 0 && (
                        <div
                          className="bg-emerald-500"
                          style={{ width: `${availPct}%` }}
                        />
                      )}
                      {pendingPct > 0 && (
                        <div
                          className="bg-amber-500"
                          style={{ width: `${pendingPct}%` }}
                        />
                      )}
                      {reservedPct > 0 && (
                        <div
                          className="bg-red-500"
                          style={{ width: `${reservedPct}%` }}
                        />
                      )}
                      {soldPct > 0 && (
                        <div
                          className="bg-gray-400"
                          style={{ width: `${soldPct}%` }}
                        />
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                      {h.available > 0 && (
                        <span>
                          <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                            {h.available}
                          </span>{" "}
                          {t("status.available").toLowerCase()}
                        </span>
                      )}
                      {h.reserved > 0 && (
                        <span>
                          <span className="font-semibold text-red-700 dark:text-red-400">
                            {h.reserved}
                          </span>{" "}
                          {t("status.reserved").toLowerCase()}
                        </span>
                      )}
                      {h.sold > 0 && (
                        <span>
                          <span className="font-semibold text-foreground">
                            {h.sold}
                          </span>{" "}
                          {t("status.sold").toLowerCase()}
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {t("noItems")}
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
