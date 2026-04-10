ALTER TABLE "items" ADD COLUMN "reserved_for_user_id" uuid;
ALTER TABLE "items" ADD COLUMN "sold_to_user_id" uuid;
ALTER TABLE "items" ADD COLUMN "reserved_at" timestamp with time zone;
ALTER TABLE "items" ADD COLUMN "sold_at" timestamp with time zone;

ALTER TABLE "items" ADD CONSTRAINT "items_reserved_for_user_id_profiles_id_fk" FOREIGN KEY ("reserved_for_user_id") REFERENCES "profiles"("id") ON DELETE SET NULL;
ALTER TABLE "items" ADD CONSTRAINT "items_sold_to_user_id_profiles_id_fk" FOREIGN KEY ("sold_to_user_id") REFERENCES "profiles"("id") ON DELETE SET NULL;
