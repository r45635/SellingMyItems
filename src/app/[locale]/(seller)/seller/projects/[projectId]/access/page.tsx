import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireSeller } from "@/lib/auth";
import { db } from "@/db";
import { sellerAccounts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { findSellerProject } from "@/lib/seller-accounts";
import { getProjectAccessData } from "@/features/projects/invitations-actions";
import { AccessManagement } from "@/features/projects/components/access-management";

export default async function SellerProjectAccessPage({
  params,
}: {
  params: Promise<{ projectId: string; locale: string }>;
}) {
  const { projectId, locale } = await params;
  const user = await requireSeller();
  const t = await getTranslations("invitations");

  const sellerAccount = await db.query.sellerAccounts.findFirst({
    where: eq(sellerAccounts.userId, user.id),
  });
  const project = sellerAccount
    ? await findSellerProject(sellerAccount.id, projectId)
    : null;
  if (!project) notFound();

  const data = await getProjectAccessData(project.id);
  if (!data) notFound();

  return (
    <div className="space-y-4">
      <Link
        href={`/seller/projects/${project.id}/items`}
        className="inline-flex h-7 items-center justify-center gap-1 rounded-lg px-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {project.name}
      </Link>
      <h1 className="text-2xl font-bold">{t("accessTab")}</h1>

      <AccessManagement
        projectId={project.id}
        visibility={data.project.visibility}
        invitations={data.invitations.map((i) => ({
          id: i.id,
          code: i.code,
          email: i.email,
          status: i.status,
          expiresAt: i.expiresAt,
          usedAt: i.usedAt,
          createdAt: i.createdAt,
        }))}
        requests={data.requests}
        grants={data.grants}
        locale={locale}
        labels={{
          visibilityLabel: t("visibilityLabel"),
          visibilityPublic: t("visibilityPublic"),
          visibilityInvitation: t("visibilityInvitation"),
          visibilityPublicHint: t("visibilityPublicHint"),
          visibilityInvitationHint: t("visibilityInvitationHint"),
          toggleConfirmTitle: t("toggleConfirmTitle"),
          toggleConfirmBody: t("toggleConfirmBody"),
          confirm: t("confirm"),
          cancel: t("cancel"),
          tabInvitations: t("tabInvitations"),
          tabRequests: t("tabRequests"),
          tabGrants: t("tabGrants"),
          tabGenericCode: t("tabGenericCode"),
          createTargetedTitle: t("createTargetedTitle"),
          createTargetedHint: t("createTargetedHint"),
          emailPlaceholder: t("emailPlaceholder"),
          validity: t("validity"),
          days7: t("days7"),
          days30: t("days30"),
          days90: t("days90"),
          createInvitation: t("createInvitation"),
          genericCodeTitle: t("genericCodeTitle"),
          genericCodeHint: t("genericCodeHint"),
          generateGeneric: t("generateGeneric"),
          regenerateGeneric: t("regenerateGeneric"),
          currentCode: t("currentCode"),
          expiresAt: t("expiresAt"),
          pendingRequestsTitle: t("pendingRequestsTitle"),
          pendingRequestsEmpty: t("pendingRequestsEmpty"),
          approve: t("approve"),
          decline: t("decline"),
          grantedTitle: t("grantedTitle"),
          grantedEmpty: t("grantedEmpty"),
          revoke: t("revoke"),
          revokeConfirm: t("revokeConfirm"),
          invitationsList: t("invitationsList"),
          invitationsEmpty: t("invitationsEmpty"),
          statusActive: t("statusActive"),
          statusUsed: t("statusUsed"),
          statusExpired: t("statusExpired"),
          statusRevoked: t("statusRevoked"),
        }}
      />
    </div>
  );
}
