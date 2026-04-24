import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/db";
import { items, projects } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { Link } from "@/i18n/navigation";
import Image from "next/image";
import { ImageOff, Package, Clock, MessageCircle } from "lucide-react";
import { BLUR_PLACEHOLDER } from "@/lib/image/placeholders";
import { Badge } from "@/components/ui/badge";

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
}

export default async function ReservationsPage() {
  const t = await getTranslations("reservations");
  const tItem = await getTranslations("item");
  const user = await requireUser();

  // Find all items reserved for this user
  const reservedItems = await db
    .select({
      itemId: items.id,
      itemTitle: items.title,
      itemPrice: items.price,
      itemCurrency: items.currency,
      itemCoverImageUrl: items.coverImageUrl,
      itemReservedAt: items.reservedAt,
      projectId: projects.id,
      projectSlug: projects.slug,
      projectName: projects.name,
    })
    .from(items)
    .innerJoin(projects, eq(items.projectId, projects.id))
    .where(
      and(
        eq(items.reservedForUserId, user.id),
        eq(items.status, "reserved"),
        isNull(items.deletedAt),
        isNull(projects.deletedAt)
      )
    );

  // Group by project
  const byProject = new Map<
    string,
    { projectName: string; projectSlug: string; items: typeof reservedItems }
  >();

  for (const row of reservedItems) {
    if (!byProject.has(row.projectId)) {
      byProject.set(row.projectId, {
        projectName: row.projectName,
        projectSlug: row.projectSlug,
        items: [],
      });
    }
    byProject.get(row.projectId)!.items.push(row);
  }

  return (
    <div className="container px-4 md:px-6 py-6">
      <h1 className="text-2xl font-bold mb-4">{t("title")}</h1>

      {reservedItems.length === 0 ? (
        <div className="rounded-lg border p-6 text-center text-muted-foreground">
          <Package className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
          {t("empty")}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-lg border border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/30 p-4 text-sm text-orange-800 dark:text-orange-200">
            {t("description")}
          </div>

          {Array.from(byProject.entries()).map(
            ([projectId, { projectName, projectSlug, items: projectItems }]) => {
              const total = projectItems.reduce((sum, i) => sum + (i.itemPrice ?? 0), 0);
              const currency = projectItems[0]?.itemCurrency ?? "USD";

              return (
                <div key={projectId} className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-lg font-semibold">
                      <Link
                        href={`/project/${projectSlug}`}
                        className="hover:underline"
                      >
                        {projectName}
                      </Link>
                      <span className="ml-2 text-sm font-normal text-muted-foreground">
                        {t("itemCount", { count: projectItems.length })}
                      </span>
                    </h2>
                    <Link
                      href={`/messages/new?projectId=${projectId}`}
                      className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 text-xs font-medium transition-all hover:bg-muted"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      {t("contactSeller")}
                    </Link>
                  </div>

                  <div className="space-y-2">
                    {projectItems.map((row) => (
                      <div
                        key={row.itemId}
                        className="rounded-lg border border-orange-200 bg-orange-50/50 dark:border-orange-900 dark:bg-orange-950/10 p-3 flex items-center gap-3"
                      >
                        <Link
                          href={`/project/${row.projectSlug}/item/${row.itemId}`}
                          className="shrink-0"
                        >
                          <div className="relative w-14 h-14 rounded-md overflow-hidden bg-muted">
                            {row.itemCoverImageUrl ? (
                              <Image
                                src={row.itemCoverImageUrl}
                                alt={row.itemTitle}
                                fill
                                className="object-cover"
                                sizes="56px"
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
                        </Link>

                        <div className="flex-1 min-w-0">
                          <Link
                            href={`/project/${row.projectSlug}/item/${row.itemId}`}
                            className="font-medium hover:underline line-clamp-1 text-sm"
                          >
                            {row.itemTitle}
                          </Link>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge className="bg-red-600 text-white border-red-600 hover:bg-red-600 font-bold text-[10px] px-2 py-0.5">
                              {t("reservedForYou")}
                            </Badge>
                            {row.itemReservedAt && (
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
                                  new Date(row.itemReservedAt)
                                )}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          {row.itemPrice != null && (
                            <p className="font-bold text-primary text-sm">
                              {formatCurrency(row.itemPrice, row.itemCurrency)}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {total > 0 && (
                    <div className="rounded-lg bg-muted/50 px-4 py-3 text-sm flex items-center justify-between">
                      <span className="text-muted-foreground">{t("projectTotal")}</span>
                      <span className="font-bold text-primary">
                        {formatCurrency(total, currency)}
                      </span>
                    </div>
                  )}
                </div>
              );
            }
          )}
        </div>
      )}
    </div>
  );
}
