import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ArrowLeft } from "lucide-react";
import { requireSeller } from "@/lib/auth";
import { db } from "@/db";
import { emailLogs, items, profiles, sellerAccounts } from "@/db/schema";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { findSellerProject } from "@/lib/seller-accounts";
import {
  ReservationsBulkPanel,
  type BuyerData,
} from "./reservations-bulk-panel";

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

  // Build the typed buyer array for the client panel.
  // lastRecapAt is serialized as an ISO string (safe across the RSC boundary).
  const buyerList: BuyerData[] = buyers.map((buyer) => ({
    userId: buyer.userId,
    realEmail: buyer.realEmail,
    displayEmail: buyer.displayEmail,
    displayName: buyer.displayName,
    lastRecapAt:
      (lastRecapByEmail.get(buyer.realEmail) ?? null)?.toISOString() ?? null,
    items: buyer.items.map((item) => ({
      id: item.id,
      title: item.title,
      price: item.price,
      currency: item.currency,
      coverImageUrl: item.coverImageUrl,
    })),
  }));

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

      {buyerList.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed p-12 text-center text-muted-foreground">
          {t("noReservations")}
        </div>
      ) : (
        <ReservationsBulkPanel
          buyers={buyerList}
          projectId={projectId}
          locale={locale}
        />
      )}
    </div>
  );
}
