-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'PAID');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('MANUAL', 'GATEWAY');

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "payment_instructions" TEXT,
ADD COLUMN     "payment_window_hours" INTEGER;

-- AlterTable
ALTER TABLE "registrations" ADD COLUMN     "amount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "paid_at" TIMESTAMPTZ(3),
ADD COLUMN     "paid_by_id" TEXT,
ADD COLUMN     "payment_due_at" TIMESTAMPTZ(3),
ADD COLUMN     "payment_method" "PaymentMethod",
ADD COLUMN     "payment_status" "PaymentStatus" NOT NULL DEFAULT 'NOT_REQUIRED';

-- CreateIndex
CREATE INDEX "registrations_event_id_payment_status_idx" ON "registrations"("event_id", "payment_status");
