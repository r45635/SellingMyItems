import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { db } from "@/db";
import {
  buyerWishlists,
  buyerWishlistItems,
  buyerIntents,
  conversationThreads,
  projects,
  projectAccessGrants,
  projectAccessRequests,
} from "@/db/schema";
import { and, count, eq, inArray, isNull } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { Lock, Heart, Globe, MapPin, Clock, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MyProjectsFilters } from "@/features/projects/components/my-projects-filters";

type BuyerRel = "granted" | "pending" | "declined" | "none";

type ProjectCard = {
  id: string;
  name: string;
  slug: string;
  cityArea: string;
  description: string | null;
  visibility: "public" | "invitation_only";
  wishlistCount: number;
  buyerRel: BuyerRel;
};

async function collectProjectIds(userId: string): Promise<string[]> {
  const [wlRows, grantRows, reqRows, intentRows, threadRows] = await Promise.all([
    db
      .select({ pid: buyerWishlists.projectId })
      .from(buyerWishlists)
      .where(eq(buyerWishlists.userId, userId)),
    db
      .select({ pid: projectAccessGrants.projectId })
      .from(projectAccessGrants)
      .where(
        and(
          eq(projectAccessGrants.userId, userId),
          isNull(projectAccessGrants.revokedAt)
        )
      ),
    db
      .select({ pid: projectAccessRequests.projectId })
      .from(projectAccessRequests)
      .where(eq(projectAccessRequests.userId, userId)),
    db
      .select({ pid: buyerIntents.projectId })
      .from(buyerIntents)
      .where(eq(buyerIntents.userId, userId)),
    db
      .select({ pid: conversationThreads.projectId })
      .from(conversationThreads)
      .where(eq(conversationThreads.buyerId, userId)),
  ]);

  const set = new Set<string>();
  for (const r of [...wlRows, ...grantRows, ...reqRows, ...intentRows, ...threadRows]) {
    set.add(r.pid);
  }
  return [...set];
}

