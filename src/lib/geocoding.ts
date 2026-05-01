import { db } from "@/db";
import { geocodedLocations } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export type GeocodeInput = {
  countryCode: string;
  postalCode: string;
};

export type GeocodeResolved = {
  ok: true;
  latitude: number;
  longitude: number;
  city: string | null;
  /** Whether this resolution came from the local cache or a fresh upstream call. */
  source: "cache" | "upstream";
};

/**
 * Reason codes surfaced to callers (and ultimately to users via the
 * /account error banner). Each one maps to a distinct user-facing
 * message + a known-good remediation.
 */
export type GeocodeFailureReason =
  /** countryCode/postalCode were empty or invalid after trimming. */
  | "invalid_input"
  /** Nominatim returned 0 results for the (country, postal) combo. */
  | "no_match"
  /** Network call failed (DNS, timeout, non-2xx status, abort). */
  | "unreachable"
  /** Nominatim returned 200 but the JSON didn't parse or fields were missing. */
  | "bad_response";

export type GeocodeFailure = {
  ok: false;
  reason: GeocodeFailureReason;
  /** Optional human-readable hint for logs. Never user-facing. */
  detail?: string;
};

export type GeocodeResult = GeocodeResolved | GeocodeFailure;

const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/search";
const REQUEST_TIMEOUT_MS = 8_000;
const NEGATIVE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

/**
 * Per Nominatim's usage policy: required descriptive User-Agent + a
 * reachable contact (URL or email). We use the GitHub repo URL — it's
 * stable, public, and lets the OSM operations team contact us if we
 * misbehave. Don't depend on siteConfig.url here: it falls back to
 * `localhost` when NEXT_PUBLIC_APP_URL is unset, which produces a
 * cosmetically-suspicious UA string.
 */
const USER_AGENT =
  "SellingMyItems/1.0 (+https://github.com/r45635/SellingMyItems)";

/**
 * Nominatim's usage policy: max 1 request per second per IP. We honor
 * it with a global single-flight gate shared across all callers in
 * this Node process.
 */
