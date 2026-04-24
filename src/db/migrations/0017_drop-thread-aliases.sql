-- Revert the inbound email relay infrastructure.
--
-- We kept the privacy UI (profiles.email_visibility) but dropped the
-- per-thread alias table and its enum. Email notifications continue to
-- fire; users reply inside the app rather than over SMTP.
--
-- The `inbound_relay` value on the email_type enum is kept because
-- Postgres can't drop enum values in-place without recreating the type,
-- and leaving it unused is harmless.

DROP TABLE IF EXISTS "thread_aliases";
DROP TYPE IF EXISTS "thread_alias_role";
