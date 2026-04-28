-- Lot 2: location data on profiles + projects, with a tiny geocoding
-- result cache to keep Nominatim happy.
--
-- We rely on the postgres-contrib `cube` + `earthdistance` extensions
-- for haversine queries directly in SQL. These ship with the
-- postgres:16-alpine image, no separate install needed; the
-- CREATE EXTENSION calls just register them in this database.
--
-- Profile fields capture an *approximate* location only — a postal
-- code resolved to a city centroid via Nominatim. We never persist
-- precise GPS, even if the browser later offers it. Privacy by design
-- + good enough for radius matching.

CREATE EXTENSION IF NOT EXISTS cube;
CREATE EXTENSION IF NOT EXISTS earthdistance;

CREATE TABLE IF NOT EXISTS "geocoded_locations" (
  "country_code" text NOT NULL,
  "postal_code"  text NOT NULL,
  "latitude"     double precision,  -- NULL when geocoding returned no match
  "longitude"    double precision,
  "city"         text,
  "resolved_at"  timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("country_code", "postal_code")
);

ALTER TABLE "profiles"
  ADD COLUMN IF NOT EXISTS "country_code" text,
  ADD COLUMN IF NOT EXISTS "postal_code" text,
  ADD COLUMN IF NOT EXISTS "latitude" double precision,
  ADD COLUMN IF NOT EXISTS "longitude" double precision,
  ADD COLUMN IF NOT EXISTS "location_updated_at" timestamptz;

ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "country_code" text,
  ADD COLUMN IF NOT EXISTS "postal_code" text,
  ADD COLUMN IF NOT EXISTS "latitude" double precision,
  ADD COLUMN IF NOT EXISTS "longitude" double precision,
  ADD COLUMN IF NOT EXISTS "radius_km" integer; -- NULL = no seller-side restriction

-- GiST index on the earth-distance representation. Postgres can
-- short-circuit `earth_box(...) @> ll_to_earth(...)` lookups against
-- this index, so a "projects within 50 km of (lat, lng)" query stays
-- fast even with many rows.
CREATE INDEX IF NOT EXISTS "projects_geo_idx"
  ON "projects" USING gist (ll_to_earth("latitude", "longitude"))
  WHERE "latitude" IS NOT NULL AND "longitude" IS NOT NULL;
