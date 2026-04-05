import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/db";
import { buyerWishlistItems, buyerWishlists, items, projects } from "@/db/schema";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { Link } from "@/i18n/navigation";
import { removeWishlistItemAction } from "@/features/wishlist/actions";
import { submitIntentAction } from "@/features/intents/actions";

const DEMO_SELLER_PROFILE_ID = "11111111-1111-1111-1111-111111111111";
const DEMO_GUEST_PROFILE_ID = "22222222-2222-2222-2222-222222222222";

export default async function WishlistPage() {
  const t = await getTranslations("wishlist");
  const tIntent = await getTranslations("intent");
  const user = await requireUser();

  const profileId = user.isDemo
    ? user.role === "seller"
      ? DEMO_SELLER_PROFILE_ID
      : DEMO_GUEST_PROFILE_ID
    : user.id;

  const wishlists = await db
    .select({ id: buyerWishlists.id, projectId: buyerWishlists.projectId })
    .from(buyerWishlists)
    .where(eq(buyerWishlists.userId, profileId));

  const wishlistIds = wishlists.map((wishlist) => wishlist.id);

  const rows = wishlistIds.length
    ? await db
        .select({
          itemId: items.id,
          itemTitle: items.title,
          itemStatus: items.status,
          itemPrice: items.price,
          itemCurrency: items.currency,
          projectId: projects.id,
          projectSlug: projects.slug,
          projectName: projects.name,
        })
        .from(buyerWishlistItems)
        .innerJoin(items, eq(buyerWishlistItems.itemId, items.id))
        .innerJoin(projects, eq(items.projectId, projects.id))
        .where(
          and(
            inArray(buyerWishlistItems.wishlistId, wishlistIds),
            isNull(items.deletedAt),
            isNull(projects.deletedAt)
          )
        )
    : [];

  // Group items by project
  const byProject = new Map<
    string,
    { projectName: string; projectSlug: string; items: typeof rows }
  >();

  for (const row of rows) {
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
    <div className="container px-4 md:px-6 py-8">
      <h1 className="text-2xl font-bold mb-6">{t("title")}</h1>

      {rows.length === 0 ? (
        <div className="rounded-lg border p-6 text-center text-muted-foreground">
          {t("empty")}
        </div>
      ) : (
        <div className="space-y-8">
          {Array.from(byProject.entries()).map(
            ([projectId, { projectName, projectSlug, items: projectItems }]) => (
              <div key={projectId} className="space-y-3">
                <h2 className="text-lg font-semibold">
                  <Link
                    href={`/project/${projectSlug}`}
                    className="hover:underline"
                  >
                    {projectName}
                  </Link>
                </h2>

                <div className="space-y-2">
                  {projectItems.map((row) => (
                    <div
                      key={row.itemId}
                      className="rounded-lg border p-4 flex items-center justify-between gap-4"
                    >
                      <div>
                        <Link
                          href={`/project/${row.projectSlug}/item/${row.itemId}`}
                          className="font-medium hover:underline"
                        >
                          {row.itemTitle}
                        </Link>
                        <p className="text-sm text-muted-foreground">
                          {row.itemStatus}
                          {row.itemPrice != null
                            ? ` • ${row.itemPrice} ${row.itemCurrency}`
                            : ""}
                        </p>
                      </div>

                      <form action={removeWishlistItemAction}>
                        <input type="hidden" name="itemId" value={row.itemId} />
                        <input
                          type="hidden"
                          name="returnPath"
                          value="/wishlist"
                        />
                        <button
                          type="submit"
                          className="inline-flex h-8 items-center justify-center rounded-lg border border-border px-2.5 text-sm hover:bg-muted"
                        >
                          {t("removeItem")}
                        </button>
                      </form>
                    </div>
                  ))}
                </div>

                {/* Intent submission form for this project */}
                <details className="rounded-lg border p-4">
                  <summary className="cursor-pointer font-medium text-sm">
                    {t("sendIntent")}
                  </summary>
                  <form action={submitIntentAction} className="mt-4 space-y-3">
                    {projectItems.map((row) => (
                      <input
                        key={row.itemId}
                        type="hidden"
                        name="itemId"
                        value={row.itemId}
                      />
                    ))}

                    <div>
                      <label
                        htmlFor={`phone-${projectId}`}
                        className="block text-sm font-medium mb-1"
                      >
                        {tIntent("phone")}
                      </label>
                      <input
                        id={`phone-${projectId}`}
                        name="phone"
                        type="tel"
                        className="w-full rounded-md border border-input px-3 py-2 text-sm"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor={`contact-${projectId}`}
                        className="block text-sm font-medium mb-1"
                      >
                        {tIntent("contactMethod")}
                      </label>
                      <select
                        id={`contact-${projectId}`}
                        name="contactMethod"
                        defaultValue="email"
                        className="w-full rounded-md border border-input px-3 py-2 text-sm"
                      >
                        <option value="email">{tIntent("email")}</option>
                        <option value="phone">{tIntent("phoneOption")}</option>
                        <option value="app_message">
                          {tIntent("appMessage")}
                        </option>
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor={`notes-${projectId}`}
                        className="block text-sm font-medium mb-1"
                      >
                        {tIntent("pickupNotes")}
                      </label>
                      <textarea
                        id={`notes-${projectId}`}
                        name="pickupNotes"
                        rows={2}
                        className="w-full rounded-md border border-input px-3 py-2 text-sm"
                      />
                    </div>

                    <button
                      type="submit"
                      className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/80"
                    >
                      {tIntent("submit")}
                    </button>
                  </form>
                </details>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
