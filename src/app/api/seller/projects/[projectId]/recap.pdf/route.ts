import { NextRequest } from "next/server";
import { requireSeller } from "@/lib/auth";
import { db } from "@/db";
import { items, sellerAccounts } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { findSellerProject } from "@/lib/seller-accounts";
import {
  buildRecapPayload,
  recapPdfFilename,
} from "@/lib/pdf/build-recap-payload";
import { renderProjectRecapPdf } from "@/lib/pdf/project-recap-pdf";

export const runtime = "nodejs";
// PDF generation may take a few seconds for large projects.
export const maxDuration = 60;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId: projectIdOrSlug } = await params;
  const user = await requireSeller();

  const sellerAccount = await db.query.sellerAccounts.findFirst({
    where: eq(sellerAccounts.userId, user.id),
  });
  if (!sellerAccount) {
    return new Response("Not found", { status: 404 });
  }
  const project = await findSellerProject(sellerAccount.id, projectIdOrSlug);
  if (!project) {
    return new Response("Not found", { status: 404 });
  }

  const url = new URL(request.url);
  const itemsParam = url.searchParams.get("items"); // comma-separated UUIDs
  const reservedOnly = url.searchParams.get("reserved") === "true";
  const buyerId = url.searchParams.get("buyer"); // resolve all reserved items for this buyer
  const locale = url.searchParams.get("locale") || "en";

  // Resolve the set of item IDs to include.
  let itemIds: string[] | undefined;
  let suffix: string | undefined;
  if (itemsParam) {
    itemIds = itemsParam
      .split(",")
      .map((s) => s.trim())
      .filter((s) => /^[0-9a-f-]{36}$/i.test(s));
    if (itemIds.length === 0) {
      return new Response("No valid items selected", { status: 400 });
    }
    suffix = `${itemIds.length}items`;
  } else if (reservedOnly || buyerId) {
    const conditions = [
      eq(items.projectId, project.id),
      eq(items.status, "reserved"),
      isNull(items.deletedAt),
    ];
    if (buyerId && /^[0-9a-f-]{36}$/i.test(buyerId)) {
      conditions.push(eq(items.reservedForUserId, buyerId));
    }
    const reservedRows = await db
      .select({ id: items.id })
      .from(items)
      .where(and(...conditions));
    if (reservedRows.length === 0) {
      return new Response("No reserved items found", { status: 404 });
    }
    itemIds = reservedRows.map((r) => r.id);
    suffix = buyerId ? "reserved-buyer" : "reserved";
  }

  const payload = await buildRecapPayload(project, { itemIds, locale });
  if (payload.items.length === 0) {
    return new Response("No items to include", { status: 404 });
  }

  const pdfBuffer = await renderProjectRecapPdf(payload);
  const filename = recapPdfFilename(project.slug, suffix);

  return new Response(new Blob([new Uint8Array(pdfBuffer)], { type: "application/pdf" }), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
