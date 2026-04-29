/**
 * Distance helpers, both for the SQL side (we still build the actual
 * filter as raw SQL using `earth_distance`) and for the client-side
 * "X km away" labels on project cards.
 */

import { kmToMi, type DistanceUnit } from "@/lib/format";

const EARTH_RADIUS_KM = 6371;

/**
 * Great-circle distance between two coords, in kilometres. Matches
 * what `earth_distance(ll_to_earth(...), ll_to_earth(...))` returns
 * (modulo the metres → km conversion the SQL side does), so server
 * and client agree on what "50 km" means.
 */
export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/**
 * Pick the user's preferred distance unit when no explicit profile
 * preference is available. The four imperial holdouts get miles; the
 * rest of the world gets km.
 */
export function unitForCountry(
  countryCode: string | null | undefined
): DistanceUnit {
  if (!countryCode) return "km";
  const cc = countryCode.toUpperCase();
  return cc === "US" || cc === "GB" || cc === "MM" || cc === "LR"
    ? "mi"
    : "km";
}

export { kmToMi };
export type { DistanceUnit };
