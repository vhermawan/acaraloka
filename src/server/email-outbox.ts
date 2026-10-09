import "server-only";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import {
  BUDGET_WINDOW_MS,
  MAX_EMAIL_ATTEMPTS,
  STALE_CLAIM_MS,
  type OutboxItem,
  claimLimit,
  classifySendFailure,
  redactEmails,
  retryDelayMs,
} from "@/lib/email-outbox";
import { parseEmailMessage, renderEmail } from "@/lib/email-templates";
import { env, getEmailConfig } from "@/lib/env";
import { prisma } from "@/server/db";
import { recordError } from "@/server/error-log";
import { createResendSender, type EmailSender } from "@/server/resend";

type DbClient = PrismaClient | Prisma.TransactionClient;

export async function enqueueEmails(db: DbClient, items: OutboxItem[], enabled = env.EMAIL_ENABLED): Promise<number> {
  if (!enabled || items.length === 0) return 0;
  const { count } = await db.emailOutbox.createMany({
    data: items.map((item) => ({
      to: item.to,
      template: item.template,
      payload: item.payload,
      priority: item.priority,
      dedupeKey: item.dedupeKey,
    })),
    skipDuplicates: true,
  });
  return count;
}

const DRAIN_LOCK_KEY = 4_870_215;
const PAUSE_BETWEEN_SENDS_MS = 600;
const MAX_ERROR_LENGTH = 500;

type ClaimedRow = {
  id: string;
  to: string;
  template: string;
  payload: unknown;
  attempts: number;
  dedupeKey: string;
  priority: number;
  createdAt: Date;
};

export type DrainResult =
  | { skipped: true }
  | { skipped: false; sent: number; failed: number; retrying: number; rateLimited: boolean };

export type DrainOptions = {
  db?: PrismaClient;
  send?: EmailSender;
  budget?: number;
  maxBatch?: number;
  dedupeKeyPrefix?: string;
  baseUrl?: string;
  now?: () => Date;
  pauseMs?: number;
  report?: (error: Error, context: { outboxId: string; template: string; status: number | null }) => Promise<void>;
};

export async function countBudgetUsed(db: DbClient, now: Date): Promise<number> {
  return db.emailOutbox.count({
    where: { OR: [{ sentAt: { gt: new Date(now.getTime() - BUDGET_WINDOW_MS) } }, { status: "SENDING" }] },
  });
}

async function claimBatch(db: PrismaClient, budget: number, now: Date, maxBatch?: number, dedupeKeyPrefix?: string): Promise<ClaimedRow[] | null> {
  return db.$transaction(async (tx) => {
    const [{ locked }] = await tx.$queryRaw<{ locked: boolean }[]>`
      SELECT pg_try_advisory_xact_lock(${DRAIN_LOCK_KEY}::bigint) AS "locked"`;
    if (!locked) return null;

    const used = await countBudgetUsed(tx, now);
    const limit = claimLimit(budget, used, maxBatch);
    if (limit === 0) return [];

    const staleBefore = new Date(now.getTime() - STALE_CLAIM_MS);
    const scope = dedupeKeyPrefix ? Prisma.sql`AND starts_with("dedupe_key", ${dedupeKeyPrefix})` : Prisma.empty;
    const rows = await tx.$queryRaw<ClaimedRow[]>`
      UPDATE "email_outbox"
      SET "status" = 'SENDING', "claimed_at" = ${now}, "updated_at" = ${now}
      WHERE "id" IN (
        SELECT "id" FROM "email_outbox"
        WHERE (("status" = 'PENDING' AND "send_after" <= ${now})
           OR ("status" = 'SENDING' AND "claimed_at" < ${staleBefore}))
           ${scope}
        ORDER BY "priority" ASC, "created_at" ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING "id", "to", "template", "payload", "attempts", "dedupe_key" AS "dedupeKey", "priority", "created_at" AS "createdAt"`;
    return rows.sort((a, b) => a.priority - b.priority || a.createdAt.getTime() - b.createdAt.getTime());
  });
}

async function defaultReport(error: Error, context: { outboxId: string; template: string; status: number | null }) {
  await recordError({ source: "email.send", level: "warn", error, context });
}

export async function drainOutbox(options: DrainOptions = {}): Promise<DrainResult> {
  const db = options.db ?? prisma;
  const now = options.now ?? (() => new Date());
  const budget = options.budget ?? getEmailConfig().dailyBudget;
  const send = options.send ?? createResendSender();
  const baseUrl = options.baseUrl ?? env.APP_BASE_URL;
  const pauseMs = options.pauseMs ?? PAUSE_BETWEEN_SENDS_MS;
  const report = options.report ?? defaultReport;

  const rows = await claimBatch(db, budget, now(), options.maxBatch, options.dedupeKeyPrefix);
  if (rows === null) return { skipped: true };

  const result = { skipped: false as const, sent: 0, failed: 0, retrying: 0, rateLimited: false };

  for (const [index, row] of rows.entries()) {
    if (index > 0 && pauseMs > 0) await new Promise((resolve) => setTimeout(resolve, pauseMs));

    const message = parseEmailMessage(row.template, row.payload);
    if (!message) {
      await db.emailOutbox.updateMany({
        where: { id: row.id, status: "SENDING" },
        data: { status: "FAILED", payload: Prisma.DbNull, claimedAt: null, lastError: "Payload tidak valid" },
      });
      result.failed += 1;
      continue;
    }

    const outcome = await send({ to: row.to, ...renderEmail(message, baseUrl) }, row.dedupeKey);
    if (outcome.ok) {
      await db.emailOutbox.updateMany({
        where: { id: row.id, status: "SENDING" },
        data: {
          status: "SENT",
          sentAt: now(),
          providerMessageId: outcome.id,
          payload: Prisma.DbNull,
          claimedAt: null,
          lastError: null,
        },
      });
      result.sent += 1;
      continue;
    }

    const kind = classifySendFailure(outcome.status);
    if (kind === "RATE_LIMITED") {
      await db.emailOutbox.updateMany({
        where: { id: { in: rows.slice(index).map((pending) => pending.id) }, status: "SENDING" },
        data: { status: "PENDING", claimedAt: null },
      });
      result.rateLimited = true;
      break;
    }

    const attempts = row.attempts + 1;
    const lastError = redactEmails(`${outcome.status ?? "network"}: ${outcome.message}`).slice(0, MAX_ERROR_LENGTH);
    const giveUp = kind === "REJECTED" || attempts >= MAX_EMAIL_ATTEMPTS;
    await db.emailOutbox.updateMany({
      where: { id: row.id, status: "SENDING" },
      data: giveUp
        ? { status: "FAILED", attempts, lastError, claimedAt: null, payload: Prisma.DbNull }
        : {
            status: "PENDING",
            attempts,
            lastError,
            claimedAt: null,
            sendAfter: new Date(now().getTime() + retryDelayMs(attempts)),
          },
    });
    if (giveUp) result.failed += 1;
    else result.retrying += 1;

    await report(new Error(`Resend ${lastError}`), {
      outboxId: row.id,
      template: row.template,
      status: outcome.status,
    }).catch(() => undefined);
  }

  return result;
}

export async function purgeOldOutbox(db: PrismaClient, before: Date): Promise<number> {
  const { count } = await db.emailOutbox.deleteMany({
    where: { status: { in: ["SENT", "FAILED"] }, updatedAt: { lt: before } },
  });
  return count;
}
