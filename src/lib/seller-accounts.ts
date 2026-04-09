import { db } from "@/db";
import { sellerAccounts } from "@/db/schema";
import { asc, eq } from "drizzle-orm";

export async function getSellerAccountIdsForUser(userId: string) {
  const rows = await db
    .select({ id: sellerAccounts.id })
    .from(sellerAccounts)
    .where(eq(sellerAccounts.userId, userId))
    .orderBy(asc(sellerAccounts.createdAt));

  return rows.map((row) => row.id);
}