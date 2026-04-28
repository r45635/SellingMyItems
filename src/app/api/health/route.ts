import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";

/**
 * Deploy-friendly healthcheck. Hits the DB and exercises a column the
 * app actually depends on (`profiles.is_admin`) — this is what catches
 * the "code shipped but migration didn't run" failure mode that the
 * previous root-page curl healthcheck silently passed through.
 *
 * Returns 200 + tiny JSON when healthy, 503 + error string otherwise.
 * Public, no auth — safe to expose because it leaks no data.
 */
export async function GET() {
  try {
    await db.execute(sql`SELECT id, is_admin FROM profiles LIMIT 1`);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "unknown";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 503 }
    );
  }
}
