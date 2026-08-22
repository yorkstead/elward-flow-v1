ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "is_production_facility" boolean DEFAULT false NOT NULL;
