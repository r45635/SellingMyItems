import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Plus, ArrowLeft, ImageOff } from "lucide-react";
import { requireSeller } from "@/lib/auth";
import { db } from "@/db";
import { items, projects, sellerAccounts } from "@/db/schema";
import { and, desc, eq, isNull } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { notFound } from "next/navigation";
import Image from "next/image";

const DEMO_SELLER_PROFILE_ID = "11111111-1111-1111-1111-111111111111";

export default async function ProjectItemsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const t = await getTranslations("seller");
  const user = await requireSeller();

  const profileId = user.isDemo ? DEMO_SELLER_PROFILE_ID : user.id;
  const sellerAccount = await db.query.sellerAccounts.findFirst({
    where: eq(sellerAccounts.userId, profileId),
  });

  const project = sellerAccount
    ? await db.query.projects.findFirst({
        where: and(
          eq(projects.id, projectId),
          eq(projects.sellerId, sellerAccount.id),
          isNull(projects.deletedAt)
        ),
      })
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
          updatedAt: items.updatedAt,
        })
        .from(items)
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
        <h1 className="text-2xl font-bold">{t("items")}</h1>
        <div className="flex gap-2">
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
        <div className="rounded-lg border p-6 text-center text-muted-foreground">
          {t("noItems")}
        </div>
      ) : (
        <div className="space-y-3">
          {projectItems.map((item) => {
            const formattedPrice =
              item.price != null
                ? new Intl.NumberFormat(undefined, {
                    style: "currency",
                    currency: item.currency ?? "USD",
                  }).format(item.price)
                : null;

            const badgeVariant =
              item.status === "sold"
                ? "destructive"
                : item.status === "pending" || item.status === "reserved"
                  ? "secondary"
                  : item.status === "hidden"
                    ? "outline"
                    : "default";

            return (
              <div
                key={item.id}
                className="rounded-lg border p-4 space-y-2"
              >
                {/* Top row: status left, price right */}
                <div className="flex items-center justify-between">
                  <Badge variant={badgeVariant}>
                    {t(`status.${item.status}`)}
                  </Badge>
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
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <ImageOff className="h-5 w-5 text-muted-foreground/40" />
                        </div>
                      )}
                    </div>
                    <p className="font-medium">{item.title}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/project/${project.slug}/item/${item.id}`}
                      className="inline-flex h-8 items-center justify-center rounded-lg border border-border px-2.5 text-sm hover:bg-muted"
                    >
                      Voir
                    </Link>
                    <Link
                      href={`/seller/projects/${projectId}/items/${item.id}/edit`}
                      className="inline-flex h-8 items-center justify-center rounded-lg bg-primary px-2.5 text-sm text-primary-foreground hover:bg-primary/80"
                    >
                      Modifier
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
