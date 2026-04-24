import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ArrowLeft, ImageOff, User, Package, Clock } from "lucide-react";
import { requireSeller } from "@/lib/auth";
import { db } from "@/db";
import { emailLogs, items, profiles, sellerAccounts } from "@/db/schema";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { notFound } from "next/navigation";
import Image from "next/image";
import { BLUR_PLACEHOLDER } from "@/lib/image/placeholders";
import { SendRecapEmailForm } from "@/features/seller-dashboard/components/send-recap-email-form";
import { LocalizedDateTime } from "@/components/shared/localized-date-time";
import { getLocale } from "next-intl/server";
import { findSellerProject } from "@/lib/seller-accounts";

export default async function ProjectReservationsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const t = await getTranslations("seller");
  const locale = await getLocale();
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

  // Get all reserved items with buyer info
  const reservedItems = await db
    .select({
      id: items.id,
      title: items.title,
      price: items.price,
      currency: items.currency,
      coverImageUrl: items.coverImageUrl,
      reservedForUserId: items.reservedForUserId,
      reservedAt: items.reservedAt,
      buyerEmail: profiles.email,
      buyerEmailVisibility: profiles.emailVisibility,
      buyerDisplayName: profiles.displayName,
    })
    .from(items)
    .innerJoin(profiles, eq(items.reservedForUserId, profiles.id))
    .where(
      and(
        eq(items.projectId, project.id),
        eq(items.status, "reserved"),
        isNull(items.deletedAt)
      )
    )
    .orderBy(desc(items.reservedAt));

  // Group by buyer. Keep real email separately from the display email so we
  // can query email_logs even when the buyer chose hidden visibility.
  const buyerMap = new Map<
    string,
    {
      userId: string;
      realEmail: string;
      displayEmail: string;
      displayName: string | null;
      items: typeof reservedItems;
    }
  >();

  for (const item of reservedItems) {
    const buyerId = item.reservedForUserId!;
    if (!buyerMap.has(buyerId)) {
      buyerMap.set(buyerId, {
        userId: buyerId,
        realEmail: item.buyerEmail,
        displayEmail:
          item.buyerEmailVisibility === "direct" ? item.buyerEmail : "",
        displayName: item.buyerDisplayName,
        items: [],
      });
    }
    buyerMap.get(buyerId)!.items.push(item);
  }

  const buyers = Array.from(buyerMap.values());

  // Last-recap-sent per buyer: latest sent reservation_recap in email_logs
  // whose `toEmail` matches one of this page's buyers.
  const lastRecapByEmail = new Map<string, Date>();
  const buyerEmails = buyers.map((b) => b.realEmail).filter(Boolean);
  if (buyerEmails.length > 0) {
    const recapLogs = await db
      .select({
        toEmail: emailLogs.toEmail,
        createdAt: emailLogs.createdAt,
      })
      .from(emailLogs)
      .where(
        and(
          eq(emailLogs.type, "reservation_recap"),
          eq(emailLogs.status, "sent"),
          inArray(emailLogs.toEmail, buyerEmails)
        )
      )
      .orderBy(desc(emailLogs.createdAt));
    for (const row of recapLogs) {
      if (!lastRecapByEmail.has(row.toEmail)) {
        lastRecapByEmail.set(row.toEmail, row.createdAt);
      }
    }
  }

  return (
    <div>
      <Link
        href={`/seller/projects/${projectId}/items`}
        className="mb-4 inline-flex h-7 items-center justify-center gap-1 rounded-lg px-2.5 text-[0.8rem] transition-all hover:bg-muted hover:text-foreground"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        {t("items")}
      </Link>

      <h1 className="text-2xl font-bold mb-6">{t("reservations")}</h1>

      {buyers.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed p-12 text-center text-muted-foreground">
          {t("noReservations")}
        </div>
      ) : (
        <div className="space-y-6">
          {buyers.map((buyer) => {
            const buyerName = buyer.displayName || buyer.displayEmail || "Buyer";
            const total = buyer.items.reduce(
              (sum, i) => sum + (i.price ?? 0),
              0
            );
            const currency = buyer.items[0]?.currency ?? "USD";
            const formattedTotal = new Intl.NumberFormat(undefined, {
              style: "currency",
              currency,
            }).format(total);
            const lastRecapAt = lastRecapByEmail.get(buyer.realEmail) ?? null;

            return (
              <div
                key={buyer.userId}
                className="rounded-xl border bg-card overflow-hidden"
              >
                {/* Buyer header */}
                <div className="flex items-center justify-between gap-3 bg-muted/50 px-5 py-4 border-b">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{buyerName}</p>
                      {buyer.displayName && buyer.displayEmail && (
                        <p className="text-xs text-muted-foreground">
                          {buyer.displayEmail}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">
                      {t("reservationItemCount", {
                        count: buyer.items.length,
                      })}
                    </p>
                    <p className="font-semibold text-sm">{formattedTotal}</p>
                  </div>
                </div>

                {/* Items list */}
                <div className="divide-y">
                  {buyer.items.map((item) => {
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
                        className="flex items-center gap-3 px-5 py-3"
                      >
                        <div className="relative h-10 w-10 shrink-0 rounded-md overflow-hidden bg-muted">
                          {item.coverImageUrl ? (
                            <Image
                              src={item.coverImageUrl}
                              alt={item.title}
                              fill
                              className="object-cover"
                              sizes="40px"
                              loading="lazy"
                              placeholder="blur"
                              blurDataURL={BLUR_PLACEHOLDER}
                            />
                          ) : (
                            <div className="flex items-center justify-center h-full">
                              <ImageOff className="h-4 w-4 text-muted-foreground/40" />
                            </div>
                          )}
                        </div>
                        <p className="text-sm font-medium flex-1">
                          {item.title}
                        </p>
                        {formattedPrice && (
                          <span className="text-sm font-semibold text-primary">
                            {formattedPrice}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Email action */}
                <div className="px-5 py-4 border-t bg-muted/30 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      {t("recapEmailDescription")}
                    </p>
                    {lastRecapAt && (
                      <p className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {t("lastRecapSent")}:{" "}
                        <LocalizedDateTime value={lastRecapAt} />
                      </p>
                    )}
                  </div>
                  <SendRecapEmailForm
                    projectId={projectId}
                    buyerUserId={buyer.userId}
                    buyerName={buyerName}
                    locale={locale}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
