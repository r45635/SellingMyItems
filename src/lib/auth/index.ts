import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { eq } from "drizzle-orm";

export type UserRole = "purchaser" | "seller";

export type AppUser = {
  id: string;
  email: string;
  role: UserRole;
  isDemo: boolean;
};

/**
 * Ensure a profile row exists in the local DB for this Supabase user.
 * Uses role from user_metadata (set during signup) or defaults to "purchaser".
 */
async function ensureProfile(
  userId: string,
  email: string,
  metadataRole?: string
): Promise<UserRole> {
  const existing = await db.query.profiles.findFirst({
    where: eq(profiles.id, userId),
    columns: { role: true },
  });
  if (existing) {
    return existing.role;
  }

  const role: UserRole =
    metadataRole === "seller" ? "seller" : "purchaser";

  await db
    .insert(profiles)
    .values({
      id: userId,
      email,
      role,
      displayName: email.split("@")[0],
    })
    .onConflictDoNothing({ target: profiles.id });

  return role;
}

export async function getUser(): Promise<AppUser | null> {
  const cookieStore = await cookies();
  const demoRole = cookieStore.get("demo_role")?.value;

  if (demoRole === "guest" || demoRole === "seller") {
    return {
      id: demoRole === "seller"
        ? "11111111-1111-1111-1111-111111111111"
        : "22222222-2222-2222-2222-222222222222",
      email: `${demoRole}@local.test`,
      role: demoRole === "seller" ? "seller" : "purchaser",
      isDemo: true,
    } satisfies AppUser;
  }

  const supabase = await createSupabaseClient();
  if (!supabase) {
    return null;
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return null;
  }

  const role = await ensureProfile(
    user.id,
    user.email ?? "user@unknown.local",
    (user.user_metadata as Record<string, unknown>)?.role as string | undefined
  );

  return {
    id: user.id,
    email: user.email ?? "user@unknown.local",
    role,
    isDemo: false,
  } satisfies AppUser;
}

export async function requireUser() {
  const user = await getUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

// TODO: Extend with role checks when co-seller/admin is implemented
export async function requireSeller() {
  const user = await requireUser();
  if (user.role !== "seller") {
    redirect("/");
  }
  return user;
}
