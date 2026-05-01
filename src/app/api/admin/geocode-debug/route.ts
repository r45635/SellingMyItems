import { NextResponse } from "next/server";
import { db } from "@/db";
import { geocodedLocations } from "@/db/schema";
import { desc, sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { geocode } from "@/lib/geocoding";

/**
 * Admin-only diagnostic endpoint for the geocoding pipeline. Lists the
 * 20 most recent rows from the local cache, confirms the postgres-
 * contrib extensions our radius queries depend on are actually
 * installed, and (optionally) runs a test geocode of FR/75001 against
 * Nominatim so we can tell from the response whether the issue is in
 * upstream connectivity vs our own code.
 *
 * Hit `/api/admin/geocode-debug` to read the cache + extensions.
 * Hit `/api/admin/geocode-debug?probe=1` to also fire a fresh
 * Nominatim call (consumes 1 req from our 1 req/s budget).
 */
export async function GET(req: Request) {
  await requireAdmin();
  const probe = new URL(req.url).searchParams.get("probe") === "1";

  // Recent cache entries — useful to see what's been resolved or
  // negatively cached.
  const recent = await db
    .select({
      countryCode: geocodedLocations.countryCode,
      postalCode: geocodedLocations.postalCode,
      latitude: geocodedLocations.latitude,
      longitude: geocodedLocations.longitude,
      city: geocodedLocations.city,
      resolvedAt: geocodedLocations.resolvedAt,
    })
    .from(geocodedLocations)
    .orderBy(desc(geocodedLocations.resolvedAt))
    .limit(20);

  // Confirm the cube + earthdistance extensions are loaded — they
  // power the radius queries on the homepage. If either is missing
  // here, migration 0022 didn't actually take effect on this DB.
  const extRows = (await db.execute(
    sql`SELECT extname FROM pg_extension WHERE extname IN ('cube','earthdistance')`
  )) as unknown as { rows: Array<{ extname: string }> } | Array<{
    extname: string;
  }>;
  const extNames = Array.isArray(extRows)
    ? extRows.map((r) => r.extname)
    : extRows.rows.map((r) => r.extname);

  let testGeocode: unknown = null;
  if (probe) {
    testGeocode = await geocode({ countryCode: "FR", postalCode: "75001" });
  }

  return NextResponse.json({
    cache: {
      count: recent.length,
      recent,
    },
    extensions: {
      cube: extNames.includes("cube"),
      earthdistance: extNames.includes("earthdistance"),
    },
    probe: probe ? testGeocode : null,
    note: "Pass ?probe=1 to also fire a live Nominatim call against FR/75001.",
  });
}
