-- Purge email log entries older than 90 days (GDPR Art. 5 storage limitation).
-- This migration creates a reusable function so it can also be called
-- from scripts or a scheduled job without duplicating the logic.

-- Idempotent: DROP + CREATE so re-running the migration is safe.
DROP FUNCTION IF EXISTS purge_old_email_logs();

CREATE OR REPLACE FUNCTION purge_old_email_logs()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM email_logs
  WHERE created_at < NOW() - INTERVAL '90 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Run a one-time purge immediately so any stale logs are cleaned up now.
SELECT purge_old_email_logs();
