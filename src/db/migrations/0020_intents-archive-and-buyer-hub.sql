-- Lots 1 + 2 + 3 of the intents redesign.
--
-- Lot 1 (visibility): per-intent archive flag (shared between buyer and
-- seller — finalized intents disappear from both lists when either
-- party archives), plus a reviewer note on declines (mirrors the
-- existing project rejection pattern), plus indexes on the (user, status)
-- and (project, status) hot paths.
--
-- Lot 2 (buyer hub): adds a `cancelled` value to intent_status so a
-- buyer can withdraw a still-pending intent and free the
-- one-active-per-project lock.
--
-- Lot 3 (linkage): conversation_threads gets an optional intent_id FK
-- so the existing auto-created thread can be deep-linked from each
-- intent card without joining by (project, buyer) every time.

ALTER TABLE "buyer_intents"
  ADD COLUMN IF NOT EXISTS "archived_at" timestamptz;

ALTER TABLE "buyer_intents"
  ADD COLUMN IF NOT EXISTS "archived_by" uuid
    REFERENCES "profiles"("id") ON DELETE SET NULL;

ALTER TABLE "buyer_intents"
  ADD COLUMN IF NOT EXISTS "reviewer_note" text;

CREATE INDEX IF NOT EXISTS "buyer_intents_user_status_idx"
  ON "buyer_intents" ("user_id", "status");

CREATE INDEX IF NOT EXISTS "buyer_intents_project_status_idx"
  ON "buyer_intents" ("project_id", "status");

ALTER TABLE "conversation_threads"
  ADD COLUMN IF NOT EXISTS "intent_id" uuid
    REFERENCES "buyer_intents"("id") ON DELETE SET NULL;

ALTER TYPE "intent_status" ADD VALUE IF NOT EXISTS 'cancelled';
