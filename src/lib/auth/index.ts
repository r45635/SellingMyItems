import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { profiles, sessions } from "@/db/schema";
import { eq, and, gt } from "drizzle-orm";

export type UserRole = "purchaser" | "seller" | "admin";

export type AppUser = {
  id: string;
  email: string;
  role: UserRole;
};

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
    columns: { id: true, email: true, role: true },
  });
  if (!profile) return null;

  return {
    id: profile.id,
    email: profile.email,
    role: profile.role,
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
  if (user.role !== "admin") {
    redirect("/");
  }
  return user;
}
