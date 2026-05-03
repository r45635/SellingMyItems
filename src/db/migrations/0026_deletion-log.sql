-- GDPR Art. 17 audit trail: log account deletions without storing PII.
-- The email is hashed (SHA-256) so we can track erasure events without
-- being able to re-identify the subject.
CREATE TABLE IF NOT EXISTS deletion_log (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email_hash     text        NOT NULL,
  deleted_at     timestamptz NOT NULL DEFAULT NOW(),
  items_count    integer     NOT NULL DEFAULT 0,
  images_count   integer     NOT NULL DEFAULT 0,
  messages_count integer     NOT NULL DEFAULT 0,
  intents_count  integer     NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS deletion_log_deleted_at_idx
  ON deletion_log (deleted_at);
