-- Add share_link as a new access grant source
ALTER TYPE "access_grant_source" ADD VALUE IF NOT EXISTS 'share_link';

-- Item share links table
CREATE TABLE IF NOT EXISTS "item_share_links" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "item_id" uuid NOT NULL,
  "project_id" uuid NOT NULL,
  "token" text NOT NULL,
  "created_by" uuid NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "revoked_at" timestamp with time zone,
  "revoked_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "item_share_links_token_unique" UNIQUE("token")
);

DO $$ BEGIN
  ALTER TABLE "item_share_links"
    ADD CONSTRAINT "item_share_links_item_id_items_id_fk"
    FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "item_share_links"
    ADD CONSTRAINT "item_share_links_project_id_projects_id_fk"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "item_share_links"
    ADD CONSTRAINT "item_share_links_created_by_profiles_id_fk"
    FOREIGN KEY ("created_by") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "item_share_links"
    ADD CONSTRAINT "item_share_links_revoked_by_profiles_id_fk"
    FOREIGN KEY ("revoked_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "item_share_links_project_id_idx" ON "item_share_links" ("project_id");
CREATE INDEX IF NOT EXISTS "item_share_links_item_id_idx" ON "item_share_links" ("item_id");
