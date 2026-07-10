import { getTranslations } from "next-intl/server";
import { ProjectForm } from "@/features/projects/components/project-form";
import { CoSellersSection } from "@/features/projects/components/co-sellers-section";
import { Link } from "@/i18n/navigation";
import { ArrowLeft } from "lucide-react";
import { requireSeller } from "@/lib/auth";
import { db } from "@/db";
import { profiles, projectCollaborators, sellerAccounts } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { findSellerProject, isProjectOwner } from "@/lib/seller-accounts";
import { type CountryCode } from "@/lib/countries";

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const t = await getTranslations("seller");
  const user = await requireSeller();

  const profileId = user.id;
  const sellerAccount = await db.query.sellerAccounts.findFirst({
    where: eq(sellerAccounts.userId, profileId),
  });

  if (!sellerAccount) {
    notFound();
  }

  const project = await findSellerProject(sellerAccount.id, projectId);

  if (!project) {
    notFound();
  }

  const ownerFlag = await isProjectOwner(sellerAccount.id, project.id);

  const collaboratorRows = await db
    .select({
      sellerAccountId: projectCollaborators.sellerAccountId,
      displayName: profiles.displayName,
      email: profiles.email,
    })
    .from(projectCollaborators)
    .innerJoin(sellerAccounts, eq(projectCollaborators.sellerAccountId, sellerAccounts.id))
    .innerJoin(profiles, eq(sellerAccounts.userId, profiles.id))
    .where(
      and(
        eq(projectCollaborators.projectId, project.id)
      )
    );

  return (
    <div className="max-w-2xl">
      <Link
        href="/seller/projects"
        className="mb-4 inline-flex h-7 items-center justify-center gap-1 rounded-lg px-2.5 text-[0.8rem] transition-all hover:bg-muted hover:text-foreground"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        {t("projects")}
      </Link>
      <h1 className="text-2xl font-bold mb-6">{t("editProject")}</h1>
      <ProjectForm
        projectId={projectId}
        defaultValues={{
          name: project.name,
          slug: project.slug,
          cityArea: project.cityArea,
          description: project.description ?? "",
          countryCode: (project.countryCode ?? undefined) as
            | CountryCode
            | undefined,
          postalCode: project.postalCode ?? "",
          radiusKm: project.radiusKm ?? undefined,
          isSeoIndexable: project.isSeoIndexable,
        }}
      />
      <div className="mt-6">
        <CoSellersSection
          projectId={project.id}
          isOwner={ownerFlag}
          collaborators={collaboratorRows}
        />
      </div>
    </div>
  );
}
