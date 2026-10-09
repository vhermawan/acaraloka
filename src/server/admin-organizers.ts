import "server-only";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import {
  ADMIN_ORGANIZERS_PAGE_SIZE,
  ORGANIZER_EVENT_LIST_LIMIT,
  mapOrganizerRow,
  type AdminOrganizerFilters,
  type OrganizerAggregateRow,
  type OrganizerSort,
} from "@/lib/admin-organizers";
import { prisma } from "@/server/db";

const ORDER_BY: Record<OrganizerSort, Prisma.Sql> = {
  newest: Prisma.sql`p.activated_at DESC, p.user_id ASC`,
  name: Prisma.sql`lower(p.org_name) ASC, p.user_id ASC`,
  events: Prisma.sql`event_total DESC, p.org_name ASC, p.user_id ASC`,
  registrants: Prisma.sql`registrant_count DESC, p.org_name ASC, p.user_id ASC`,
  active: Prisma.sql`last_active_at DESC NULLS LAST, p.org_name ASC, p.user_id ASC`,
};

function searchCondition(query: string) {
  if (!query) return Prisma.sql`TRUE`;
  return Prisma.sql`(
    strpos(lower(p.org_name), lower(${query})) > 0
    OR strpos(lower(u.name), lower(${query})) > 0
    OR strpos(lower(u.email), lower(${query})) > 0
    OR strpos(lower(coalesce(p.contact_email, '')), lower(${query})) > 0
  )`;
}

function selectOrganizers(where: Prisma.Sql, orderBy: Prisma.Sql, limit: number, offset: number) {
  return Prisma.sql`
    WITH event_stats AS (
      SELECT
        organizer_id,
        count(*) FILTER (WHERE status = 'DRAFT') AS draft_count,
        count(*) FILTER (WHERE status = 'PUBLISHED') AS published_count,
        count(*) FILTER (WHERE status = 'CANCELLED') AS cancelled_count,
        count(*) FILTER (WHERE status = 'DISABLED') AS disabled_count,
        count(*) AS event_total,
        max(updated_at) AS last_event_at
      FROM events
      GROUP BY organizer_id
    ),
    registrant_stats AS (
      SELECT e.organizer_id, count(*) AS registrant_count
      FROM registrations r
      JOIN events e ON e.id = r.event_id
      WHERE r.status = 'CONFIRMED'
      GROUP BY e.organizer_id
    ),
    certificate_stats AS (
      SELECT e.organizer_id, count(*) AS certificate_count
      FROM certificates c
      JOIN events e ON e.id = c.event_id
      WHERE c.revoked_at IS NULL
      GROUP BY e.organizer_id
    ),
    session_stats AS (
      SELECT "userId" AS user_id, max("updatedAt" AT TIME ZONE 'UTC') AS last_session_at
      FROM session
      GROUP BY "userId"
    )
    SELECT
      p.user_id,
      p.org_name,
      p.contact_phone,
      p.contact_email,
      p.activated_at,
      u.name AS account_name,
      u.email AS account_email,
      u."disabledAt" AS disabled_at,
      coalesce(es.draft_count, 0) AS draft_count,
      coalesce(es.published_count, 0) AS published_count,
      coalesce(es.cancelled_count, 0) AS cancelled_count,
      coalesce(es.disabled_count, 0) AS disabled_count,
      coalesce(es.event_total, 0) AS event_total,
      coalesce(rs.registrant_count, 0) AS registrant_count,
      coalesce(cs.certificate_count, 0) AS certificate_count,
      greatest(ss.last_session_at, es.last_event_at) AS last_active_at
    FROM organizer_profiles p
    JOIN "user" u ON u.id = p.user_id
    LEFT JOIN event_stats es ON es.organizer_id = p.user_id
    LEFT JOIN registrant_stats rs ON rs.organizer_id = p.user_id
    LEFT JOIN certificate_stats cs ON cs.organizer_id = p.user_id
    LEFT JOIN session_stats ss ON ss.user_id = p.user_id
    WHERE ${where}
    ORDER BY ${orderBy}
    LIMIT ${limit} OFFSET ${offset}`;
}

export async function listAdminOrganizers(filters: AdminOrganizerFilters, page: number, db: PrismaClient = prisma) {
  const where = searchCondition(filters.query);
  const [totals, rows] = await Promise.all([
    db.$queryRaw<{ total: bigint }[]>`
      SELECT count(*) AS total
      FROM organizer_profiles p
      JOIN "user" u ON u.id = p.user_id
      WHERE ${where}`,
    db.$queryRaw<OrganizerAggregateRow[]>(
      selectOrganizers(where, ORDER_BY[filters.sort], ADMIN_ORGANIZERS_PAGE_SIZE, (page - 1) * ADMIN_ORGANIZERS_PAGE_SIZE),
    ),
  ]);
  const total = Number(totals[0]?.total ?? 0);

  return {
    rows: rows.map(mapOrganizerRow),
    total,
    pageCount: Math.max(1, Math.ceil(total / ADMIN_ORGANIZERS_PAGE_SIZE)),
  };
}

export async function getAdminOrganizerDetail(id: string, db: PrismaClient = prisma) {
  const [rows, events, eventTotal] = await Promise.all([
    db.$queryRaw<OrganizerAggregateRow[]>(selectOrganizers(Prisma.sql`p.user_id = ${id}`, ORDER_BY.newest, 1, 0)),
    db.event.findMany({
      where: { organizerId: id },
      orderBy: [{ startAt: "desc" }, { id: "asc" }],
      take: ORGANIZER_EVENT_LIST_LIMIT,
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        startAt: true,
        timezone: true,
        _count: { select: { registrations: { where: { status: "CONFIRMED" } } } },
      },
    }),
    db.event.count({ where: { organizerId: id } }),
  ]);
  if (rows.length === 0) return null;

  return {
    organizer: mapOrganizerRow(rows[0]),
    events: events.map(({ _count, ...event }) => ({ ...event, activeRegistrations: _count.registrations })),
    eventTotal,
  };
}
