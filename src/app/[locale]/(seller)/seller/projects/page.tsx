import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Plus, FolderOpen, MapPinOff } from "lucide-react";
import { requireSeller } from "@/lib/auth";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { and, desc, inArray, isNull } from "drizzle-orm";
import { getSellerAccountIdsForUser } from "@/lib/seller-accounts";
import { EmptyState } from "@/components/shared/empty-state";
import {
  PublishStatusBadge,
  SubmitForReviewButton,
} from "@/features/projects/components/publish-status-controls";

export default async function SellerProjectsPage() {
  const t = await getTranslations("seller");
  const user = await requireSeller();

  const profileId = user.id;

  const sellerAccountIds = await getSellerAccountIdsForUser(profileId);

  const sellerProjects = sellerAccountIds.length > 0
    ? await db
        .select({
          id: projects.id,
          name: projects.name,
          slug: projects.slug,
          cityArea: projects.cityArea,
          createdAt: projects.createdAt,
          publishStatus: projects.publishStatus,
          reviewerNote: projects.reviewerNote,
          // Coords drive whether the project shows up in radius
          // searches. NULL = invisible to "Near me" filters even if
          // cityArea is set, so we want to flag this on the card.
          latitude: projects.latitude,
          longitude: projects.longitude,
        })
        .from(projects)
        .where(
          and(
            inArray(projects.sellerId, sellerAccountIds),
            isNull(projects.deletedAt)
          )
        )
        .orderBy(desc(projects.createdAt))
    : [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-heading-2">{t("projects")}</h1>
        <Link
          href="/seller/projects/new"
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-primary px-3.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          {t("createProject")}
        </Link>
      </div>

      {sellerProjects.length === 0 ? (
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
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 stagger-fade-in">
          {sellerProjects.map((project) => (
            <div
              key={project.id}
              className="rounded-lg border p-4 flex flex-col gap-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium truncate">{project.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    /{project.slug} · {project.cityArea}
                  </p>
                </div>
                <PublishStatusBadge status={project.publishStatus} />
              </div>
              {(project.latitude == null || project.longitude == null) && (
                <Link
                  href={`/seller/projects/${project.slug}/edit`}
                  className="inline-flex items-center gap-1.5 self-start rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-800 hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:bg-amber-950/50"
                  title={t("locationMissingHint")}
                >
                  <MapPinOff className="h-3 w-3" />
                  {t("locationMissing")}
                </Link>
              )}
              <SubmitForReviewButton
                projectIdOrSlug={project.slug}
                status={project.publishStatus}
                reviewerNote={project.reviewerNote}
              />
              <div className="flex items-center gap-2 pt-1 border-t">
                {project.publishStatus === "approved" ? (
                  <Link
                    href={`/project/${project.slug}`}
                    className="inline-flex h-8 items-center justify-center rounded-lg border border-border px-2.5 text-sm hover:bg-muted"
                  >
                    {t("viewPublic")}
                  </Link>
                ) : null}
                <Link
                  href={`/seller/projects/${project.slug}/items`}
                  className="ml-auto inline-flex h-8 items-center justify-center rounded-lg bg-primary px-2.5 text-sm text-primary-foreground hover:bg-primary/80"
                >
                  {t("items")}
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
