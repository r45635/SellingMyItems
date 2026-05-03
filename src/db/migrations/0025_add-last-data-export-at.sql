-- Add last_data_export_at to profiles
-- Used to rate-limit GDPR data exports to 1 per user per 24 hours.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_data_export_at timestamptz;
