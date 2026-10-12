import "server-only";

import {
  AI_DENIAL_MESSAGES,
  AI_QUOTA,
  AI_UNAVAILABLE_MESSAGE,
  type AiKindValue,
  type AiLimits,
} from "@/lib/ai-config";
import { env, getAiLimits } from "@/lib/env";
import { prisma } from "@/server/db";
import {
  countAccountToday,
  countEventKind,
  isCapReached,
  type AiDb,
} from "@/server/ai-quota";

export type AiAccess =
  | { status: "HIDDEN"; message: string }
  | { status: "PAUSED"; message: string }
  | { status: "LOCKED"; message: string }
  | { status: "QUOTA"; message: string }
  | { status: "DAILY"; message: string }
  | { status: "AVAILABLE"; remaining: number | null };

export type AiAccessOptions = {
  db?: AiDb;
  now?: Date;
  limits?: AiLimits;
  enabled?: boolean;
};

const HIDDEN: AiAccess = { status: "HIDDEN", message: AI_UNAVAILABLE_MESSAGE };

export async function getAiAccess(
  user: { id: string },
  context: { eventId: string; kind: AiKindValue } | null = null,
  options: AiAccessOptions = {},
): Promise<AiAccess> {
  const db = options.db ?? prisma;
  const now = options.now ?? new Date();
  const enabled = options.enabled ?? env.AI_ENABLED;

  if (!enabled) return HIDDEN;

  const allowed = await db.aiAllowlist.findUnique({ where: { userId: user.id }, select: { userId: true } });
  if (!allowed) return HIDDEN;

  const limits = options.limits ?? getAiLimits();
  if (await isCapReached(db, now, limits)) return { status: "PAUSED", message: AI_DENIAL_MESSAGES.CAP };

  if (!context) return { status: "AVAILABLE", remaining: null };

  const event = await db.event.findUnique({
    where: { id: context.eventId },
    select: { status: true, certificateConfig: { select: { lockedAt: true } } },
  });
  if (!event || event.status === "DISABLED" || event.status === "CANCELLED") return HIDDEN;
  if (context.kind === "CERTIFICATE" && event.certificateConfig?.lockedAt) {
    return { status: "LOCKED", message: AI_DENIAL_MESSAGES.LOCKED };
  }

  const [eventCount, dayCount] = await Promise.all([
    countEventKind(db, context.eventId, context.kind),
    countAccountToday(db, user.id, now),
  ]);
  if (eventCount >= AI_QUOTA.perEventKind) return { status: "QUOTA", message: AI_DENIAL_MESSAGES.EVENT_LIMIT };
  if (dayCount >= AI_QUOTA.perAccountDay) return { status: "DAILY", message: AI_DENIAL_MESSAGES.DAILY_LIMIT };

  return { status: "AVAILABLE", remaining: AI_QUOTA.perEventKind - eventCount };
}
