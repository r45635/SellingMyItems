import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type AppUser = {
  id: string;
  email: string;
  role: "guest" | "seller";
  isDemo: boolean;
};

export async function getUser() {
  const cookieStore = await cookies();
  const demoRole = cookieStore.get("demo_role")?.value;

  if (demoRole === "guest" || demoRole === "seller") {
    return {
      id: `demo-${demoRole}`,
      email: `${demoRole}@local.test`,
      role: demoRole,
      isDemo: true,
    } satisfies AppUser;
  }

  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email ?? "user@unknown.local",
    role: "guest",
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
