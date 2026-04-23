ALTER TYPE "email_type" ADD VALUE IF NOT EXISTS 'invitation_sent';
ALTER TYPE "email_type" ADD VALUE IF NOT EXISTS 'access_granted';
ALTER TYPE "email_type" ADD VALUE IF NOT EXISTS 'access_declined';
ALTER TYPE "email_type" ADD VALUE IF NOT EXISTS 'access_revoked';
ALTER TYPE "email_type" ADD VALUE IF NOT EXISTS 'access_requested';
