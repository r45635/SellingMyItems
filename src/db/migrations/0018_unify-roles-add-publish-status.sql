-- Unified-role redesign: any authenticated user can create selling projects.
-- Public visibility is now gated by an admin approval workflow rather than
-- the legacy seller role.

DO $$ BEGIN
    CREATE TYPE "project_publish_status" AS ENUM ('draft', 'pending', 'approved', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "publish_status" "project_publish_status"
  NOT NULL DEFAULT 'draft';

ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "reviewer_note" text;

ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "submitted_at" timestamptz;

ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "reviewed_at" timestamptz;

-- Existing projects that were already public on the legacy `is_public` flag
-- are grandfathered as approved so the homepage doesn't go dark when this
-- migration lands.
UPDATE "projects"
   SET "publish_status" = 'approved',
       "submitted_at"   = COALESCE("submitted_at", created_at),
       "reviewed_at"    = COALESCE("reviewed_at", created_at)
 WHERE "is_public" = true
   AND "publish_status" = 'draft';
