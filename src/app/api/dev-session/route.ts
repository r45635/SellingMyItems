import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const cookieStore = await cookies();
  const demoRole = cookieStore.get("demo_role")?.value;

  // Demo mode
  if (demoRole === "guest" || demoRole === "seller") {
    return NextResponse.json({
      user: {
        email: `${demoRole}@local.test`,
        role: demoRole === "seller" ? "seller" : "purchaser",
        isDemo: true,
      },
    });
  }

  // Real Supabase user
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ user: null });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ user: null });
  }

  // Look up role from DB
  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.id, user.id),
    columns: { role: true },
  });

  return NextResponse.json({
    user: {
      email: user.email ?? "user@unknown.local",
      role: profile?.role ?? "purchaser",
      isDemo: false,
    },
  });
}
