import "server-only";

import { prisma } from "@/server/db";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function getAdminStats(now = new Date()) {
  const since = new Date(now.getTime() - DAY_MS);

  const [publishedEvents, registrations24h, errors24h, dbSize] = await Promise.all([
    prisma.event.count({ where: { status: "PUBLISHED" } }),
    prisma.registration.count({ where: { createdAt: { gte: since } } }),
    prisma.errorLog.aggregate({ _sum: { count: true }, where: { lastSeenAt: { gte: since } } }),
    prisma.$queryRaw<{ size: bigint }[]>`SELECT pg_database_size(current_database()) AS size`,
  ]);

  return {
    publishedEvents,
    registrations24h,
    errors24h: errors24h._sum.count ?? 0,
    dbSizeBytes: Number(dbSize[0]?.size ?? 0),
  };
}
