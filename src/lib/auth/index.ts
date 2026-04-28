import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { profiles, sellerAccounts, sessions } from "@/db/schema";
import { eq, and, gt } from "drizzle-orm";

export type AppUser = {
  id: string;
  email: string;
  isAdmin: boolean;
};

/**
 * What a signed-in user is *able* to do, derived from data — not from
 * a static enum. Everyone signed in is at minimum a buyer; "seller" is
 * granted by the existence of an active sellerAccounts row (lazily
 * minted on first project creation); "admin" is the only thing still
 * gated on the profile itself, via the `is_admin` boolean.
 */
export type UserCapabilities = {
  buyer: true;
  seller: boolean;
  admin: boolean;
  sellerAccountId: string | null;
};

export type ActiveContext = "buyer" | "seller" | "admin";

const SESSION_COOKIE = "session_token";

export async function getUser(): Promise<AppUser | null> {
  const cookieStore = await cookies();

  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await db.query.sessions.findFirst({
    where: and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())),
    columns: { userId: true },
  });
  if (!session) return null;

  const profile = await db.query.profiles.findFirst({
    where: and(eq(profiles.id, session.userId), eq(profiles.isActive, true)),
    columns: { id: true, email: true, isAdmin: true },
  });
  if (!profile) return null;

  return {
    id: profile.id,
    email: profile.email,
    isAdmin: profile.isAdmin,
  } satisfies AppUser;
}

export async function requireUser() {
  const user = await getUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

/**
 * Historically gated routes by `role === "seller"`. Selling is now open
 * to any signed-in user; the public-facing distinction has moved to the
 * project's `publishStatus` (admin-approved before it goes public). We
 * keep this name as a thin alias of requireUser so existing call sites
 * don't need a rename, and so the contract stays clear: "the listings
 * area requires you to be signed in".
 */
export async function requireSeller() {
  return requireUser();
}

export async function requireAdmin() {
  const user = await requireUser();
  if (!user.isAdmin) {
    redirect("/");
  }
  return user;
}

export async function getUserCapabilities(
  user: AppUser
): Promise<UserCapabilities> {
  const sellerAccount = await db.query.sellerAccounts.findFirst({
    where: and(
      eq(sellerAccounts.userId, user.id),
      eq(sellerAccounts.isActive, true)
    ),
    columns: { id: true },
  });

  return {
    buyer: true,
    seller: Boolean(sellerAccount),
    admin: user.isAdmin,
    sellerAccountId: sellerAccount?.id ?? null,
  };
}
