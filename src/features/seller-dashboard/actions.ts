"use server";

import { requireSeller } from "@/lib/auth";
import { db } from "@/db";
import {
  conversationMessages,
  conversationThreads,
  items,
  profiles,
  sellerAccounts,
} from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { sendReservationRecapEmail } from "@/lib/email";
import { siteConfig } from "@/config";
import { findSellerProject } from "@/lib/seller-accounts";
import { revalidatePath } from "next/cache";
import { buildRecapPayload, recapPdfFilename } from "@/lib/pdf/build-recap-payload";
import { renderProjectRecapPdf } from "@/lib/pdf/project-recap-pdf";

/**
 * Build a plain-text recap body that will show up as a regular seller
 * message inside the conversation thread. Mirrors the email layout without
 * HTML — bullet list of items + total + optional personal message.
 */
function buildRecapMessageBody(
  locale: string,
  projectName: string,
  reservedItems: { title: string; price: number | null; currency: string }[],
  personalMessage: string
): string {
  const fr = locale === "fr";
  const lines: string[] = [];
  lines.push(
    fr
      ? `📋 Récapitulatif de vos articles réservés — ${projectName}`
      : `📋 Your reserved items — ${projectName}`
  );
  lines.push("");
  for (const item of reservedItems) {
    const priceStr =
      item.price != null
        ? new Intl.NumberFormat(fr ? "fr-FR" : "en-US", {
            style: "currency",
            currency: item.currency,
          }).format(item.price)
        : fr
          ? "Prix non défini"
          : "Price not set";
    lines.push(`• ${item.title} — ${priceStr}`);
  }
  const total = reservedItems.reduce((sum, i) => sum + (i.price ?? 0), 0);
  const totalCurrency = reservedItems[0]?.currency ?? "USD";
  const totalStr = new Intl.NumberFormat(fr ? "fr-FR" : "en-US", {
    style: "currency",
    currency: totalCurrency,
  }).format(total);
  lines.push("");
  lines.push(fr ? `Total : ${totalStr}` : `Total: ${totalStr}`);

  if (personalMessage.trim()) {
    lines.push("");
    lines.push("---");
    lines.push(personalMessage.trim());
  }

  return lines.join("\n");
}

function revalidateRecapPaths(
  projectIdOrSlug: string,
  threadId: string
) {
  // Re-fetch both sides of the conversation (buyer + seller) and the seller's
  // reservations page, for every locale variant the user may be viewing.
  for (const locale of siteConfig.locales) {
    revalidatePath(`/${locale}/messages`);
    revalidatePath(`/${locale}/messages/${threadId}`);
    revalidatePath(`/${locale}/seller/messages`);
    revalidatePath(`/${locale}/seller/messages/${threadId}`);
    revalidatePath(
      `/${locale}/seller/projects/${projectIdOrSlug}/reservations`
    );
  }
  // Unlocalized paths as belt-and-suspenders.
  revalidatePath(`/messages`);
  revalidatePath(`/seller/messages`);
  revalidatePath(`/seller/projects/${projectIdOrSlug}/reservations`);
}

