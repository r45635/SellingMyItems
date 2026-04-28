-- Lot 1: tighten currency typing + per-user communication preferences.
--
-- The existing items.currency column was free text defaulted to 'USD'.
-- All written data is already one of USD/EUR/CAD (form enforces it via
-- zod), so we promote the column to a proper enum for DB-side integrity.
-- Adding a value later is `ALTER TYPE ... ADD VALUE IF NOT EXISTS ...`.
--
-- Profiles get three preference columns. They drive: outgoing email
-- locale (preferred_locale), distance unit on listings (distance_unit),
-- and the default currency in the item creation form (default_currency).
-- All three have NOT NULL defaults so existing rows backfill cleanly.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'currency_code') THEN
    CREATE TYPE "currency_code" AS ENUM ('USD', 'EUR', 'CAD');
  END IF;
END $$;

ALTER TABLE "items"
  ALTER COLUMN "currency" DROP DEFAULT;

ALTER TABLE "items"
  ALTER COLUMN "currency" TYPE "currency_code"
    USING "currency"::"currency_code";

ALTER TABLE "items"
  ALTER COLUMN "currency" SET DEFAULT 'USD'::"currency_code";

ALTER TABLE "profiles"
  ADD COLUMN IF NOT EXISTS "preferred_locale" text NOT NULL DEFAULT 'en';

ALTER TABLE "profiles"
  ADD COLUMN IF NOT EXISTS "distance_unit" text NOT NULL DEFAULT 'km';

ALTER TABLE "profiles"
  ADD COLUMN IF NOT EXISTS "default_currency" "currency_code"
    NOT NULL DEFAULT 'USD'::"currency_code";
