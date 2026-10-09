-- Backfill: accounts flagged as admin become ADMIN
UPDATE "user" SET "role" = 'ADMIN' WHERE "isAdmin" = true;