export async function sendReservationRecapAction(
  projectIdOrSlug: string,
  buyerUserId: string,
  message: string,
  locale: string,
  options?: { attachPdf?: boolean }
) {
  const user = await requireSeller();

  // Verify seller owns this project (accepts UUID or slug from the URL).
  const sellerAccount = await db.query.sellerAccounts.findFirst({
    where: eq(sellerAccounts.userId, user.id),
  });
  if (!sellerAccount) {
    return { error: "Seller account not found" };
  }

  const project = await findSellerProject(sellerAccount.id, projectIdOrSlug);
  if (!project) {
    return { error: "Project not found" };
  }

  const buyer = await db.query.profiles.findFirst({
    where: eq(profiles.id, buyerUserId),
    columns: { id: true, email: true, displayName: true },
  });
  if (!buyer) {
    return { error: "Buyer not found" };
  }

  const sellerProfile = await db.query.profiles.findFirst({
    where: eq(profiles.id, user.id),
    columns: { displayName: true, email: true },
  });

  const reservedItems = await db
    .select({
      title: items.title,
      price: items.price,
      currency: items.currency,
    })
    .from(items)
    .where(
      and(
        eq(items.projectId, project.id),
        eq(items.reservedForUserId, buyerUserId),
        eq(items.status, "reserved"),
        isNull(items.deletedAt)
      )
    );

  if (reservedItems.length === 0) {
    return { error: "No reserved items found for this buyer" };
  }

  // Find-or-create the buyer↔project conversation thread so the recap lives
  // alongside any existing messages. Mirrors startConversationAction's shape.
  let thread = await db.query.conversationThreads.findFirst({
    where: and(
      eq(conversationThreads.projectId, project.id),
      eq(conversationThreads.buyerId, buyerUserId)
    ),
  });
  const now = new Date();
  if (!thread) {
    const [created] = await db
      .insert(conversationThreads)
      .values({
        projectId: project.id,
        buyerId: buyerUserId,
        sellerLastReadAt: now,
      })
      .returning();
    thread = created;
  }

  const messageBody = buildRecapMessageBody(
    locale,
    project.name,
    reservedItems.map((i) => ({
      title: i.title,
      price: i.price,
      currency: i.currency,
    })),
    message
  );

  // Persist the recap as a normal seller message so the buyer sees it in the
  // conversation and the seller sees what they sent.
  await db.insert(conversationMessages).values({
    threadId: thread.id,
    senderId: user.id,
    body: messageBody,
  });

  // Mark the thread updated; the seller has implicitly read everything up to
  // "now" by being the one who just wrote.
  await db
    .update(conversationThreads)
    .set({ updatedAt: now, sellerLastReadAt: now })
    .where(eq(conversationThreads.id, thread.id));

  const buyerName = buyer.displayName || buyer.email;
  const sellerName =
    sellerProfile?.displayName || sellerProfile?.email || "Seller";
  const projectUrl = `${siteConfig.url}/${locale}/project/${project.slug}`;
  const threadUrl = `${siteConfig.url}/${locale}/messages/${thread.id}`;
  const reservationsUrl = `${siteConfig.url}/${locale}/reservations`;

  // Optionally render the buyer-scoped PDF and attach it. Filter to this
  // buyer's reserved items only so the recipient receives a recap of what's
  // actually reserved for them.
  let attachment: { filename: string; content: Buffer } | undefined;
  if (options?.attachPdf) {
    try {
      const reservedRows = await db
        .select({ id: items.id })
        .from(items)
        .where(
          and(
            eq(items.projectId, project.id),
            eq(items.reservedForUserId, buyerUserId),
            eq(items.status, "reserved"),
            isNull(items.deletedAt)
          )
        );
      const itemIds = reservedRows.map((r) => r.id);
      if (itemIds.length > 0) {
        const payload = await buildRecapPayload(project, {
          itemIds,
          locale,
          subtitle:
            locale === "fr"
              ? `Réservation pour ${buyerName}`
              : `Reservation for ${buyerName}`,
        });
        const pdfBuffer = await renderProjectRecapPdf(payload);
        attachment = {
          filename: recapPdfFilename(
            project.slug,
            buyerName.replace(/[^a-zA-Z0-9]+/g, "-").slice(0, 32)
          ),
          content: pdfBuffer,
        };
      }
    } catch (err) {
      console.error("Failed to build recap PDF attachment:", err);
      // Don't block the email if the PDF fails — surface as a warning later.
    }
  }

  const result = await sendReservationRecapEmail(
    buyer.email,
    buyerName,
    sellerName,
    project.name,
    reservedItems.map((i) => ({
      title: i.title,
      price: i.price,
      currency: i.currency,
    })),
    message,
    projectUrl,
    threadUrl,
    reservationsUrl,
    locale,
    attachment ? { attachment } : undefined
  );

  revalidateRecapPaths(projectIdOrSlug, thread.id);

  if (!result.ok) {
    // Message was already persisted in-app, so surface the email failure but
    // don't roll back the conversation — the buyer still has an in-app trace.
    return {
      success: true,
      threadId: thread.id,
      emailError: result.error || "Failed to send email",
    };
  }

  return { success: true, threadId: thread.id };
}
