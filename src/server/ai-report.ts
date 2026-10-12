import "server-only";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { AI_REPORT_MESSAGES, type AiReportDenial } from "@/lib/ai-config";
import { prisma } from "@/server/db";

export type ReportResult =
  | { ok: true }
  | { ok: false; reason: AiReportDenial; message: string };

function denied(reason: AiReportDenial): ReportResult {
  return { ok: false, reason, message: AI_REPORT_MESSAGES[reason] };
}

export async function reportAiGeneration(
  input: { generationId: string; eventId: string },
  db: PrismaClient = prisma,
  now: Date = new Date(),
): Promise<ReportResult> {
  try {
    return await db.$transaction(
      async (tx): Promise<ReportResult> => {
        const generation = await tx.aiGeneration.findFirst({
          where: { id: input.generationId, eventId: input.eventId },
          select: { kind: true },
        });
        if (!generation) return denied("NOT_AVAILABLE");

        const alreadyReported = await tx.aiGeneration.count({
          where: { eventId: input.eventId, kind: generation.kind, reportedAt: { not: null } },
        });
        if (alreadyReported > 0) return denied("REPORT_USED");

        const updated = await tx.aiGeneration.updateMany({
          where: {
            id: input.generationId,
            eventId: input.eventId,
            status: "SUCCEEDED",
            reportedAt: null,
            firstUsedAt: null,
          },
          data: { reportedAt: now },
        });
        if (updated.count === 0) return denied("NOT_AVAILABLE");

        return { ok: true };
      },
      { maxWait: 15_000, timeout: 15_000 },
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return denied("REPORT_USED");
    throw error;
  }
}
