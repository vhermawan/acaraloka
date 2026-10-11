UPDATE "events"
SET "location_type" = 'ONLINE', "online_url" = btrim("venue")
WHERE COALESCE(btrim("venue_name"), '') = ''
  AND "online_url" IS NULL
  AND btrim("venue") ~* '^https://[^[:space:]]+$';

UPDATE "events"
SET "venue_name" = btrim("venue")
WHERE COALESCE(btrim("venue_name"), '') = ''
  AND "online_url" IS NULL
  AND btrim("venue") <> '';

ALTER TABLE "events" DROP COLUMN "venue";
