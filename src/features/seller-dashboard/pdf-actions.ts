"use server";

import { z } from "zod";
import { requireSeller } from "@/lib/auth";
import { db } from "@/db";
import { items, profiles, sellerAccounts } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { findSellerProject } from "@/lib/seller-accounts";
import {
  buildRecapPayload,
  recapPdfFilename,
} from "@/lib/pdf/build-recap-payload";
import { renderProjectRecapPdf } from "@/lib/pdf/project-recap-pdf";
import { sendProjectRecapPdfEmail } from "@/lib/email";

const emailPdfSchema = z.object({
  projectIdOrSlug: z.string().min(1),
  recipientEmail: z.string().email(),
  itemIds: z.array(z.string().uuid()).optional(),
  reservedOnly: z.boolean().optional(),
  buyerId: z.string().uuid().optional(),
  message: z.string().max(2000).optional(),
  locale: z.string().min(2).max(5),
});

export async function emailProjectRecapPdfAction(input: {
  projectIdOrSlug: string;
  recipientEmail: string;
  itemIds?: string[];
  reservedOnly?: boolean;
  buyerId?: string;
  message?: string;
  locale: string;
}) {
  const user = await requireSeller();

  const parsed = emailPdfSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid input" };
  }
  const data = parsed.data;

  const sellerAccount = await db.query.sellerAccounts.findFirst({
    where: eq(sellerAccounts.userId, user.id),
  });
  if (!sellerAccount) return { error: "Seller account not found" };

  const project = await findSellerProject(
    sellerAccount.id,
    data.projectIdOrSlug
  );
  if (!project) return { error: "Project not found" };

  // Resolve which items go into the PDF.
  let itemIds = data.itemIds;
  if (!itemIds || itemIds.length === 0) {
    if (data.reservedOnly || data.buyerId) {
      const conditions = [
        eq(items.projectId, project.id),
        eq(items.status, "reserved"),
        isNull(items.deletedAt),
      ];
      if (data.buyerId) {
        conditions.push(eq(items.reservedForUserId, data.buyerId));
      }
      const rows = await db
        .select({ id: items.id })
        .from(items)
        .where(and(...conditions));
      itemIds = rows.map((r) => r.id);
    }
  }
  if (!itemIds || itemIds.length === 0) {
    return { error: "No items selected" };
  }

  // Build PDF payload + render.
  const payload = await buildRecapPayload(project, {
    itemIds,
    locale: data.locale,
  });
  if (payload.items.length === 0) {
    return { error: "No items to include" };
  }
  const pdfBuffer = await renderProjectRecapPdf(payload);
  const filename = recapPdfFilename(project.slug);

  // Resolve sender display name for the email body.
  const sellerProfile = await db.query.profiles.findFirst({
    where: eq(profiles.id, user.id),
    columns: { displayName: true, email: true },
  });
  const senderName =
    sellerProfile?.displayName || sellerProfile?.email || "Seller";

  const result = await sendProjectRecapPdfEmail(
    data.recipientEmail,
    senderName,
    project.name,
    { filename, content: pdfBuffer },
    data.message ?? "",
    data.locale
  );

  if (!result.ok) {
    return { error: result.error || "Failed to send email" };
  }

  return { success: true };
}
