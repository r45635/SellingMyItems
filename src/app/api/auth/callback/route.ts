import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { profiles } from "@/db/schema";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.redirect(`${origin}/login?error=auth`);
    }
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Ensure profile exists after email confirmation
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const role =
          (user.user_metadata as Record<string, unknown>)?.role === "seller"
            ? "seller"
            : "purchaser";
        await db
          .insert(profiles)
          .values({
            id: user.id,
            email: user.email ?? "user@unknown.local",
            role: role as "purchaser" | "seller",
            displayName: (user.email ?? "user").split("@")[0],
          })
          .onConflictDoNothing({ target: profiles.id });
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Auth code exchange failed — redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
