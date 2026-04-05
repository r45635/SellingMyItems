import { getTranslations } from "next-intl/server";
import { ItemForm } from "@/features/items/components/item-form";
import { Link } from "@/i18n/navigation";
import { ArrowLeft } from "lucide-react";
import { requireSeller } from "@/lib/auth";
import { db } from "@/db";
import { items, itemImages, itemLinks, projectCategories, projects, sellerAccounts } from "@/db/schema";
import { and, asc, eq, isNull } from "drizzle-orm";
import { notFound } from "next/navigation";

const DEMO_SELLER_PROFILE_ID = "11111111-1111-1111-1111-111111111111";

export default async function EditItemPage({
  params,
}: {
  params: Promise<{ projectId: string; itemId: string }>;
}) {
  const { projectId, itemId } = await params;
  const t = await getTranslations("seller");
  const user = await requireSeller();

  const profileId = user.isDemo ? DEMO_SELLER_PROFILE_ID : user.id;
  const sellerAccount = await db.query.sellerAccounts.findFirst({
    where: eq(sellerAccounts.userId, profileId),
  });

  if (!sellerAccount) {
    notFound();
  }

  const ownedProject = await db.query.projects.findFirst({
    where: and(
      eq(projects.id, projectId),
      eq(projects.sellerId, sellerAccount.id),
      isNull(projects.deletedAt)
    ),
  });

  if (!ownedProject) {
    notFound();
  }

  const item = await db.query.items.findFirst({
    where: and(
      eq(items.id, itemId),
      eq(items.projectId, projectId),
      isNull(items.deletedAt)
    ),
  });

  if (!item) {
    notFound();
  }

  const categories = await db
    .select({ id: projectCategories.id, name: projectCategories.name })
    .from(projectCategories)
    .where(eq(projectCategories.projectId, projectId))
    .orderBy(asc(projectCategories.sortOrder), asc(projectCategories.name));

  const existingImages = await db
    .select({ url: itemImages.url, altText: itemImages.altText })
    .from(itemImages)
    .where(eq(itemImages.itemId, itemId))
    .orderBy(asc(itemImages.sortOrder));

  const existingLinks = await db
    .select({ url: itemLinks.url, label: itemLinks.label })
    .from(itemLinks)
    .where(eq(itemLinks.itemId, itemId));

  return (
    <div className="max-w-2xl">
      <Link
        href={`/seller/projects/${projectId}/items`}
        className="mb-4 inline-flex h-7 items-center justify-center gap-1 rounded-lg px-2.5 text-[0.8rem] transition-all hover:bg-muted hover:text-foreground"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        {t("items")}
      </Link>
      <h1 className="text-2xl font-bold mb-6">{t("editItem")}</h1>
      <ItemForm
        projectId={projectId}
        itemId={itemId}
        categories={categories}
        existingImages={existingImages}
        existingLinks={existingLinks}
        defaultValues={{
          title: item.title,
          brand: item.brand ?? "",
          description: item.description ?? "",
          condition: item.condition ?? "",
          approximateAge: item.approximateAge ?? "",
          price: item.price ?? undefined,
          currency: (item.currency as "USD" | "EUR" | "CAD") ?? "USD",
          notes: item.notes ?? "",
          categoryId: item.categoryId ?? undefined,
          status: item.status,
        }}
      />
    </div>
  );
}
