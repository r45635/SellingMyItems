import { getTranslations } from "next-intl/server";
import { requireSeller } from "@/lib/auth";
import { db } from "@/db";
import {
  buyerIntentItems,
  buyerIntents,
  items,
  profiles,
  projects,
} from "@/db/schema";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { updateIntentStatusAction } from "@/features/intents/actions";
import { getSellerAccountIdsForUser } from "@/lib/seller-accounts";

export default async function SellerIntentsPage() {
  const t = await getTranslations("seller");
  const tIntent = await getTranslations("intent");
  const user = await requireSeller();
  const profileId = user.id;

  const sellerAccountIds = await getSellerAccountIdsForUser(profileId);

  if (sellerAccountIds.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">{t("intents")}</h1>
        <div className="rounded-lg border p-6 text-center text-muted-foreground">
          {t("noProjects")}
        </div>
      </div>
    );
  }

  const sellerProjects = await db
    .select({ id: projects.id })
    .from(projects)
    .where(
      and(
        inArray(projects.sellerId, sellerAccountIds),
        isNull(projects.deletedAt)
      )
    );

  const projectIds = sellerProjects.map((p) => p.id);

  if (projectIds.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">{t("intents")}</h1>
        <div className="rounded-lg border p-6 text-center text-muted-foreground">
          {t("noProjects")}
        </div>
      </div>
    );
  }

  const intents = await db.query.buyerIntents.findMany({
    where: inArray(buyerIntents.projectId, projectIds),
    orderBy: [desc(buyerIntents.createdAt)],
  });

  // Enrich intents with items and buyer info
  const enrichedIntents = await Promise.all(
    intents.map(async (intent) => {
      const intentItems = await db
        .select({
          itemId: items.id,
          itemTitle: items.title,
          itemPrice: items.price,
          itemCurrency: items.currency,
        })
        .from(buyerIntentItems)
        .innerJoin(items, eq(buyerIntentItems.itemId, items.id))
        .where(eq(buyerIntentItems.intentId, intent.id));

      const buyer = await db.query.profiles.findFirst({
        where: eq(profiles.id, intent.userId),
      });

      const project = await db.query.projects.findFirst({
        where: eq(projects.id, intent.projectId),
      });

      return {
        ...intent,
        items: intentItems,
        buyerEmail: buyer?.email ?? "Unknown",
        buyerName: buyer?.displayName ?? "Unknown",
        projectName: project?.name ?? "Unknown",
      };
    })
  );

  const statusColor: Record<string, string> = {
    submitted: "bg-blue-100 text-blue-800",
    reviewed: "bg-yellow-100 text-yellow-800",
    accepted: "bg-green-100 text-green-800",
    declined: "bg-red-100 text-red-800",
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t("intents")}</h1>

      {enrichedIntents.length === 0 ? (
        <div className="rounded-lg border p-6 text-center text-muted-foreground">
          No purchase intents received yet
        </div>
      ) : (
        <div className="space-y-4">
          {enrichedIntents.map((intent) => (
            <div key={intent.id} className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">
                    {intent.buyerName} ({intent.buyerEmail})
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {intent.projectName} •{" "}
                    {new Date(intent.createdAt).toLocaleDateString()}
                  </p>
                  {intent.phone && (
                    <p className="text-sm text-muted-foreground">
                      {tIntent("phone")}: {intent.phone}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    {tIntent("contactMethod")}: {intent.contactMethod}
                  </p>
                  {intent.pickupNotes && (
                    <p className="text-sm text-muted-foreground">
                      {tIntent("pickupNotes")}: {intent.pickupNotes}
                    </p>
                  )}
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor[intent.status] ?? ""}`}
                >
                  {intent.status}
                </span>
              </div>

              <div className="text-sm">
                <p className="font-medium mb-1">Items:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  {intent.items.map((item) => (
                    <li key={item.itemId}>
                      {item.itemTitle}
                      {item.itemPrice != null
                        ? ` — ${item.itemPrice} ${item.itemCurrency}`
                        : ""}
                    </li>
                  ))}
                </ul>
              </div>

              {intent.status === "submitted" && (
                <div className="flex gap-2">
                  <form
                    action={async () => {
                      "use server";
                      await updateIntentStatusAction(intent.id, "accepted");
                    }}
                  >
                    <button
                      type="submit"
                      className="inline-flex h-8 items-center justify-center rounded-lg bg-green-600 px-3 text-sm text-white hover:bg-green-700"
                    >
                      Accept
                    </button>
                  </form>
                  <form
                    action={async () => {
                      "use server";
                      await updateIntentStatusAction(intent.id, "declined");
                    }}
                  >
                    <button
                      type="submit"
                      className="inline-flex h-8 items-center justify-center rounded-lg bg-red-600 px-3 text-sm text-white hover:bg-red-700"
                    >
                      Decline
                    </button>
                  </form>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
