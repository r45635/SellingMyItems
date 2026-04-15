import { getTranslations } from "next-intl/server";
import { ItemForm } from "@/features/items/components/item-form";
import { Link } from "@/i18n/navigation";
import { ArrowLeft } from "lucide-react";
import { requireSeller } from "@/lib/auth";
import { db } from "@/db";
import { projectCategories, sellerAccounts } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { findSellerProject } from "@/lib/seller-accounts";

export default async function NewItemPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const t = await getTranslations("seller");
  const user = await requireSeller();

  const sellerAccount = await db.query.sellerAccounts.findFirst({
    where: eq(sellerAccounts.userId, user.id),
  });

  if (!sellerAccount) {
    notFound();
  }

  const ownedProject = await findSellerProject(sellerAccount.id, projectId);

  if (!ownedProject) {
    notFound();
  }

  const categories = await db
    .select({ id: projectCategories.id, name: projectCategories.name })
    .from(projectCategories)
    .where(eq(projectCategories.projectId, projectId))
    .orderBy(asc(projectCategories.sortOrder), asc(projectCategories.name));

  return (
    <div className="max-w-2xl">
      <Link
        href={`/seller/projects/${projectId}/items`}
        className="mb-4 inline-flex h-7 items-center justify-center gap-1 rounded-lg px-2.5 text-[0.8rem] transition-all hover:bg-muted hover:text-foreground"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        {t("items")}
      </Link>
      <h1 className="text-2xl font-bold mb-6">{t("createItem")}</h1>
      <ItemForm projectId={projectId} categories={categories} />
    </div>
  );
}