let nominatimGate: Promise<unknown> = Promise.resolve();
async function nominatimSerialized<T>(fn: () => Promise<T>): Promise<T> {
  // Tail-attach to the previous request so calls fan out serially.
  // ~1s minimum spacing is enforced by sleeping AFTER the request
  // completes, not before, to keep latency low for the first user in
  // a burst.
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

type CacheRead =
  | { hit: "resolved"; result: GeocodeResolved }
  | { hit: "negative" }
  | { hit: "miss" };

async function readCache(input: GeocodeInput): Promise<CacheRead> {
  const row = await db.query.geocodedLocations.findFirst({
    where: and(
      eq(geocodedLocations.countryCode, input.countryCode),
      eq(geocodedLocations.postalCode, input.postalCode)
    ),
  });
  if (!row) return { hit: "miss" };
  if (row.latitude == null || row.longitude == null) {
    // Negative cache: respect for 24h, then re-try.
    const age = Date.now() - row.resolvedAt.getTime();
    if (age < NEGATIVE_TTL_MS) return { hit: "negative" };
    return { hit: "miss" };
  }
  return {
    hit: "resolved",
    result: {
      ok: true,
      latitude: row.latitude,
      longitude: row.longitude,
      city: row.city,
      source: "cache",
    },
  };
}

async function writeCache(
  input: GeocodeInput,
  resolved: GeocodeResolved | null
): Promise<void> {
  await db
    .insert(geocodedLocations)
    .values({
      countryCode: input.countryCode,
      postalCode: input.postalCode,
      latitude: resolved?.latitude ?? null,
      longitude: resolved?.longitude ?? null,
      city: resolved?.city ?? null,
      resolvedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [geocodedLocations.countryCode, geocodedLocations.postalCode],
      set: {
        latitude: resolved?.latitude ?? null,
        longitude: resolved?.longitude ?? null,
        city: resolved?.city ?? null,
        resolvedAt: new Date(),
      },
    });
}

/**
 * Single Nominatim call. Returns a discriminated result so callers can
 * distinguish "we got a positive response with no match" from "the
 * network call itself failed". Logs every failure path explicitly to
 * stderr — these surface in `docker compose logs app` for diagnosis.
 */
async function callNominatim(
  input: GeocodeInput
): Promise<GeocodeResult> {
  const url = new URL(NOMINATIM_ENDPOINT);
  url.searchParams.set("postalcode", input.postalCode);
  url.searchParams.set("country", input.countryCode);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "1");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
      },
      signal: controller.signal,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error(
      `[geocode] fetch failed for ${input.countryCode}/${input.postalCode}:`,
      detail
    );
    return { ok: false, reason: "unreachable", detail };
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const detail = `HTTP ${res.status} ${res.statusText}`;
    console.error(
      `[geocode] non-2xx for ${input.countryCode}/${input.postalCode}:`,
      detail
    );
    return { ok: false, reason: "unreachable", detail };
  }

  let body: Array<{
    lat?: string;
    lon?: string;
    address?: {
      city?: string;
      town?: string;
      village?: string;
      municipality?: string;
      county?: string;
    };
  }>;
  try {
    body = await res.json();
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error(
      `[geocode] JSON parse failed for ${input.countryCode}/${input.postalCode}:`,
      detail
    );
    return { ok: false, reason: "bad_response", detail };
  }

  if (!body[0] || body[0].lat == null || body[0].lon == null) {
    console.warn(
      `[geocode] no match for ${input.countryCode}/${input.postalCode}`
    );
    return { ok: false, reason: "no_match" };
  }

  const lat = Number(body[0].lat);
  const lon = Number(body[0].lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    console.error(
      `[geocode] non-numeric coords from Nominatim for ${input.countryCode}/${input.postalCode}:`,
      body[0].lat,
      body[0].lon
    );
    return { ok: false, reason: "bad_response", detail: "non-numeric coords" };
  }

  const a = body[0].address ?? {};
  const city =
    a.city ?? a.town ?? a.village ?? a.municipality ?? a.county ?? null;
  return { ok: true, latitude: lat, longitude: lon, city, source: "upstream" };
}

/**
 * Resolve (country, postal code) to approximate coordinates.
 *
 * Cache-first: hits `geocoded_locations` before fanning out to
 * Nominatim. Negative results (no match) are cached for 24h to spare
 * the upstream. Cache misses go through a 1 req/s gate per Nominatim
 * policy. Returns a discriminated result so callers can render
 * specific UX per failure mode.
 */
export async function geocode(rawInput: GeocodeInput): Promise<GeocodeResult> {
  const input = normalize(rawInput);
  if (!input.countryCode || !input.postalCode) {
    return { ok: false, reason: "invalid_input" };
  }

  const cached = await readCache(input);
  if (cached.hit === "resolved") return cached.result;
  if (cached.hit === "negative") {
    return { ok: false, reason: "no_match", detail: "cached negative" };
  }

  const fresh = await nominatimSerialized(() => callNominatim(input));

  // Cache positive results AND no_match (so we don't re-hammer the
  // upstream for known-bad codes within the TTL). Don't cache
  // unreachable/bad_response — those are usually transient.
  if (fresh.ok) {
    await writeCache(input, fresh).catch((err) => {
      console.error(
        `[geocode] cache write failed for ${input.countryCode}/${input.postalCode}:`,
        err instanceof Error ? err.message : err
      );
    });
  } else if (fresh.reason === "no_match") {
    await writeCache(input, null).catch((err) => {
      console.error(
        `[geocode] negative cache write failed for ${input.countryCode}/${input.postalCode}:`,
        err instanceof Error ? err.message : err
      );
    });
  }

  return fresh;
}
