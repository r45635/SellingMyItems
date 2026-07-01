import { getUser } from "@/lib/auth";
import { reverseGeocode } from "@/lib/geocoding";
import { consumeRateLimit } from "@/lib/security/rate-limit";

export async function GET(req: Request) {
  const user = await getUser();
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  // 5 reverse-geocode requests per minute per user — prevents API abuse.
  const rl = await consumeRateLimit(`geocode-reverse:${user.id}`, {
    max: 5,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const lat = parseFloat(searchParams.get("lat") ?? "");
  const lng = parseFloat(searchParams.get("lng") ?? "");

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180
  ) {
    return Response.json({ error: "invalid_coords" }, { status: 400 });
  }

  const result = await reverseGeocode(lat, lng);
  if (!result.ok) {
    return Response.json({ error: "no_match" }, { status: 422 });
  }

  return Response.json(result);
}
