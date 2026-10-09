import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import { issueBlocker, type IssueBlocker } from "@/lib/certificate-issue";
import { certificateIssuedEmail } from "@/lib/email-notifications";
import { buildCertificateNumber } from "@/lib/certificate-number";
import type { CertificateLayout } from "@/lib/certificate-layout";
import { formatCertificateDate, getOrCreateCertificateConfig, loadCertificateTemplate, verifyUrl } from "@/server/certificate-config";
import type { CertificateRenderData, CertificateTemplate } from "@/server/certificate-pdf";
import { prisma } from "@/server/db";
import { enqueueEmails } from "@/server/email-outbox";
import { loadSignerRenderData } from "@/server/signers";

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
      select: { status: true, title: true, startAt: true, signers: { select: { status: true } } },
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
      select: { id: true, name: true, email: true },
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
    await enqueueEmails(
      tx,
      pending.map((registration) => certificateIssuedEmail(registration, event)),
    );

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

export type RegistrationNameResult = { ok: true } | { ok: false; reason: "NOT_EDITABLE" };

export async function updateRegistrationName(
  userId: string,
  registrationId: string,
  name: string,
  db: PrismaClient = prisma,
): Promise<RegistrationNameResult> {
  return db.$transaction(async (tx) => {
    const registration = await tx.registration.findFirst({
      where: { id: registrationId, userId },
      select: { eventId: true },
    });
    if (!registration) return { ok: false, reason: "NOT_EDITABLE" } as const;

    await tx.$queryRaw`SELECT "id" FROM "certificate_configs" WHERE "event_id" = ${registration.eventId} FOR UPDATE`;
    const updated = await tx.registration.updateMany({
      where: { id: registrationId, userId, status: "CONFIRMED", certificate: { is: null } },
      data: { name },
    });
    return updated.count === 1 ? ({ ok: true } as const) : ({ ok: false, reason: "NOT_EDITABLE" } as const);
  }, { maxWait: 10_000, timeout: 40_000 });
}

export async function listUserCertificates(userId: string, db: PrismaClient = prisma) {
  return db.certificate.findMany({
    where: { registration: { userId } },
    orderBy: { issuedAt: "desc" },
    select: {
      id: true,
      number: true,
      revokedAt: true,
      event: { select: { title: true, startAt: true, timezone: true } },
    },
  });
}

export async function getUserCertificateRenderData(
  userId: string,
  number: string,
  db: PrismaClient = prisma,
): Promise<{ data: CertificateRenderData; layout: CertificateLayout; template: CertificateTemplate } | null> {
  const certificate = await db.certificate.findFirst({
    where: { number, revokedAt: null, registration: { userId } },
    select: {
      number: true,
      recipientName: true,
      event: { select: { id: true, title: true, startAt: true, timezone: true, organizer: { select: { orgName: true } } } },
    },
  });
  if (!certificate) return null;

  const { event } = certificate;
  const [config, signers] = await Promise.all([
    getOrCreateCertificateConfig(event.id, db),
    loadSignerRenderData(event.id, db),
  ]);
  return {
    layout: config.layout,
    template: await loadCertificateTemplate(config),
    data: {
      recipientName: certificate.recipientName,
      certificateNumber: certificate.number,
      eventTitle: event.title,
      eventDate: formatCertificateDate(event.startAt, event.timezone),
      organizerName: event.organizer.orgName,
      verifyUrl: verifyUrl(certificate.number),
      signers,
    },
  };
}

export type RevokeResult = { ok: true } | { ok: false; reason: "NOT_FOUND" | "ALREADY_REVOKED" };

export async function revokeCertificate(
  input: { eventId: string; certificateId: string; actorId: string; reason: string },
  db: PrismaClient = prisma,
  now = new Date(),
): Promise<RevokeResult> {
  return db.$transaction(async (tx) => {
    const certificate = await tx.certificate.findFirst({
      where: { id: input.certificateId, eventId: input.eventId },
      select: { number: true },
    });
    if (!certificate) return { ok: false, reason: "NOT_FOUND" } as const;

    const updated = await tx.certificate.updateMany({
      where: { id: input.certificateId, eventId: input.eventId, revokedAt: null },
      data: { revokedAt: now },
    });
    if (updated.count === 0) return { ok: false, reason: "ALREADY_REVOKED" } as const;

    await tx.auditLog.create({
      data: {
        actorId: input.actorId,
        action: "certificate.revoked",
        entityType: "Certificate",
        entityId: input.certificateId,
        meta: { eventId: input.eventId, number: certificate.number, reason: input.reason },
      },
    });
    return { ok: true } as const;
  });
}

export async function listEventCertificates(eventId: string, db: PrismaClient = prisma) {
  return db.certificate.findMany({
    where: { eventId },
    orderBy: { seq: "asc" },
    select: { id: true, number: true, recipientName: true, revokedAt: true },
  });
}
