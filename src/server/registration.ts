import "server-only";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { ticketConfirmedEmail } from "@/lib/email-notifications";
import { generateTicketCode } from "@/lib/ticket-code";
import type { RegistrationAnswer } from "@/lib/validation/registration";
import { prisma } from "@/server/db";
import { enqueueEmails } from "@/server/email-outbox";

export type CreateRegistrationInput = {
  eventId: string;
  ticketTypeId: string;
  userId: string;
  name: string;
  email: string;
  phone: string;
  answers: RegistrationAnswer[];
};

export type CreateRegistrationResult =
  | { ok: true; registrationId: string }
  | { ok: false; reason: "ALREADY_REGISTERED" | "SOLD_OUT" | "CLOSED" };

class RegistrationRejected extends Error {
  constructor(readonly reason: "ALREADY_REGISTERED" | "SOLD_OUT" | "CLOSED") {
    super(reason);
  }
}

function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function createRegistration(
  input: CreateRegistrationInput,
  db: PrismaClient = prisma,
  now = new Date(),
): Promise<CreateRegistrationResult> {
  try {
    const registration = await db.$transaction(async (tx) => {
      const event = await tx.event.findUnique({
        where: { id: input.eventId },
        select: { status: true, endAt: true, title: true, startAt: true, timezone: true, venue: true },
      });
      if (!event || event.status !== "PUBLISHED" || event.endAt <= now) throw new RegistrationRejected("CLOSED");

      const existing = await tx.registration.findFirst({
        where: { eventId: input.eventId, userId: input.userId, status: "CONFIRMED" },
        select: { id: true },
      });
      if (existing) throw new RegistrationRejected("ALREADY_REGISTERED");

      const reserved = await tx.$executeRaw`
        UPDATE "ticket_types"
        SET "reserved_count" = "reserved_count" + 1, "updated_at" = now()
        WHERE "id" = ${input.ticketTypeId}
          AND "event_id" = ${input.eventId}
          AND "reserved_count" < "quota"
      `;
      if (reserved === 0) throw new RegistrationRejected("SOLD_OUT");

      const created = await tx.registration.create({
        data: {
          eventId: input.eventId,
          ticketTypeId: input.ticketTypeId,
          userId: input.userId,
          name: input.name,
          email: input.email,
          phone: input.phone,
          answers: input.answers,
          consentAt: now,
          confirmedAt: now,
          status: "CONFIRMED",
          ticketCode: generateTicketCode(),
        },
        select: { id: true, name: true, email: true },
      });
      await enqueueEmails(tx, [ticketConfirmedEmail(created, event)]);
      return created;
    });
    return { ok: true, registrationId: registration.id };
  } catch (error) {
    if (error instanceof RegistrationRejected) return { ok: false, reason: error.reason };
    if (isUniqueViolation(error)) return { ok: false, reason: "ALREADY_REGISTERED" };
    throw error;
  }
}
