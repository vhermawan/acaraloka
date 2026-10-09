-- Backfill: accounts flagged as admin become ADMIN
UPDATE "user" SET "role" = 'ADMIN' WHERE "isAdmin" = true;

-- AlterTable
ALTER TABLE "user" DROP COLUMN "isAdmin";
