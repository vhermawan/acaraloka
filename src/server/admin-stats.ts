import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import {
  DAILY_BUCKETS,
  DB_QUOTA_BYTES,
  WEEKLY_BUCKETS,
  bucketStart,
  dayBucketKeys,
  fillSeries,
  weekBucketKeys,
  type BucketRow,
} from "@/lib/admin-stats";
import { env } from "@/lib/env";
import { prisma } from "@/server/db";
import { countBudgetUsed } from "@/server/email-outbox";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function getAdminStats(now = new Date(), db: PrismaClient = prisma) {
  const since24h = new Date(now.getTime() - DAY_MS);
  const since7d = new Date(now.getTime() - 7 * DAY_MS);
  const dayKeys = dayBucketKeys(now, DAILY_BUCKETS);
  const weekKeys = weekBucketKeys(now, WEEKLY_BUCKETS);
  const dayStart = bucketStart(dayKeys[0]);
  const weekStart = bucketStart(weekKeys[0]);

  const [
    eventGroups,
    userGroups,
    registrationCounts,
    certificates,
    errors24h,
    dbSize,
    emailsUsed,
    registrationDaily,
    userWeekly,
    eventWeekly,
  ] = await Promise.all([
    db.event.groupBy({ by: ["status"], _count: { _all: true } }),
    db.user.groupBy({ by: ["role"], _count: { _all: true } }),
    db.$queryRaw<{ r24: bigint; r7: bigint; c_total: bigint; c24: bigint }[]>`
      SELECT
        count(*) FILTER (WHERE created_at >= ${since24h}) AS r24,
        count(*) FILTER (WHERE created_at >= ${since7d}) AS r7,
        count(*) FILTER (WHERE checked_in_at IS NOT NULL) AS c_total,
        count(*) FILTER (WHERE checked_in_at >= ${since24h}) AS c24
      FROM registrations`,
    db.certificate.count({ where: { revokedAt: null } }),
    db.errorLog.aggregate({ _sum: { count: true }, where: { lastSeenAt: { gte: since24h } } }),
    db.$queryRaw<{ size: bigint }[]>`SELECT pg_database_size(current_database()) AS size`,
    countBudgetUsed(db, now),
    db.$queryRaw<BucketRow[]>`
      SELECT to_char(date_trunc('day', created_at AT TIME ZONE 'Asia/Jakarta'), 'YYYY-MM-DD') AS bucket,
             count(*) AS count
      FROM registrations
      WHERE created_at >= ${dayStart} AND created_at <= ${now}
      GROUP BY 1`,
    db.$queryRaw<BucketRow[]>`
      SELECT to_char(date_trunc('week', "createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta'), 'YYYY-MM-DD') AS bucket,
             count(*) AS count
      FROM "user"
      WHERE role <> 'ADMIN'
        AND "createdAt" AT TIME ZONE 'UTC' >= ${weekStart} AND "createdAt" AT TIME ZONE 'UTC' <= ${now}
      GROUP BY 1`,
    db.$queryRaw<BucketRow[]>`
      SELECT to_char(date_trunc('week', published_at AT TIME ZONE 'Asia/Jakarta'), 'YYYY-MM-DD') AS bucket,
             count(*) AS count
      FROM events
      WHERE published_at IS NOT NULL AND published_at >= ${weekStart} AND published_at <= ${now}
      GROUP BY 1`,
  ]);

  const eventCount = (status: string) => eventGroups.find((group) => group.status === status)?._count._all ?? 0;
  const userCount = (role: string) => userGroups.find((group) => group.role === role)?._count._all ?? 0;
  const registrations = registrationCounts[0];

  return {
    events: {
      draft: eventCount("DRAFT"),
      published: eventCount("PUBLISHED"),
      cancelled: eventCount("CANCELLED"),
      disabled: eventCount("DISABLED"),
    },
    users: {
      participants: userCount("PARTICIPANT"),
      organizers: userCount("ORGANIZER"),
      admins: userCount("ADMIN"),
    },
    registrations24h: Number(registrations?.r24 ?? 0),
    registrations7d: Number(registrations?.r7 ?? 0),
    checkedInTotal: Number(registrations?.c_total ?? 0),
    checkedIn24h: Number(registrations?.c24 ?? 0),
    certificatesIssued: certificates,
    errors24h: errors24h._sum.count ?? 0,
    dbSizeBytes: Number(dbSize[0]?.size ?? 0),
    dbQuotaBytes: DB_QUOTA_BYTES,
    emailsSent24h: emailsUsed,
    emailBudget: env.EMAIL_DAILY_BUDGET,
    registrationsDaily: fillSeries(dayKeys, registrationDaily),
    usersWeekly: fillSeries(weekKeys, userWeekly),
    publishedEventsWeekly: fillSeries(weekKeys, eventWeekly),
  };
}

export type AdminStats = Awaited<ReturnType<typeof getAdminStats>>;
