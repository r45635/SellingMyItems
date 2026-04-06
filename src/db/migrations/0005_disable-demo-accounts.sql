-- Add is_active column to profiles (default true for all existing users)
ALTER TABLE "profiles" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;

-- Disable demo/guest accounts (keep data but prevent login and hide projects)
UPDATE "profiles" SET "is_active" = false
WHERE "id" IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222'
);

-- Also disable the demo seller's seller_account
UPDATE "seller_accounts" SET "is_active" = false
WHERE "user_id" = '11111111-1111-1111-1111-111111111111';
