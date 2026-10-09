-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PARTICIPANT', 'ORGANIZER');

-- AlterTable
ALTER TABLE "user" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'PARTICIPANT';

-- Backfill: accounts that already have an organizer profile become ORGANIZER
UPDATE "user" SET "role" = 'ORGANIZER' WHERE "id" IN (SELECT "user_id" FROM "organizer_profiles");
