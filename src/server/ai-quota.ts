import "server-only";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import {
  AI_DENIAL_MESSAGES,
  AI_PRICING,
  AI_QUOTA,
  AI_RESERVE_LOCK_KEY,
  AI_STALE_AFTER_MS,
  activeCapUsd,
  estimateGenerationMicros,
  usdToMicros,
  wibDayStart,
  wibMonthStart,
  type AiDenialReason,
  type AiKindValue,
  type AiLimits,
  type AiPricing,
} from "@/lib/ai-config";
import { getAiLimits } from "@/lib/env";
import { prisma } from "@/server/db";

export type AiDb = PrismaClient | Prisma.TransactionClient;

const COUNTED_STATUSES = ["SUCCEEDED", "RUNNING"] as const;

export async function sweepStaleGenerations(db: AiDb, now: Date = new Date()) {
  const stale = await db.aiGeneration.findMany({
    where: { status: "RUNNING", startedAt: { lt: new Date(now.getTime() - AI_STALE_AFTER_MS) } },
    select: { id: true, estCostMicros: true },
  });
  let swept = 0;
  for (const row of stale) {
    const result = await db.aiGeneration.updateMany({
      where: { id: row.id, status: "RUNNING" },
      data: { status: "FAILED", failureCode: "STALE", finishedAt: now, costMicros: row.estCostMicros },
    });
    swept += result.count;
  }
  return swept;
}

export async function monthlySpendMicros(db: AiDb, now: Date) {
  const [spent, running] = await Promise.all([
    db.aiGeneration.aggregate({
      _sum: { costMicros: true },
      where: { createdAt: { gte: wibMonthStart(now) } },
    }),
    db.aiGeneration.aggregate({
      _sum: { estCostMicros: true },
      where: { status: "RUNNING" },
    }),
  ]);
  return (spent._sum.costMicros ?? 0) + (running._sum.estCostMicros ?? 0);
}

export function countEventKind(db: AiDb, eventId: string, kind: AiKindValue) {
  return db.aiGeneration.count({
    where: { eventId, kind, status: { in: [...COUNTED_STATUSES] }, reportedAt: null },
  });
}

export function countAccountToday(db: AiDb, userId: string, now: Date) {
  return db.aiGeneration.count({
    where: { userId, createdAt: { gte: wibDayStart(now) }, status: { in: [...COUNTED_STATUSES] }, reportedAt: null },
  });
}

export function countGlobalToday(db: AiDb, now: Date) {
  return db.aiGeneration.count({
    where: {
      createdAt: { gte: wibDayStart(now) },
      NOT: { status: "REJECTED", failureCode: "BLOCKLIST" },
    },
  });
}

export async function isCapReached(
  db: AiDb,
  now: Date,
  limits: Pick<AiLimits, "monthlyCapUsd" | "trialCapUsd" | "trialEndsOn">,
  pricing: AiPricing = AI_PRICING,
) {
  const spent = await monthlySpendMicros(db, now);
  return spent + estimateGenerationMicros(pricing) > usdToMicros(activeCapUsd(now, limits));
}

export type ReserveInput = {
  eventId: string;
  userId: string;
  kind: AiKindValue;
  input: Prisma.InputJsonValue;
  promptVersion: string;
  idempotencyKey?: string;
};

export type ReserveOptions = {
  db?: PrismaClient;
  now?: Date;
  limits?: AiLimits;
  pricing?: AiPricing;
};

export type ReserveResult =
  | { ok: true; generationId: string; estCostMicros: number; reused: boolean }
  | { ok: false; reason: AiDenialReason; message: string };

function denied(reason: AiDenialReason): ReserveResult {
  return { ok: false, reason, message: AI_DENIAL_MESSAGES[reason] };
}

export async function reserveGeneration(input: ReserveInput, options: ReserveOptions = {}): Promise<ReserveResult> {
  const db = options.db ?? prisma;
  const now = options.now ?? new Date();
  const limits = options.limits ?? getAiLimits();
  const estCostMicros = estimateGenerationMicros(options.pricing ?? AI_PRICING);

  try {
    return await db.$transaction(
      async (tx): Promise<ReserveResult> => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${AI_RESERVE_LOCK_KEY}::bigint)`;

        await sweepStaleGenerations(tx, now);

        if (input.idempotencyKey) {
          const existing = await tx.aiGeneration.findUnique({
            where: { userId_idempotencyKey: { userId: input.userId, idempotencyKey: input.idempotencyKey } },
            select: { id: true, estCostMicros: true, eventId: true, kind: true },
          });
          if (existing && (existing.eventId !== input.eventId || existing.kind !== input.kind)) {
            return denied("IDEMPOTENCY_MISMATCH");
          }
          if (existing) {
            return { ok: true, generationId: existing.id, estCostMicros: existing.estCostMicros, reused: true };
          }
        }

        const event = await tx.event.findUnique({
          where: { id: input.eventId },
          select: { status: true, certificateConfig: { select: { lockedAt: true } } },
        });
        if (!event || event.status === "DISABLED" || event.status === "CANCELLED") return denied("EVENT_CLOSED");
        if (input.kind === "CERTIFICATE" && event.certificateConfig?.lockedAt) return denied("LOCKED");

        const running = await tx.aiGeneration.count({ where: { eventId: input.eventId, status: "RUNNING" } });
        if (running > 0) return denied("EVENT_RUNNING");

        if ((await countEventKind(tx, input.eventId, input.kind)) >= AI_QUOTA.perEventKind) return denied("EVENT_LIMIT");
        if ((await countAccountToday(tx, input.userId, now)) >= AI_QUOTA.perAccountDay) return denied("DAILY_LIMIT");

        const spent = await monthlySpendMicros(tx, now);
        if (spent + estCostMicros > usdToMicros(activeCapUsd(now, limits))) return denied("CAP");

        if ((await countGlobalToday(tx, now)) >= limits.globalDailyLimit) return denied("GLOBAL_DAILY");

        const created = await tx.aiGeneration.create({
          data: {
            eventId: input.eventId,
            userId: input.userId,
            kind: input.kind,
            status: "RUNNING",
            phase: "BRIEF",
            input: input.input,
            promptVersion: input.promptVersion,
            idempotencyKey: input.idempotencyKey,
            estCostMicros,
            startedAt: now,
          },
          select: { id: true },
        });
        return { ok: true, generationId: created.id, estCostMicros, reused: false };
      },
      { maxWait: 15_000, timeout: 15_000 },
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return denied("EVENT_RUNNING");
    throw error;
  }
}
