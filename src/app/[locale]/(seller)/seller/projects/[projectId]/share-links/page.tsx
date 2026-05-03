import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { ArrowLeft, Share2 } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireSeller } from "@/lib/auth";
import { db } from "@/db";
import { sellerAccounts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { findSellerProject } from "@/lib/seller-accounts";
import { getProjectShareLinksAction } from "@/features/items/share-actions";
import { RevokeShareLinkButton } from "@/features/items/components/revoke-share-link-button";
import { LocalizedDateTime } from "@/components/shared/localized-date-time";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";

export default async function SellerProjectShareLinksPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const user = await requireSeller();
  const t = await getTranslations("share");

  const sellerAccount = await db.query.sellerAccounts.findFirst({
    where: eq(sellerAccounts.userId, user.id),
  });
  const project = sellerAccount
    ? await findSellerProject(sellerAccount.id, projectId)
    : null;
  if (!project) notFound();

  const result = await getProjectShareLinksAction(project.id);
  if ("error" in result) notFound();

  const links = result;

  return (
    <div className="space-y-4">
      <Link
        href={`/seller/projects/${project.id}/items`}
        className="inline-flex h-7 items-center justify-center gap-1 rounded-lg px-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {project.name}
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("shareLinksTitle")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("shareLinksDesc")}</p>
        </div>
      </div>

      {links.length === 0 ? (
        <EmptyState
          icon={Share2}
          title={t("shareLinksTitle")}
          description={t("shareLinksEmpty")}
        />
      ) : (
        <div className="rounded-xl border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-muted-foreground">
                <th className="px-4 py-3 text-left font-medium">{t("shareLinkItem")}</th>
                <th className="px-4 py-3 text-left font-medium">{t("shareLinkCreatedBy")}</th>
                <th className="px-4 py-3 text-left font-medium">{t("shareLinkCreated")}</th>
                <th className="px-4 py-3 text-left font-medium">{t("shareLinkExpires")}</th>
                <th className="px-4 py-3 text-left font-medium">{t("shareLinkStatus")}</th>
                <th className="px-4 py-3 text-left font-medium sr-only">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {links.map((link) => {
                const isRevoked = link.revokedAt !== null;
                const isExpired = link.isExpired;
                const isActive = !isRevoked && !isExpired;

                return (
                  <tr key={link.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium max-w-[180px] truncate">
                      {link.itemTitle}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {link.createdByEmail}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <LocalizedDateTime value={link.createdAt} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <LocalizedDateTime value={link.expiresAt} />
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs font-semibold",
                          isActive &&
                            "border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300",
                          isExpired &&
                            "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-300",
                          isRevoked &&
                            "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
                        )}
                      >
                        {isRevoked
                          ? t("shareLinkRevoked")
                          : isExpired
                            ? t("shareLinkExpired")
                            : t("shareLinkActive")}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {isActive && (
                        <RevokeShareLinkButton linkId={link.id} />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
