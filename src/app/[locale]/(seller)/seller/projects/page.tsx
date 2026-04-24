import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Plus, FolderOpen } from "lucide-react";
import { requireSeller } from "@/lib/auth";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { and, desc, inArray, isNull } from "drizzle-orm";
import { getSellerAccountIdsForUser } from "@/lib/seller-accounts";
import { EmptyState } from "@/components/shared/empty-state";

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
              className="rounded-lg border p-4 flex items-center justify-between gap-4"
            >
              <div>
                <p className="font-medium">{project.name}</p>
                <p className="text-sm text-muted-foreground">
                  /project/{project.slug} • {project.cityArea}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/project/${project.slug}`}
                  className="inline-flex h-8 items-center justify-center rounded-lg border border-border px-2.5 text-sm hover:bg-muted"
                >
                  Voir
                </Link>
                <Link
                  href={`/seller/projects/${project.slug}/items`}
                  className="inline-flex h-8 items-center justify-center rounded-lg bg-primary px-2.5 text-sm text-primary-foreground hover:bg-primary/80"
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
