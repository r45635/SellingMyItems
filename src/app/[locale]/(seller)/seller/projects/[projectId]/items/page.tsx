import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Plus, ArrowLeft, ImageOff, Eye, ClipboardList, KeyRound, Package } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { requireSeller } from "@/lib/auth";
import { db } from "@/db";
import { items, profiles, projects, sellerAccounts } from "@/db/schema";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import Image from "next/image";
import { StatusSelect } from "@/features/items/components/status-select";
import { LinkBuyerForm } from "@/features/items/components/link-buyer-form";
import { BLUR_PLACEHOLDER } from "@/lib/image/placeholders";
import { findSellerProject } from "@/lib/seller-accounts";

export default async function ProjectItemsPage({
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

  const project = sellerAccount
    ? await findSellerProject(sellerAccount.id, projectId)
    : null;

  if (!project) {
    notFound();
  }

  const projectItems = project
    ? await db
        .select({
          id: items.id,
          title: items.title,
          status: items.status,
          price: items.price,
          currency: items.currency,
          coverImageUrl: items.coverImageUrl,
          viewCount: items.viewCount,
          updatedAt: items.updatedAt,
          reservedForUserId: items.reservedForUserId,
          soldToUserId: items.soldToUserId,
          reservedForEmail: sql<string | null>`rp.email`.as("reservedForEmail"),
          soldToEmail: sql<string | null>`sp.email`.as("soldToEmail"),
        })
        .from(items)
        .leftJoin(
          sql`${profiles} as rp`,
          sql`rp.id = ${items.reservedForUserId}`
        )
        .leftJoin(
          sql`${profiles} as sp`,
          sql`sp.id = ${items.soldToUserId}`
        )
        .where(and(eq(items.projectId, project.id), isNull(items.deletedAt)))
        .orderBy(desc(items.updatedAt))
    : [];

  return (
    <div>
      <Link
        href="/seller/projects"
        className="mb-4 inline-flex h-7 items-center justify-center gap-1 rounded-lg px-2.5 text-[0.8rem] transition-all hover:bg-muted hover:text-foreground"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        {t("projects")}
      </Link>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-heading-2">{t("items")}</h1>
        <div className="flex gap-2">
          <Link
            href={`/seller/projects/${projectId}/reservations`}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-sm font-medium transition-all hover:bg-muted hover:text-foreground"
          >
            <ClipboardList className="mr-1 h-4 w-4" />
            {t("reservations")}
          </Link>
          <Link
            href={`/seller/projects/${projectId}/access`}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-sm font-medium transition-all hover:bg-muted hover:text-foreground"
          >
            <KeyRound className="mr-1 h-4 w-4" />
            Access
          </Link>
          <Link
            href={`/seller/projects/${projectId}/edit`}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-sm font-medium transition-all hover:bg-muted hover:text-foreground"
          >
            {t("editProject")}
          </Link>
          <Link
            href={`/seller/projects/${projectId}/items/new`}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/80"
          >
            <Plus className="mr-2 h-4 w-4" />
            {t("createItem")}
          </Link>
        </div>
      </div>

      {projectItems.length === 0 ? (
        <EmptyState
          icon={Package}
          title={t("noItems")}
          description={t("noItemsDesc")}
          action={
            <Link
              href={`/seller/projects/${projectId}/items/new`}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-primary px-3.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/80"
            >
              <Plus className="h-4 w-4" />
              {t("firstItem")}
            </Link>
          }
        />
      ) : (
        <div className="space-y-3 stagger-fade-in">
          {projectItems.map((item) => {
            const formattedPrice =
              item.price != null
                ? new Intl.NumberFormat(undefined, {
                    style: "currency",
                    currency: item.currency ?? "USD",
                  }).format(item.price)
                : null;

            return (
              <div
                key={item.id}
                className="rounded-xl border p-4 space-y-2 transition-shadow hover:shadow-sm"
              >
                {/* Top row: status left, price right */}
                <div className="flex items-center justify-between">
                  <StatusSelect
                    itemId={item.id}
                    projectId={projectId}
                    currentStatus={item.status}
                  />
                  {formattedPrice && (
                    <span className="font-semibold text-primary">
                      {formattedPrice}
                    </span>
                  )}
                </div>

                {/* Content row: thumbnail + title + actions */}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="relative h-12 w-12 shrink-0 rounded-md overflow-hidden bg-muted">
                      {item.coverImageUrl ? (
                        <Image
                          src={item.coverImageUrl}
                          alt={item.title}
                          fill
                          className="object-cover"
                          sizes="48px"
                          loading="lazy"
                          placeholder="blur"
                          blurDataURL={BLUR_PLACEHOLDER}
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <ImageOff className="h-5 w-5 text-muted-foreground/40" />
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{item.title}</p>
                      <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Eye className="h-3.5 w-3.5" />
                        {item.viewCount} views
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/project/${project.slug}/item/${item.id}`}
                      className="inline-flex h-8 items-center justify-center rounded-lg border border-border px-2.5 text-sm hover:bg-muted"
                    >
                      View
                    </Link>
                    <Link
                      href={`/seller/projects/${projectId}/items/${item.id}/edit`}
                      className="inline-flex h-8 items-center justify-center rounded-lg bg-primary px-2.5 text-sm text-primary-foreground hover:bg-primary/80"
                    >
                      Edit
                    </Link>
                  </div>
                </div>

                {/* Buyer link info / actions */}
                {(item.status === "reserved" || (item.status === "sold" && item.soldToEmail)) && (
                  <div className="pl-15 mt-1">
                    <LinkBuyerForm
                      itemId={item.id}
                      projectId={projectId}
                      status={item.status}
                      reservedForEmail={item.reservedForEmail}
                      soldToEmail={item.soldToEmail}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
