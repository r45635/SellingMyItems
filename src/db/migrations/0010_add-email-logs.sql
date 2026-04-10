-- Email type enum
CREATE TYPE email_type AS ENUM (
  'welcome',
  'message_notification',
  'intent_received',
  'intent_status',
  'password_reset'
);

-- Email status enum
CREATE TYPE email_status AS ENUM ('sent', 'failed');

-- Email logs table
CREATE TABLE email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email TEXT NOT NULL,
  from_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  type email_type NOT NULL,
  status email_status NOT NULL,
  error_message TEXT,
  resend_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_logs_created_at ON email_logs (created_at);
CREATE INDEX idx_email_logs_type ON email_logs (type);
