-- Email privacy & relay feature.
--
-- Adds:
--   - enum email_visibility (hidden | direct)
--   - enum thread_alias_role (buyer | seller)
--   - profiles.email_visibility (default 'hidden')
--   - table thread_aliases (one row per (thread, role), lazy-minted)
--   - enum value email_type.'inbound_relay'
--
-- Run via `npx drizzle-kit push` OR apply manually with psql.

DO $$ BEGIN
    CREATE TYPE "email_visibility" AS ENUM ('hidden', 'direct');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "thread_alias_role" AS ENUM ('buyer', 'seller');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "profiles"
  ADD COLUMN IF NOT EXISTS "email_visibility" "email_visibility"
  NOT NULL DEFAULT 'hidden';

CREATE TABLE IF NOT EXISTS "thread_aliases" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "thread_id" uuid NOT NULL REFERENCES "conversation_threads"("id") ON DELETE CASCADE,
    "participant_role" "thread_alias_role" NOT NULL,
    "profile_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
    "local_part" text NOT NULL UNIQUE,
    "revoked_at" timestamptz,
    "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "thread_aliases_thread_role_unique"
  ON "thread_aliases" ("thread_id", "participant_role");

ALTER TYPE "email_type" ADD VALUE IF NOT EXISTS 'inbound_relay';
