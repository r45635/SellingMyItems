-- Drop the legacy `user_role` enum and `profiles.role` column.
--
-- After 0018 unified buyers and sellers (selling open to anyone, gated by
-- project publish_status), the only thing the role column still gated was
-- admin access. We replace it with a plain `is_admin` boolean — simpler
-- to reason about, no enum migration drama if we ever add another role
-- (we'd just add another boolean).
--
-- Buyer/seller capabilities are derived from data: every signed-in user
-- is a buyer; "seller" is the existence of a row in `seller_accounts`.

ALTER TABLE "profiles"
  ADD COLUMN IF NOT EXISTS "is_admin" boolean NOT NULL DEFAULT false;

UPDATE "profiles"
   SET "is_admin" = true
 WHERE "role" = 'admin';

ALTER TABLE "profiles" DROP COLUMN IF EXISTS "role";

DROP TYPE IF EXISTS "user_role";
