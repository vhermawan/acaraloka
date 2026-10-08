import "server-only";

import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { ADMIN_EVENTS_PAGE_SIZE, statusBeforeDisable } from "@/lib/event-disable";
import { prisma } from "@/server/db";

export async function listAdminEvents(query: string, page: number, db: PrismaClient = prisma) {
  const where: Prisma.EventWhereInput = query
    ? {
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { slug: { contains: query, mode: "insensitive" } },
          { organizer: { orgName: { contains: query, mode: "insensitive" } } },
        ],
      }
    : {};

  const [total, rows] = await Promise.all([
    db.event.count({ where }),
    db.event.findMany({
      where,
      orderBy: [{ startAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * ADMIN_EVENTS_PAGE_SIZE,
      take: ADMIN_EVENTS_PAGE_SIZE,
      select: {
        id: true,
        slug: true,
        title: true,
        status: true,
        startAt: true,
        timezone: true,
        disabledReason: true,
        organizer: { select: { orgName: true } },
        _count: { select: { registrations: { where: { status: "CONFIRMED" } } } },
      },
    }),
  ]);

  return {
    rows: rows.map(({ _count, ...row }) => ({ ...row, activeRegistrations: _count.registrations })),
    total,
    pageCount: Math.max(1, Math.ceil(total / ADMIN_EVENTS_PAGE_SIZE)),
  };
}

export type DisableEventResult = { ok: true; slug: string } | { ok: false; reason: "NOT_FOUND" | "ALREADY_DISABLED" };

export async function disableEvent(
  input: { eventId: string; actorId: string; reason: string },
  db: PrismaClient = prisma,
): Promise<DisableEventResult> {
  return db.$transaction(async (tx) => {
    const event = await tx.event.findUnique({ where: { id: input.eventId }, select: { status: true, slug: true } });
    if (!event) return { ok: false, reason: "NOT_FOUND" } as const;
    if (event.status === "DISABLED") return { ok: false, reason: "ALREADY_DISABLED" } as const;

    const updated = await tx.event.updateMany({
      where: { id: input.eventId, status: event.status },
      data: { status: "DISABLED", disabledReason: input.reason },
    });
    if (updated.count === 0) return { ok: false, reason: "ALREADY_DISABLED" } as const;

    await tx.auditLog.create({
      data: {
        actorId: input.actorId,
        action: "event.disabled",
        entityType: "Event",
        entityId: input.eventId,
        meta: { reason: input.reason, previousStatus: event.status },
      },
    });
    return { ok: true, slug: event.slug } as const;
  });
}

export type EnableEventResult = { ok: true; slug: string; status: string } | { ok: false; reason: "NOT_FOUND" | "NOT_DISABLED" };

export async function enableEvent(
  input: { eventId: string; actorId: string },
  db: PrismaClient = prisma,
): Promise<EnableEventResult> {
  return db.$transaction(async (tx) => {
    const event = await tx.event.findUnique({
      where: { id: input.eventId },
      select: { status: true, slug: true, cancelledAt: true, publishedAt: true },
    });
    if (!event) return { ok: false, reason: "NOT_FOUND" } as const;
    if (event.status !== "DISABLED") return { ok: false, reason: "NOT_DISABLED" } as const;

    const restored = statusBeforeDisable(event);
    const updated = await tx.event.updateMany({
      where: { id: input.eventId, status: "DISABLED" },
      data: { status: restored, disabledReason: null },
    });
    if (updated.count === 0) return { ok: false, reason: "NOT_DISABLED" } as const;

    await tx.auditLog.create({
      data: {
        actorId: input.actorId,
        action: "event.enabled",
        entityType: "Event",
        entityId: input.eventId,
        meta: { restoredStatus: restored },
      },
    });
    return { ok: true, slug: event.slug, status: restored } as const;
  });
}