export default async function MyProjectsPage() {
  const user = await requireUser();
  const t = await getTranslations("myProjects");

  const projectIds = await collectProjectIds(user.id);

  if (projectIds.length === 0) {
    return (
      <div className="container px-4 md:px-6 py-6">
        <h1 className="text-2xl font-bold mb-4">{t("title")}</h1>
        <div className="rounded-xl border-2 border-dashed p-12 text-center text-muted-foreground">
          {t("empty")}
        </div>
      </div>
    );
  }

  const [projectRows, grantRows, requestRows, wishlistCountRows] =
    await Promise.all([
      db
        .select({
          id: projects.id,
          name: projects.name,
          slug: projects.slug,
          cityArea: projects.cityArea,
          description: projects.description,
          visibility: projects.visibility,
        })
        .from(projects)
        .where(
          and(
            inArray(projects.id, projectIds),
            eq(projects.isPublic, true),
            isNull(projects.deletedAt)
          )
        ),
      db
        .select({ projectId: projectAccessGrants.projectId })
        .from(projectAccessGrants)
        .where(
          and(
            eq(projectAccessGrants.userId, user.id),
            isNull(projectAccessGrants.revokedAt),
            inArray(projectAccessGrants.projectId, projectIds)
          )
        ),
      db
        .select({
          projectId: projectAccessRequests.projectId,
          status: projectAccessRequests.status,
        })
        .from(projectAccessRequests)
        .where(
          and(
            eq(projectAccessRequests.userId, user.id),
            inArray(projectAccessRequests.projectId, projectIds)
          )
        ),
      db
        .select({
          projectId: buyerWishlists.projectId,
          count: count(),
        })
        .from(buyerWishlistItems)
        .innerJoin(
          buyerWishlists,
          eq(buyerWishlistItems.wishlistId, buyerWishlists.id)
        )
        .where(eq(buyerWishlists.userId, user.id))
        .groupBy(buyerWishlists.projectId),
    ]);

  const grantedSet = new Set(grantRows.map((r) => r.projectId));
  const latestRequestPerProject = new Map<string, "pending" | "declined" | "approved" | "cancelled">();
  for (const r of requestRows) {
    // Ignore older declined if there's a later pending; order not guaranteed here but
    // pending wins > declined > cancelled > approved for UX purposes.
    const cur = latestRequestPerProject.get(r.projectId);
    if (!cur || r.status === "pending" || (cur !== "pending" && r.status === "declined")) {
      latestRequestPerProject.set(r.projectId, r.status);
    }
  }
  const wlCount = new Map(wishlistCountRows.map((r) => [r.projectId, r.count]));

  const cards: ProjectCard[] = projectRows.map((p) => {
    let buyerRel: BuyerRel = "none";
    if (grantedSet.has(p.id)) buyerRel = "granted";
    else {
      const req = latestRequestPerProject.get(p.id);
      if (req === "pending") buyerRel = "pending";
      else if (req === "declined") buyerRel = "declined";
    }
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      cityArea: p.cityArea,
      description: p.description,
      visibility: p.visibility,
      wishlistCount: wlCount.get(p.id) ?? 0,
      buyerRel,
    };
  });

  // Sort: favorites first (wishlist desc), then alphabetical
  cards.sort((a, b) => {
    if (a.wishlistCount !== b.wishlistCount) {
      return b.wishlistCount - a.wishlistCount;
    }
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="container px-4 md:px-6 py-6">
      <h1 className="text-2xl font-bold mb-4">{t("title")}</h1>
      <MyProjectsFilters
        labels={{
          filterAll: t("filterAll"),
          filterFavorites: t("filterFavorites"),
          filterInvitation: t("filterInvitation"),
          filterPublic: t("filterPublic"),
          filterAccessRequired: t("filterAccessRequired"),
        }}
      >
        {cards.map((card) => {
          const filterTags: string[] = [];
          if (card.wishlistCount > 0) filterTags.push("favorites");
          if (card.visibility === "invitation_only" && card.buyerRel === "granted") filterTags.push("invitation");
          if (card.visibility === "public") filterTags.push("public");
          if (card.visibility === "invitation_only" && card.buyerRel !== "granted") filterTags.push("accessRequired");

          return (
            <Link
              key={card.id}
              data-filter-tags={filterTags.join(",")}
              href={`/project/${card.slug}`}
              className="group relative rounded-xl border bg-card p-4 transition-all hover:shadow-md hover:border-orange-200"
            >
              <div className="flex items-start justify-between gap-2 flex-wrap mb-2">
                <h3 className="text-lg font-semibold group-hover:text-orange-600 transition-colors">
                  {card.name}
                </h3>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {card.visibility === "public" ? (
                    <Badge
                      variant="outline"
                      className="rounded-full text-xs gap-1 border-green-200 bg-green-50 text-green-700"
                    >
                      <Globe className="h-3 w-3" />
                      {t("publicBadge")}
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="rounded-full text-xs gap-1 border-amber-200 bg-amber-50 text-amber-700"
                    >
                      <Lock className="h-3 w-3" />
                      {t("invitationBadge")}
                    </Badge>
                  )}
                  {card.wishlistCount > 0 && (
                    <Badge
                      variant="outline"
                      className="rounded-full text-xs gap-1 border-orange-200 bg-orange-50 text-orange-700"
                    >
                      <Heart className="h-3 w-3 fill-current" />
                      {card.wishlistCount}
                    </Badge>
                  )}
                </div>
              </div>

              {card.cityArea && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
                  <MapPin className="h-3 w-3" />
                  <span>{card.cityArea}</span>
                </div>
              )}

              {card.description && (
                <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                  {card.description}
                </p>
              )}

              {card.visibility === "invitation_only" && (
                <div className="flex items-center gap-1.5 text-xs">
                  {card.buyerRel === "granted" ? (
                    <span className="text-green-700 font-medium">
                      ✓ {t("withAccess")}
                    </span>
                  ) : card.buyerRel === "pending" ? (
                    <span className="text-amber-700 font-medium inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {t("pending")}
                    </span>
                  ) : card.buyerRel === "declined" ? (
                    <span className="text-destructive font-medium inline-flex items-center gap-1">
                      <X className="h-3 w-3" />
                      {t("declined")}
                    </span>
                  ) : (
                    <span className="text-muted-foreground inline-flex items-center gap-1">
                      <Lock className="h-3 w-3" />
                      {t("noAccess")}
                    </span>
                  )}
                </div>
              )}
            </Link>
          );
        })}
      </MyProjectsFilters>
    </div>
  );
}
