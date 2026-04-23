-- ─── Enums ──────────────────────────────────────────────────────────────────

CREATE TYPE "project_visibility" AS ENUM ('public', 'invitation_only');
CREATE TYPE "invitation_status" AS ENUM ('active', 'used', 'expired', 'revoked');
CREATE TYPE "access_request_status" AS ENUM ('pending', 'approved', 'declined', 'cancelled');
CREATE TYPE "access_grant_source" AS ENUM ('targeted_invitation', 'generic_request', 'seller_manual');
CREATE TYPE "notification_type" AS ENUM (
  'invitation_received',
  'access_granted',
  'access_declined',
  'access_revoked',
  'access_requested'
);

-- Note: new values are appended to the existing "email_type" enum
-- in migration 0015 (must run outside a transaction).

-- ─── projects.visibility ────────────────────────────────────────────────────

ALTER TABLE "projects"
  ADD COLUMN "visibility" "project_visibility" NOT NULL DEFAULT 'public';

-- ─── project_invitations ────────────────────────────────────────────────────

CREATE TABLE "project_invitations" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id" UUID NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "code" TEXT NOT NULL UNIQUE,
  "email" TEXT,
  "status" "invitation_status" NOT NULL DEFAULT 'active',
  "expires_at" TIMESTAMPTZ NOT NULL,
  "used_by_user_id" UUID REFERENCES "profiles"("id") ON DELETE SET NULL,
  "used_at" TIMESTAMPTZ,
  "revoked_at" TIMESTAMPTZ,
  "created_by" UUID NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX "project_invitations_project_status_idx"
  ON "project_invitations" ("project_id", "status");

CREATE INDEX "project_invitations_email_project_idx"
  ON "project_invitations" ("email", "project_id");

-- Only one active generic invitation per project (email IS NULL + status = 'active')
CREATE UNIQUE INDEX "project_invitations_generic_active_idx"
  ON "project_invitations" ("project_id")
  WHERE "email" IS NULL AND "status" = 'active';

-- ─── project_access_grants ──────────────────────────────────────────────────

CREATE TABLE "project_access_grants" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id" UUID NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "user_id" UUID NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "source" "access_grant_source" NOT NULL,
  "invitation_id" UUID REFERENCES "project_invitations"("id") ON DELETE SET NULL,
  "granted_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "revoked_at" TIMESTAMPTZ,
  "revoked_by" UUID REFERENCES "profiles"("id") ON DELETE SET NULL
);

CREATE UNIQUE INDEX "project_access_grants_project_user_idx"
  ON "project_access_grants" ("project_id", "user_id");

-- ─── project_access_requests ────────────────────────────────────────────────

CREATE TABLE "project_access_requests" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id" UUID NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "user_id" UUID NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "invitation_id" UUID REFERENCES "project_invitations"("id") ON DELETE SET NULL,
  "code_used" TEXT,
  "status" "access_request_status" NOT NULL DEFAULT 'pending',
  "message" TEXT,
  "responded_by" UUID REFERENCES "profiles"("id") ON DELETE SET NULL,
  "responded_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX "project_access_requests_project_user_status_idx"
  ON "project_access_requests" ("project_id", "user_id", "status");

-- ─── notifications ──────────────────────────────────────────────────────────

CREATE TABLE "notifications" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "type" "notification_type" NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT,
  "link_url" TEXT,
  "project_id" UUID REFERENCES "projects"("id") ON DELETE CASCADE,
  "read_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX "notifications_user_read_idx"
  ON "notifications" ("user_id", "read_at");
