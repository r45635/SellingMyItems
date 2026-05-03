import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { db } from "@/db";
import {
  profiles,
  items,
  itemImages,
  itemFiles,
  itemLinks,
  buyerIntents,
  buyerIntentItems,
  conversationThreads,
  conversationMessages,
  buyerWishlists,
  buyerWishlistItems,
  emailLogs,
  sellerAccounts,
  projects,
} from "@/db/schema";
import { eq, inArray } from "drizzle-orm";

const EXPORT_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * GDPR Art. 20 — right to data portability.
 * Returns a JSON download of all personal data for the authenticated user.
 * Rate-limited to 1 export per 24 hours per user.
 */
export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check rate limit via the DB timestamp (survives restarts, multi-instance safe).
  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.id, user.id),
    columns: {
      id: true,
      email: true,
      displayName: true,
      phone: true,
      emailVisibility: true,
      preferredLocale: true,
      distanceUnit: true,
      defaultCurrency: true,
      countryCode: true,
      postalCode: true,
      isAdmin: true,
      isActive: true,
      createdAt: true,
      lastDataExportAt: true,
    },
  });

  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (profile.lastDataExportAt) {
    const since = Date.now() - profile.lastDataExportAt.getTime();
    if (since < EXPORT_COOLDOWN_MS) {
      const retryAfterSec = Math.ceil((EXPORT_COOLDOWN_MS - since) / 1000);
      return NextResponse.json(
        { error: "rate_limited", retryAfterSeconds: retryAfterSec },
        {
          status: 429,
          headers: { "Retry-After": String(retryAfterSec) },
        }
      );
    }
  }

  // ── Seller items ──────────────────────────────────────────────────────────
  const sellerAccount = await db.query.sellerAccounts.findFirst({
    where: eq(sellerAccounts.userId, user.id),
    columns: { id: true },
  });

  const sellerProjects = sellerAccount
    ? await db
        .select()
        .from(projects)
        .where(eq(projects.sellerId, sellerAccount.id))
    : [];

  const sellerProjectIds = sellerProjects.map((p) => p.id);

  const sellerItems =
    sellerProjectIds.length > 0
      ? await db
          .select()
          .from(items)
          .where(inArray(items.projectId, sellerProjectIds))
      : [];

  const sellerItemIds = sellerItems.map((i) => i.id);

  const [sellerImages, sellerFiles, sellerLinks] = await Promise.all([
    sellerItemIds.length > 0
      ? db.select().from(itemImages).where(inArray(itemImages.itemId, sellerItemIds))
      : [],
    sellerItemIds.length > 0
      ? db.select().from(itemFiles).where(inArray(itemFiles.itemId, sellerItemIds))
      : [],
    sellerItemIds.length > 0
      ? db.select().from(itemLinks).where(inArray(itemLinks.itemId, sellerItemIds))
      : [],
  ]);

  // ── Buyer intents ─────────────────────────────────────────────────────────
  const intents = await db
    .select()
    .from(buyerIntents)
    .where(eq(buyerIntents.userId, user.id));

  const intentIds = intents.map((i) => i.id);
  const intentItems =
    intentIds.length > 0
      ? await db
          .select()
          .from(buyerIntentItems)
          .where(inArray(buyerIntentItems.intentId, intentIds))
      : [];

  // ── Messages ──────────────────────────────────────────────────────────────
  const threads = await db
    .select()
    .from(conversationThreads)
    .where(eq(conversationThreads.buyerId, user.id));

  const threadIds = threads.map((t) => t.id);
  const messages =
    threadIds.length > 0
      ? await db
          .select()
          .from(conversationMessages)
          .where(inArray(conversationMessages.threadId, threadIds))
      : [];

  // ── Wishlist ──────────────────────────────────────────────────────────────
  const wishlists = await db
    .select()
    .from(buyerWishlists)
    .where(eq(buyerWishlists.userId, user.id));

  const wishlistIds = wishlists.map((w) => w.id);
  const wishlistItems =
    wishlistIds.length > 0
      ? await db
          .select()
          .from(buyerWishlistItems)
          .where(inArray(buyerWishlistItems.wishlistId, wishlistIds))
      : [];

  // ── Email logs (last 90 days, already purged beyond that) ─────────────────
  const emailHistory = await db
    .select()
    .from(emailLogs)
    .where(eq(emailLogs.toEmail, profile.email));

  // ── Assemble export ───────────────────────────────────────────────────────
  const exportData = {
    exportedAt: new Date().toISOString(),
    profile: {
      email: profile.email,
      displayName: profile.displayName,
      phone: profile.phone,
      emailVisibility: profile.emailVisibility,
      preferredLocale: profile.preferredLocale,
      distanceUnit: profile.distanceUnit,
      defaultCurrency: profile.defaultCurrency,
      countryCode: profile.countryCode,
      postalCode: profile.postalCode,
      accountCreatedAt: profile.createdAt,
    },
    seller: sellerAccount
      ? {
          projects: sellerProjects,
          items: sellerItems.map((item) => ({
            ...item,
            images: sellerImages.filter((img) => img.itemId === item.id),
            files: sellerFiles.filter((f) => f.itemId === item.id),
            links: sellerLinks.filter((l) => l.itemId === item.id),
          })),
        }
      : null,
    buyerActivity: {
      intents: intents.map((intent) => ({
        ...intent,
        items: intentItems.filter((ii) => ii.intentId === intent.id),
      })),
      conversations: threads.map((thread) => ({
        ...thread,
        messages: messages.filter((m) => m.threadId === thread.id),
      })),
      wishlistItems,
    },
    emailHistory,
  };

  // Stamp the export time so we can enforce the 24 h cooldown.
  await db
    .update(profiles)
    .set({ lastDataExportAt: new Date() })
    .where(eq(profiles.id, user.id));

  const filename = `my-data-${new Date().toISOString().split("T")[0]}.json`;

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
