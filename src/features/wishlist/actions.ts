"use server";

import { db } from "@/db";
import {
	buyerWishlistItems,
	buyerWishlists,
	items,
	profiles,
} from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";

const DEMO_SELLER_PROFILE_ID = "11111111-1111-1111-1111-111111111111";
const DEMO_GUEST_PROFILE_ID = "22222222-2222-2222-2222-222222222222";

function getProfileIdForUser(user: { id: string; isDemo?: boolean; role?: "purchaser" | "seller" }) {
	if (!user.isDemo) {
		return user.id;
	}
	return user.role === "seller" ? DEMO_SELLER_PROFILE_ID : DEMO_GUEST_PROFILE_ID;
}

async function ensureProfile(profileId: string, email: string) {
	await db
		.insert(profiles)
		.values({
			id: profileId,
			email,
			passwordHash: "",
			displayName: email.split("@")[0],
		})
		.onConflictDoNothing({ target: profiles.id });
}

export async function addWishlistItemAction(formData: FormData) {
	const user = await requireUser();
	const itemId = String(formData.get("itemId") ?? "");
	const returnPath = String(formData.get("returnPath") ?? "/wishlist");

	const profileId = getProfileIdForUser(user);
	await ensureProfile(profileId, user.email);

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

	const profileId = getProfileIdForUser(user);

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
