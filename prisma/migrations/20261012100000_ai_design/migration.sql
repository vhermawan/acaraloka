-- CreateEnum
CREATE TYPE "AiKind" AS ENUM ('CERTIFICATE', 'POSTER');

-- CreateEnum
CREATE TYPE "AiGenerationStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED', 'REJECTED');

-- AlterTable
ALTER TABLE "certificate_configs" ADD COLUMN     "ai_generation_id" TEXT;

-- CreateTable
CREATE TABLE "ai_generations" (
    "id" TEXT NOT NULL,
    "event_id" TEXT,
    "user_id" TEXT NOT NULL,
    "kind" "AiKind" NOT NULL,
    "status" "AiGenerationStatus" NOT NULL DEFAULT 'RUNNING',
    "phase" TEXT,
    "failure_code" TEXT,
    "idempotency_key" TEXT,
    "input" JSONB NOT NULL,
    "brief" JSONB,
    "brief_source" TEXT,
    "prompt_version" TEXT NOT NULL,
    "provider" TEXT,
    "model" TEXT,
    "est_cost_micros" INTEGER NOT NULL DEFAULT 0,
    "cost_micros" INTEGER NOT NULL DEFAULT 0,
    "result_paths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "width" INTEGER,
    "height" INTEGER,
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(3),
    "first_used_at" TIMESTAMPTZ(3),
    "reported_at" TIMESTAMPTZ(3),
    "purged_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_generations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_allowlist" (
    "user_id" TEXT NOT NULL,
    "added_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_allowlist_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE INDEX "ai_generations_event_id_kind_status_idx" ON "ai_generations"("event_id", "kind", "status");

-- CreateIndex
CREATE INDEX "ai_generations_user_id_created_at_idx" ON "ai_generations"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_generations_created_at_idx" ON "ai_generations"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "ai_generations_user_id_idempotency_key_key" ON "ai_generations"("user_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "certificate_configs_ai_generation_id_idx" ON "certificate_configs"("ai_generation_id");

-- AddForeignKey
ALTER TABLE "certificate_configs" ADD CONSTRAINT "certificate_configs_ai_generation_id_fkey" FOREIGN KEY ("ai_generation_id") REFERENCES "ai_generations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_allowlist" ADD CONSTRAINT "ai_allowlist_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "ai_generations_one_running_per_event_idx" ON "ai_generations"("event_id") WHERE "status" = 'RUNNING';

-- CreateIndex
CREATE UNIQUE INDEX "ai_generations_one_report_per_event_kind_idx" ON "ai_generations"("event_id", "kind") WHERE "reported_at" IS NOT NULL;

ALTER TABLE "public"."ai_generations" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."ai_allowlist" ENABLE ROW LEVEL SECURITY;
