import "server-only";

import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import {
  ADMIN_EMAIL_PAGE_SIZE,
  MANUAL_DRAIN_COOLDOWN_MS,
  MANUAL_DRAIN_MAX_EMAILS,
  maskEmail,
  redactEmailError,
  remainingBudget,
  type AdminEmailFilters,
} from "@/lib/admin-email";
import { BUDGET_WINDOW_MS } from "@/lib/email-outbox";
import { env } from "@/lib/env";
import { prisma } from "@/server/db";
import { countBudgetUsed, drainOutbox, type DrainOptions } from "@/server/email-outbox";
import { recordError } from "@/server/error-log";

export async function getEmailOverview(
  options: { budget?: number; enabled?: boolean; now?: Date } = {},
  db: PrismaClient = prisma,
) {
  const now = options.now ?? new Date();
  const budget = options.budget ?? env.EMAIL_DAILY_BUDGET;
  const since = new Date(now.getTime() - BUDGET_WINDOW_MS);

  const [sent24h, failed24h, queued, used] = await Promise.all([
    db.emailOutbox.count({ where: { status: "SENT", sentAt: { gt: since } } }),
    db.emailOutbox.count({ where: { status: "FAILED", updatedAt: { gt: since } } }),
    db.emailOutbox.count({ where: { status: "PENDING" } }),
    countBudgetUsed(db, now),
  ]);

  return {
    sent24h,
    failed24h,
    queued,
    budget,
    remainingBudget: remainingBudget(budget, used),
    enabled: options.enabled ?? env.EMAIL_ENABLED,
  };
}

export async function listEmailOutbox(filters: AdminEmailFilters, page: number, db: PrismaClient = prisma) {
  const where: Prisma.EmailOutboxWhereInput = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.template ? { template: filters.template } : {}),
  };

  const [total, rows] = await Promise.all([
    db.emailOutbox.count({ where }),
    db.emailOutbox.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * ADMIN_EMAIL_PAGE_SIZE,
      take: ADMIN_EMAIL_PAGE_SIZE,
      select: {
        id: true,
        to: true,
        template: true,
        status: true,
        attempts: true,
        lastError: true,
        createdAt: true,
        sentAt: true,
      },
    }),
  ]);

  return {
    rows: rows.map(({ to, lastError, ...row }) => ({
      ...row,
      recipient: maskEmail(to),
      error: redactEmailError(lastError),
    })),
    total,
    pageCount: Math.max(1, Math.ceil(total / ADMIN_EMAIL_PAGE_SIZE)),
  };
}

export type ManualDrainResult =
  | { ok: true; skipped: false; sent: number; failed: number; retrying: number; rateLimited: boolean }
  | { ok: true; skipped: true }
  | { ok: false; reason: "DISABLED" | "COOLDOWN" | "FAILED" };

export async function runManualDrain(
  input: { actorId: string },
  options: Pick<DrainOptions, "send" | "budget" | "baseUrl" | "pauseMs" | "report"> & {
    db?: PrismaClient;
    enabled?: boolean;
    now?: () => Date;
  } = {},
): Promise<ManualDrainResult> {
  const db = options.db ?? prisma;
  const now = options.now ?? (() => new Date());
  if (!(options.enabled ?? env.EMAIL_ENABLED)) return { ok: false, reason: "DISABLED" };

  const recent = await db.auditLog.count({
    where: { action: "email.drain", createdAt: { gt: new Date(now().getTime() - MANUAL_DRAIN_COOLDOWN_MS) } },
  });
  if (recent > 0) return { ok: false, reason: "COOLDOWN" };

  let result: Awaited<ReturnType<typeof drainOutbox>>;
  try {
    result = await drainOutbox({ ...options, db, now, maxBatch: MANUAL_DRAIN_MAX_EMAILS });
  } catch (error) {
    await recordError({ source: "email.drain", error }).catch(() => undefined);
    return { ok: false, reason: "FAILED" };
  }

  await db.auditLog.create({
    data: {
      actorId: input.actorId,
      action: "email.drain",
      entityType: "EmailOutbox",
      entityId: "queue",
      meta: result.skipped
        ? { skipped: true }
        : {
            skipped: false,
            sent: result.sent,
            failed: result.failed,
            retrying: result.retrying,
            rateLimited: result.rateLimited,
          },
    },
  });

  return result.skipped ? { ok: true, skipped: true } : { ok: true, ...result };
}
