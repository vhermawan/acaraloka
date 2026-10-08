import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import { issueBlocker, type IssueBlocker } from "@/lib/certificate-issue";
import { buildCertificateNumber } from "@/lib/certificate-number";
import { prisma } from "@/server/db";

export type IssueResult =
  | { ok: true; issued: number; firstIssue: boolean }
  | { ok: false; reason: IssueBlocker | "NOT_FOUND" };

export async function issueCertificates(
  eventId: string,
  actorId: string,
  db: PrismaClient = prisma,
  now = new Date(),
): Promise<IssueResult> {
  return db.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "certificate_configs" WHERE "event_id" = ${eventId} FOR UPDATE`;
    const event = await tx.event.findUnique({
      where: { id: eventId },
      select: { status: true, startAt: true, signers: { select: { status: true } } },
    });
    if (!event) return { ok: false, reason: "NOT_FOUND" } as const;
    if (locked.length === 0) return { ok: false, reason: "NOT_LOCKED" } as const;

    const config = await tx.certificateConfig.findUniqueOrThrow({ where: { eventId } });
    const blocker = issueBlocker(
      {
        eventStatus: event.status,
        startAt: event.startAt,
        lockedAt: config.lockedAt,
        signerStatuses: event.signers.map((signer) => signer.status),
      },
      now,
    );
    if (blocker) return { ok: false, reason: blocker } as const;

    const pending = await tx.registration.findMany({
      where: { eventId, status: "CONFIRMED", checkedInAt: { not: null }, certificate: { is: null } },
      orderBy: [{ checkedInAt: "asc" }, { id: "asc" }],
      select: { id: true, name: true },
    });
    if (pending.length === 0) return { ok: true, issued: 0, firstIssue: false } as const;

    const { _max } = await tx.certificate.aggregate({ where: { eventId }, _max: { seq: true } });
    const startSeq = (_max.seq ?? 0) + 1;
    const numbers = new Set<string>();
    const rows = pending.map((registration, index) => {
      const seq = startSeq + index;
      let number = buildCertificateNumber({ date: event.startAt, seq });
      while (numbers.has(number)) number = buildCertificateNumber({ date: event.startAt, seq });
      numbers.add(number);
      return {
        eventId,
        registrationId: registration.id,
        seq,
        number,
        recipientName: registration.name,
        issuedAt: now,
      };
    });
    await tx.certificate.createMany({ data: rows });

    const firstIssue = config.firstIssuedAt === null;
    if (firstIssue) await tx.certificateConfig.update({ where: { eventId }, data: { firstIssuedAt: now } });

    await tx.auditLog.create({
      data: {
        actorId,
        action: firstIssue ? "certificate.issued" : "certificate.issued_followup",
        entityType: "Event",
        entityId: eventId,
        meta: { count: rows.length, fromSeq: startSeq, toSeq: startSeq + rows.length - 1 },
      },
    });
    return { ok: true, issued: rows.length, firstIssue } as const;
  }, { timeout: 30_000 });
}

export async function certificateIssueStats(eventId: string, db: PrismaClient = prisma) {
  const [issued, waiting] = await Promise.all([
    db.certificate.count({ where: { eventId } }),
    db.registration.count({
      where: { eventId, status: "CONFIRMED", checkedInAt: { not: null }, certificate: { is: null } },
    }),
  ]);
  return { issued, waiting };
}
