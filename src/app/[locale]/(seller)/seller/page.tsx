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
  count,
  sum,
  sql,
} from "drizzle-orm";
import { getSellerAccountIdsForUser } from "@/lib/seller-accounts";

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
    totalViewsResult,
    wishlistCountResult,
    intentCountResult,
    threadCountResult,
  ] = await Promise.all([
    // Items by status
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

  // Aligned with the shared NavIconBadge tone palette so the dashboard
  // stat cards use the same colour identity as the menus.
  const statCards = [
    {
      label: t("dashboardTotalItems"),
      value: totalItems,
      icon: Package,
      color: "text-orange-600 dark:text-orange-300",
      bg: "bg-orange-100/70 dark:bg-orange-950/30",
    },
    {
      label: t("dashboardTotalViews"),
      value: totalViews,
      icon: Eye,
      color: "text-indigo-600 dark:text-indigo-300",
      bg: "bg-indigo-100/70 dark:bg-indigo-950/30",
    },
    {
      label: t("dashboardWishlisted"),
      value: wishlistCount,
      icon: Heart,
      color: "text-rose-600 dark:text-rose-300",
      bg: "bg-rose-100/70 dark:bg-rose-950/30",
    },
    {
      label: t("dashboardIntents"),
      value: intentCount,
      icon: ShoppingCart,
      color: "text-amber-600 dark:text-amber-300",
      bg: "bg-amber-100/70 dark:bg-amber-950/30",
    },
    {
      label: t("dashboardConversations"),
      value: threadCount,
      icon: MessageSquare,
      color: "text-emerald-600 dark:text-emerald-300",
      bg: "bg-emerald-100/70 dark:bg-emerald-950/30",
    },
  ];

  return (
    <div>
      <h1 className="text-heading-2 mb-6">{t("dashboard")}</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8 stagger-fade-in">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border bg-card p-4 flex flex-col gap-2 transition-all hover:-translate-y-0.5 hover:shadow-sm"
          >
            <div className={`w-9 h-9 rounded-lg ${card.bg} flex items-center justify-center`}>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </div>
            <p className="text-2xl font-bold tabular-nums tracking-tight">
              {card.value.toLocaleString()}
            </p>
            <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
          </div>
        ))}
      </div>

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

      {/* Projects list */}
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
        <div className="space-y-2">
          {sellerProjects.map((project) => (
            <Link
              key={project.id}
              href={`/seller/projects/${project.slug}`}
              className="flex items-center gap-3 rounded-lg p-3 hover:bg-muted transition-colors"
            >
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{project.name}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
