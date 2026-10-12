import "server-only";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/server/db";

export type AddAllowlistResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "NOT_ORGANIZER" | "ALREADY_ALLOWED" };

export async function addAiAllowlist(
  input: { email: string; actorId: string },
  db: PrismaClient = prisma,
): Promise<AddAllowlistResult> {
  try {
    return await db.$transaction(async (tx): Promise<AddAllowlistResult> => {
      const user = await tx.user.findUnique({
        where: { email: input.email },
        select: { id: true, role: true, organizerProfile: { select: { userId: true } } },
      });
      if (!user || user.role !== "ORGANIZER" || !user.organizerProfile) return { ok: false, reason: "NOT_ORGANIZER" };

      const existing = await tx.aiAllowlist.findUnique({ where: { userId: user.id }, select: { userId: true } });
      if (existing) return { ok: false, reason: "ALREADY_ALLOWED" };

      await tx.aiAllowlist.create({ data: { userId: user.id, addedById: input.actorId } });
      await tx.auditLog.create({
        data: {
          actorId: input.actorId,
          action: "ai.allowlist.add",
          entityType: "User",
          entityId: user.id,
          meta: { email: input.email },
        },
      });
      return { ok: true, userId: user.id };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, reason: "ALREADY_ALLOWED" };
    }
    throw error;
  }
}

export type RemoveAllowlistResult = { ok: true } | { ok: false; reason: "NOT_ALLOWED" };

export async function removeAiAllowlist(
  input: { userId: string; actorId: string },
  db: PrismaClient = prisma,
): Promise<RemoveAllowlistResult> {
  return db.$transaction(async (tx): Promise<RemoveAllowlistResult> => {
    const removed = await tx.aiAllowlist.deleteMany({ where: { userId: input.userId } });
    if (removed.count === 0) return { ok: false, reason: "NOT_ALLOWED" };

    await tx.auditLog.create({
      data: {
        actorId: input.actorId,
        action: "ai.allowlist.remove",
        entityType: "User",
        entityId: input.userId,
      },
    });
    return { ok: true };
  });
}
