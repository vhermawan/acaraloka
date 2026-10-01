import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { buildErrorFingerprint } from "@/lib/error-fingerprint";
import { prisma } from "@/server/db";

const MAX_MESSAGE = 1000;
const MAX_STACK = 4000;

type RecordErrorInput = {
  source: string;
  level?: "error" | "warn";
  error: unknown;
  context?: Prisma.InputJsonValue;
};

export async function recordError({ source, level = "error", error, context }: RecordErrorInput) {
  const name = error instanceof Error ? error.name : "NonError";
  const message = (error instanceof Error ? error.message : String(error)).slice(0, MAX_MESSAGE);
  const stack = error instanceof Error ? error.stack?.slice(0, MAX_STACK) : undefined;
  const fingerprint = buildErrorFingerprint({ source, name, message, stack });
  const now = new Date();

  await prisma.errorLog.upsert({
    where: { fingerprint },
    create: { fingerprint, source, level, message, stack, context },
    update: { count: { increment: 1 }, lastSeenAt: now, message, stack, context },
  });
}
