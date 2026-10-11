-- CreateEnum
CREATE TYPE "EventLocationType" AS ENUM ('OFFLINE', 'ONLINE', 'HYBRID');

-- AlterTable
ALTER TABLE "events"
  ADD COLUMN "location_type" "EventLocationType" NOT NULL DEFAULT 'OFFLINE',
  ADD COLUMN "venue_name" TEXT,
  ADD COLUMN "venue_address" TEXT,
  ADD COLUMN "place_id" TEXT,
  ADD COLUMN "online_url" TEXT,
  ALTER COLUMN "venue" SET DEFAULT '';

-- Backfill from the legacy "venue" column, which stays in place until a later drop migration
UPDATE "events"
SET "location_type" = 'ONLINE', "online_url" = btrim("venue")
WHERE btrim("venue") ~* '^https://[^[:space:]]+$';

UPDATE "events"
SET "venue_name" = "venue"
WHERE "location_type" = 'OFFLINE' AND btrim("venue") <> '';
