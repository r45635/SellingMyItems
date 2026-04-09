ALTER TABLE "conversation_threads"
ADD COLUMN IF NOT EXISTS "buyer_last_read_at" timestamp with time zone;

ALTER TABLE "conversation_threads"
ADD COLUMN IF NOT EXISTS "seller_last_read_at" timestamp with time zone;