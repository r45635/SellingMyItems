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
} from "lucide-react";
import { requireSeller } from "@/lib/auth";
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
        <h1 className="text-2xl font-bold mb-6">{t("dashboard")}</h1>
        <p className="text-muted-foreground">{t("noProjects")}</p>
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
        <h1 className="text-2xl font-bold mb-6">{t("dashboard")}</h1>
        <p className="text-muted-foreground">{t("noProjects")}</p>
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

  const statCards = [
    {
      label: t("dashboardTotalItems"),
      value: totalItems,
      icon: Package,
      color: "text-blue-600",
      bg: "bg-blue-50 dark:bg-blue-950",
    },
    {
      label: t("dashboardTotalViews"),
      value: totalViews,
      icon: Eye,
      color: "text-purple-600",
      bg: "bg-purple-50 dark:bg-purple-950",
    },
    {
      label: t("dashboardWishlisted"),
      value: wishlistCount,
      icon: Heart,
      color: "text-pink-600",
      bg: "bg-pink-50 dark:bg-pink-950",
    },
    {
      label: t("dashboardIntents"),
      value: intentCount,
      icon: ShoppingCart,
      color: "text-green-600",
      bg: "bg-green-50 dark:bg-green-950",
    },
    {
      label: t("dashboardConversations"),
      value: threadCount,
      icon: MessageSquare,
      color: "text-orange-600",
      bg: "bg-orange-50 dark:bg-orange-950",
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t("dashboard")}</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border bg-card p-4 flex flex-col gap-2"
          >
            <div className={`w-8 h-8 rounded-lg ${card.bg} flex items-center justify-center`}>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </div>
            <p className="text-2xl font-bold">{card.value.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Item status breakdown */}
      <div className="rounded-xl border bg-card p-5 mb-8">
        <h2 className="text-sm font-semibold mb-4">{t("dashboardItemStatus")}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: t("status.available"), count: availableCount, dot: "bg-green-500" },
            { label: t("status.pending"), count: pendingCount, dot: "bg-yellow-500" },
            { label: t("status.reserved"), count: reservedCount, dot: "bg-blue-500" },
            { label: t("status.sold"), count: soldCount, dot: "bg-gray-400" },
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
