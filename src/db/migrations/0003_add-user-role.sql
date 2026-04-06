CREATE TYPE "public"."user_role" AS ENUM('purchaser', 'seller');--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "role" "user_role" DEFAULT 'purchaser' NOT NULL;