import "server-only";

import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { ADMIN_USERS_PAGE_SIZE, USER_DETAIL_LIST_LIMIT, userDisableDenial, type AdminUserFilters } from "@/lib/admin-users";
import { prisma } from "@/server/db";

export async function listAdminUsers(filters: AdminUserFilters, page: number, db: PrismaClient = prisma) {
  const where: Prisma.UserWhereInput = {
    ...(filters.query
      ? {
          OR: [
            { name: { contains: filters.query, mode: "insensitive" } },
            { email: { contains: filters.query, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(filters.role ? { role: filters.role } : {}),
    ...(filters.status === "active" ? { disabledAt: null } : {}),
    ...(filters.status === "disabled" ? { disabledAt: { not: null } } : {}),
  };

  const [total, rows] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * ADMIN_USERS_PAGE_SIZE,
      take: ADMIN_USERS_PAGE_SIZE,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        emailVerified: true,
        createdAt: true,
        disabledAt: true,
        accounts: { select: { providerId: true } },
      },
    }),
  ]);

  return {
    rows: rows.map(({ accounts, ...row }) => ({ ...row, providers: accounts.map((account) => account.providerId) })),
    total,
    pageCount: Math.max(1, Math.ceil(total / ADMIN_USERS_PAGE_SIZE)),
  };
}

export async function getAdminUserDetail(id: string, db: PrismaClient = prisma) {
  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      image: true,
      role: true,
      emailVerified: true,
      createdAt: true,
      disabledAt: true,
      accounts: { select: { providerId: true } },
      organizerProfile: { select: { orgName: true, contactPhone: true, contactEmail: true, activatedAt: true } },
    },
  });
  if (!user) return null;

  const limit = { take: USER_DETAIL_LIST_LIMIT };
  const [registrationCount, registrations, certificates, events, sessions, history] = await Promise.all([
    db.registration.count({ where: { userId: id } }),
    db.registration.findMany({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
      ...limit,
      select: {
        id: true,
        status: true,
        checkedInAt: true,
        createdAt: true,
        event: { select: { title: true, slug: true } },
      },
    }),
    db.certificate.findMany({
      where: { registration: { userId: id } },
      orderBy: { issuedAt: "desc" },
      ...limit,
      select: {
        id: true,
        number: true,
        issuedAt: true,
        revokedAt: true,
        event: { select: { title: true } },
      },
    }),
    db.event.findMany({
      where: { organizerId: id },
      orderBy: { startAt: "desc" },
      ...limit,
      select: {
        id: true,
        title: true,
        status: true,
        startAt: true,
        timezone: true,
        _count: { select: { registrations: { where: { status: "CONFIRMED" } } } },
      },
    }),
    db.session.findMany({
      where: { userId: id, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      ...limit,
      select: { id: true, createdAt: true, expiresAt: true, ipAddress: true, userAgent: true },
    }),
    db.auditLog.findMany({
      where: { entityType: "User", entityId: id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, action: true, createdAt: true, meta: true },
    }),
  ]);

  const { accounts, ...profile } = user;
  return {
    user: { ...profile, providers: accounts.map((account) => account.providerId) },
    registrationCount,
    registrations,
    certificates,
    events: events.map(({ _count, ...event }) => ({ ...event, activeRegistrations: _count.registrations })),
    sessions,
    history: history.map((entry) => ({
      ...entry,
      reason:
        typeof entry.meta === "object" && entry.meta !== null && "reason" in entry.meta && typeof entry.meta.reason === "string"
          ? entry.meta.reason
          : null,
    })),
  };
}

export type DisableUserResult =
  | { ok: true; revokedSessions: number }
  | { ok: false; reason: "NOT_FOUND" | "SELF" | "ADMIN_TARGET" | "ALREADY_DISABLED" };

export async function disableUser(
  input: { userId: string; actorId: string; reason: string },
  db: PrismaClient = prisma,
): Promise<DisableUserResult> {
  return db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: input.userId },
      select: { id: true, role: true, disabledAt: true },
    });
    if (!user) return { ok: false, reason: "NOT_FOUND" } as const;

    const denial = userDisableDenial(user, input.actorId);
    if (denial) return { ok: false, reason: denial } as const;
    if (user.disabledAt) return { ok: false, reason: "ALREADY_DISABLED" } as const;

    const updated = await tx.user.updateMany({
      where: { id: input.userId, disabledAt: null, role: { not: "ADMIN" } },
      data: { disabledAt: new Date() },
    });
    if (updated.count === 0) return { ok: false, reason: "ALREADY_DISABLED" } as const;

    const revoked = await tx.session.deleteMany({ where: { userId: input.userId } });
    await tx.auditLog.create({
      data: {
        actorId: input.actorId,
        action: "user.disabled",
        entityType: "User",
        entityId: input.userId,
        meta: { reason: input.reason, role: user.role, revokedSessions: revoked.count },
      },
    });
    return { ok: true, revokedSessions: revoked.count } as const;
  });
}

export type EnableUserResult = { ok: true } | { ok: false; reason: "NOT_FOUND" | "NOT_DISABLED" };

export async function enableUser(
  input: { userId: string; actorId: string },
  db: PrismaClient = prisma,
): Promise<EnableUserResult> {
  return db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: input.userId }, select: { role: true, disabledAt: true } });
    if (!user) return { ok: false, reason: "NOT_FOUND" } as const;
    if (!user.disabledAt) return { ok: false, reason: "NOT_DISABLED" } as const;

    const updated = await tx.user.updateMany({
      where: { id: input.userId, disabledAt: { not: null } },
      data: { disabledAt: null },
    });
    if (updated.count === 0) return { ok: false, reason: "NOT_DISABLED" } as const;

    await tx.auditLog.create({
      data: {
        actorId: input.actorId,
        action: "user.enabled",
        entityType: "User",
        entityId: input.userId,
        meta: { role: user.role },
      },
    });
    return { ok: true } as const;
  });
}
