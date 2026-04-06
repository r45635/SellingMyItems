"use server";

import { db } from "@/db";
import {
	buyerWishlistItems,
	buyerWishlists,
	items,
} from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function addWishlistItemAction(formData: FormData) {
	const user = await requireUser();
	const itemId = String(formData.get("itemId") ?? "");
	const returnPath = String(formData.get("returnPath") ?? "/wishlist");

	const profileId = user.id;

	const item = await db.query.items.findFirst({
		where: and(eq(items.id, itemId), isNull(items.deletedAt)),
	});

	if (!item) {
		return;
	}

	let wishlist = await db.query.buyerWishlists.findFirst({
		where: and(
			eq(buyerWishlists.userId, profileId),
			eq(buyerWishlists.projectId, item.projectId)
		),
	});

	if (!wishlist) {
		const [createdWishlist] = await db
			.insert(buyerWishlists)
			.values({ userId: profileId, projectId: item.projectId })
			.returning();
		wishlist = createdWishlist;
	}

	const existing = await db.query.buyerWishlistItems.findFirst({
		where: and(
			eq(buyerWishlistItems.wishlistId, wishlist.id),
			eq(buyerWishlistItems.itemId, itemId)
		),
	});

	if (!existing) {
		await db.insert(buyerWishlistItems).values({
			wishlistId: wishlist.id,
			itemId,
		});
	}

	revalidatePath(returnPath);
	revalidatePath("/wishlist");
}

export async function removeWishlistItemAction(formData: FormData) {
	const user = await requireUser();
	const itemId = String(formData.get("itemId") ?? "");
	const returnPath = String(formData.get("returnPath") ?? "/wishlist");

	const profileId = user.id;

	const wishlists = await db
		.select({ id: buyerWishlists.id })
		.from(buyerWishlists)
		.where(eq(buyerWishlists.userId, profileId));

	if (wishlists.length > 0) {
		const wishlistIds = wishlists.map((wishlist) => wishlist.id);
		await db
			.delete(buyerWishlistItems)
			.where(
				and(
					eq(buyerWishlistItems.itemId, itemId),
					inArray(buyerWishlistItems.wishlistId, wishlistIds)
				)
			);
	}

	revalidatePath(returnPath);
	revalidatePath("/wishlist");
}
