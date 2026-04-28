import { db } from "@/db";
import { geocodedLocations } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { siteConfig } from "@/config";

export type GeocodeInput = {
  countryCode: string;
  postalCode: string;
};

export type GeocodeResult = {
  latitude: number;
  longitude: number;
  city: string | null;
};

const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/search";
const REQUEST_TIMEOUT_MS = 8_000;
const NEGATIVE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

/**
 * Nominatim's usage policy: max 1 request per second per IP, identifying
 * User-Agent required. We honor it with a global single-flight gate
 * shared across all callers in this Node process.
 */
let nominatimGate: Promise<unknown> = Promise.resolve();
async function nominatimSerialized<T>(fn: () => Promise<T>): Promise<T> {
  // Tail-attach to the previous request so the network calls fan out
  // serially. ~1s minimum spacing is enforced by sleeping AFTER the
  // request completes, not before, to keep latency low for the first
  // user in a burst.
  const previous = nominatimGate;
  let release: () => void = () => {};
  nominatimGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  try {
    await previous;
    return await fn();
  } finally {
    setTimeout(release, 1_050);
  }
}

function normalize({ countryCode, postalCode }: GeocodeInput): GeocodeInput {
  return {
    countryCode: countryCode.trim().toUpperCase().slice(0, 2),
    postalCode: postalCode.trim(),
  };
}

async function readCache(
  input: GeocodeInput
): Promise<GeocodeResult | null | "stale-miss"> {
  const row = await db.query.geocodedLocations.findFirst({
    where: and(
      eq(geocodedLocations.countryCode, input.countryCode),
      eq(geocodedLocations.postalCode, input.postalCode)
    ),
  });
  if (!row) return "stale-miss";
  if (row.latitude == null || row.longitude == null) {
    // Negative cache: respect for 24h, then re-try.
    const age = Date.now() - row.resolvedAt.getTime();
    if (age < NEGATIVE_TTL_MS) return null;
    return "stale-miss";
  }
  return {
    latitude: row.latitude,
    longitude: row.longitude,
    city: row.city,
  };
}

async function writeCache(
  input: GeocodeInput,
  result: GeocodeResult | null
): Promise<void> {
  await db
    .insert(geocodedLocations)
    .values({
      countryCode: input.countryCode,
      postalCode: input.postalCode,
      latitude: result?.latitude ?? null,
      longitude: result?.longitude ?? null,
      city: result?.city ?? null,
      resolvedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [geocodedLocations.countryCode, geocodedLocations.postalCode],
      set: {
        latitude: result?.latitude ?? null,
        longitude: result?.longitude ?? null,
        city: result?.city ?? null,
        resolvedAt: new Date(),
      },
    });
}

async function callNominatim(
  input: GeocodeInput
): Promise<GeocodeResult | null> {
  const url = new URL(NOMINATIM_ENDPOINT);
  url.searchParams.set("postalcode", input.postalCode);
  url.searchParams.set("country", input.countryCode);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "1");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        // Nominatim rejects requests without a descriptive User-Agent.
        // siteConfig.url is the prod URL, so admins can be reached if
        // there's an abuse complaint.
        "User-Agent": `SellingMyItems/1.0 (${siteConfig.url})`,
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const body = (await res.json()) as Array<{
      lat: string;
      lon: string;
      address?: {
        city?: string;
        town?: string;
        village?: string;
        municipality?: string;
        county?: string;
      };
    }>;
    if (!body[0]) return null;
    const top = body[0];
    const lat = Number(top.lat);
    const lon = Number(top.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    const a = top.address ?? {};
    const city =
      a.city ?? a.town ?? a.village ?? a.municipality ?? a.county ?? null;
    return { latitude: lat, longitude: lon, city };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Resolve (country, postal code) to approximate coordinates. Cached in
 * `geocoded_locations`; cache misses fan out to Nominatim through a
 * 1 req/s gate. Negative results are cached for 24h. Returns null on
 * any failure path — callers should treat this as "no resolution yet"
 * rather than retrying on the hot path.
 */
export async function geocode(
  rawInput: GeocodeInput
): Promise<GeocodeResult | null> {
  const input = normalize(rawInput);
  if (!input.countryCode || !input.postalCode) return null;

  const cached = await readCache(input);
  if (cached !== "stale-miss") return cached;

  const fresh = await nominatimSerialized(() => callNominatim(input));
  await writeCache(input, fresh).catch(() => {
    // Best-effort cache write — if the DB rejects (e.g. concurrent
    // upsert race), the next call will simply re-resolve.
  });
  return fresh;
}
