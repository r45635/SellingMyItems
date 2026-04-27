import { ItemTeaserCard } from "@/components/shared/item-teaser-card";
import { ProjectItemsGrid } from "@/features/items/components/project-items-grid";
import { InvitationGate } from "@/features/projects/components/invitation-gate";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { MapPin, ArrowLeft, Package, User, Mail, Lock, ArrowRight, MessageCircle } from "lucide-react";
import { db } from "@/db";
import { buyerWishlistItems, buyerWishlists, items, profiles, projectCategories, projects, sellerAccounts } from "@/db/schema";
import { and, asc, eq, isNull, ne } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { getUser } from "@/lib/auth";
import { computeProjectAccessState } from "@/lib/access";
import { getTranslations } from "next-intl/server";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}) {
  const { slug, locale } = await params;
  const project = await db.query.projects.findFirst({
    where: and(
      eq(projects.slug, slug),
      eq(projects.isPublic, true),
      eq(projects.publishStatus, "approved"),
      isNull(projects.deletedAt)
    ),
  });

  if (!project) {
    notFound();
  }

  const sellerRows = await db
    .select({
      isActive: profiles.isActive,
      displayName: profiles.displayName,
      email: profiles.email,
      emailVisibility: profiles.emailVisibility,
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
      viewCount: items.viewCount,
      price: items.price,
      reservedForUserId: items.reservedForUserId,
    })
    .from(items)
    .where(and(eq(items.projectId, project.id), isNull(items.deletedAt), ne(items.status, "hidden")))
    .orderBy(asc(items.sortOrder), asc(items.createdAt));

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

  const t = await getTranslations("project");
  const tWishlist = await getTranslations("wishlist");
  const tInv = await getTranslations("invitations");

  const isInvitationOnly = project.visibility === "invitation_only";
  let accessState: "granted" | "pending" | "declined" | "none" = "granted";
  if (isInvitationOnly) {
    if (user) {
      accessState = await computeProjectAccessState(user.id, user.email, project.id);
    } else {
      accessState = "none";
    }
  }
  const isLocked = isInvitationOnly && accessState !== "granted";

  const availableCount = projectItems.filter((i) => i.status === "available").length;

  return (
    <div className="flex flex-col">
      <section className="relative overflow-hidden border-b bg-gradient-to-b from-orange-50/70 via-background to-background">
        <div className="absolute inset-0 bg-dot-pattern opacity-40 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
        <div
          className="pointer-events-none absolute -top-24 right-0 h-64 w-64 rounded-full bg-orange-200/40 blur-3xl dark:bg-orange-900/20"
          aria-hidden
        />

        <div className="container relative px-4 py-6 md:px-6 md:py-10">
          <Link
            href="/"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("backToProjects")}
          </Link>

          <div className="mt-6 grid gap-6 md:grid-cols-3 md:gap-8 animate-fade-up">
            <div className="md:col-span-2 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                {project.cityArea && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border bg-card/80 px-2.5 py-1 text-xs font-medium backdrop-blur">
                    <MapPin className="h-3.5 w-3.5 text-orange-500" />
                    {project.cityArea}
                  </span>
                )}
                {isInvitationOnly && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
                    <Lock className="h-3.5 w-3.5" />
                    {tInv("visibilityInvitation")}
                  </span>
                )}
              </div>

              <h1 className="text-heading-1 bg-gradient-to-br from-foreground via-foreground to-orange-600 bg-clip-text text-transparent dark:to-orange-400">
                {project.name}
              </h1>

              {project.description && (
                <p className="text-lead max-w-2xl">{project.description}</p>
              )}

              {categories.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {categories.map((category) => (
                    <Badge key={category.id} variant="outline" className="rounded-full">
                      {category.name}
                    </Badge>
                  ))}
                </div>
              )}

              {projectItems.length > 0 && !isLocked && (
                <div className="flex items-center gap-4 pt-2 text-sm">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Package className="h-4 w-4" />
                    <span>
                      <span className="font-semibold text-foreground tabular-nums">
                        {projectItems.length}
                      </span>{" "}
                      {t("itemCount", { count: projectItems.length })}
                    </span>
                  </div>
                  {availableCount < projectItems.length && (
                    <span className="text-muted-foreground">
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {availableCount}
                      </span>{" "}
                      {t("filterAvailable").toLowerCase()}
                    </span>
                  )}
                </div>
              )}
            </div>

            {user && !isLocked && (
              <div className="md:col-span-1">
                <div className="rounded-xl border bg-card/80 p-4 backdrop-blur shadow-sm space-y-3">
                  <p className="text-eyebrow">{t("contactSeller")}</p>
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-600 dark:bg-orange-950/50 dark:text-orange-400">
                      <User className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-sm">
                        {sellerInfo.displayName ?? t("contactSeller")}
                      </p>
                      {sellerInfo.emailVisibility === "direct" ? (
                        <a
                          href={`mailto:${sellerInfo.email}`}
                          className="inline-flex items-center gap-1 truncate text-xs text-muted-foreground hover:text-primary transition-colors"
                        >
                          <Mail className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{sellerInfo.email}</span>
                        </a>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          {t("contactViaAppHint")}
                        </p>
                      )}
                    </div>
                  </div>
                  <Link
                    href={`/messages/new?projectId=${project.id}`}
                    className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3.5 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90"
                  >
                    <MessageCircle className="h-4 w-4" />
                    {t("sendMessageCta")}
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="py-8 md:py-10">
        <div className="container px-4 md:px-6">
          {isLocked ? (
            <InvitationGate
              projectId={project.id}
              projectSlug={slug}
              locale={locale}
              isAuthenticated={!!user}
              requestState={accessState === "none" ? "none" : (accessState as "pending" | "declined")}
              labels={{
                lockedTitle: tInv("lockedTitle"),
                lockedBody: tInv("lockedBody"),
                signIn: tInv("signInFirst"),
                enterCode: tInv("enterCode"),
                code: tInv("code"),
                redeem: tInv("redeem"),
                orRequest: tInv("orRequest"),
                messageLabel: tInv("messageLabel"),
                messagePlaceholder: tInv("messagePlaceholder"),
                requestAccess: tInv("requestAccess"),
                pendingTitle: tInv("pendingTitle"),
                pendingBody: tInv("pendingBody"),
                declinedTitle: tInv("declinedTitle"),
                declinedBody: tInv("declinedBody"),
                grantedTitle: tInv("grantedInlineTitle"),
                invalidCode: tInv("invalidCode"),
                codeForAnotherUser: tInv("codeForAnotherUser"),
                genericError: tInv("genericError"),
              }}
            />
          ) : user ? (
            projectItems.length > 0 ? (
              <ProjectItemsGrid
                items={projectItems}
                slug={slug}
                userId={user.id}
                wishlistedItemIds={Array.from(wishlistedItemIds)}
                labels={{
                  addToFavorites: tWishlist("addToFavorites"),
                  removeFromFavorites: tWishlist("removeFromFavorites"),
                  confirmRemove: tWishlist("confirmRemove"),
                  addedToWishlist: tWishlist("addedToWishlist"),
                  removedFromWishlist: tWishlist("removedFromWishlist"),
                }}
              />
            ) : (
              <EmptyState
                icon={Package}
                title={t("noItems")}
                description={t("noItemsDesc")}
              />
            )
          ) : (
            <div>
              {projectItems.length > 0 && (
                <div className="mb-4 flex items-center gap-2">
                  <Package className="h-5 w-5 text-orange-500" />
                  <h2 className="text-heading-4">{t("itemsHeading")}</h2>
                </div>
              )}
              <div className="relative overflow-hidden rounded-2xl">
                <div
                  className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 blur-sm pointer-events-none select-none"
                  aria-hidden="true"
                >
                  {projectItems.length > 0
                    ? projectItems.slice(0, 8).map((item) => (
                        <ItemTeaserCard
                          key={item.id}
                          title={item.title}
                          coverImageUrl={item.coverImageUrl}
                          status={item.status}
                          updatedAt={item.updatedAt}
                          viewCount={item.viewCount}
                        />
                      ))
                    : Array.from({ length: 4 }).map((_, i) => (
                        <div
                          key={`placeholder-${i}`}
                          className="aspect-square rounded-xl bg-gradient-to-br from-orange-100 to-amber-50 dark:from-orange-950/40 dark:to-amber-950/30"
                        />
                      ))}
                </div>
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background/70 px-6 text-center backdrop-blur-sm">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 text-orange-600 ring-8 ring-orange-50/60 dark:bg-orange-950/50 dark:text-orange-400 dark:ring-orange-950/20">
                    <Lock className="h-5 w-5" />
                  </div>
                  <div className="max-w-sm space-y-1">
                    <p className="font-semibold">{t("guestOverlayTitle")}</p>
                    <p className="text-sm text-muted-foreground">
                      {t("guestOverlayBody")}
                    </p>
                  </div>
                  <Link
                    href={`/login?returnTo=/project/${slug}`}
                    className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow"
                  >
                    {t("guestSignIn")}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
