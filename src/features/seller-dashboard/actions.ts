"use server";

import { requireSeller } from "@/lib/auth";
import { db } from "@/db";
import { items, profiles, projects, sellerAccounts } from "@/db/schema";
import { and, eq, isNull, inArray } from "drizzle-orm";
import { sendReservationRecapEmail } from "@/lib/email";
import { siteConfig } from "@/config";

export async function sendReservationRecapAction(
  projectId: string,
  buyerUserId: string,
  message: string,
  locale: string
) {
  const user = await requireSeller();

  // Verify seller owns this project
  const sellerAccount = await db.query.sellerAccounts.findFirst({
    where: eq(sellerAccounts.userId, user.id),
  });
  if (!sellerAccount) {
    return { error: "Seller account not found" };
  }

  const project = await db.query.projects.findFirst({
    where: and(
      eq(projects.id, projectId),
      eq(projects.sellerId, sellerAccount.id),
      isNull(projects.deletedAt)
    ),
  });
  if (!project) {
    return { error: "Project not found" };
  }

  // Get buyer profile
  const buyer = await db.query.profiles.findFirst({
    where: eq(profiles.id, buyerUserId),
    columns: { id: true, email: true, displayName: true },
  });
  if (!buyer) {
    return { error: "Buyer not found" };
  }

  // Get seller profile for name
  const sellerProfile = await db.query.profiles.findFirst({
    where: eq(profiles.id, user.id),
    columns: { displayName: true, email: true },
  });

  // Get all reserved items for this buyer in this project
  const reservedItems = await db
    .select({
      title: items.title,
      price: items.price,
      currency: items.currency,
    })
    .from(items)
    .where(
      and(
        eq(items.projectId, projectId),
        eq(items.reservedForUserId, buyerUserId),
        eq(items.status, "reserved"),
        isNull(items.deletedAt)
      )
    );

  if (reservedItems.length === 0) {
    return { error: "No reserved items found for this buyer" };
  }

  const buyerName = buyer.displayName || buyer.email;
  const sellerName = sellerProfile?.displayName || sellerProfile?.email || "Seller";
  const projectUrl = `${siteConfig.url}/${locale}/project/${project.slug}`;

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
    locale
  );

  if (!result.ok) {
    return { error: result.error || "Failed to send email" };
  }

  return { success: true };
}
