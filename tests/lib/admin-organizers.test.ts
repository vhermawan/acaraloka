import { describe, expect, it } from "vitest";

import {
  eventCountSummary,
  mapOrganizerRow,
  parseOrganizerFilter,
  parseOrganizerSort,
} from "@/lib/admin-organizers";

describe("parseOrganizerSort", () => {
  it("accepts whitelisted sorts and falls back to newest", () => {
    expect(parseOrganizerSort("name")).toBe("name");
    expect(parseOrganizerSort(["registrants", "x"])).toBe("registrants");
    expect(parseOrganizerSort("active")).toBe("active");
    expect(parseOrganizerSort("NAME")).toBe("newest");
    expect(parseOrganizerSort("org_name; drop table")).toBe("newest");
    expect(parseOrganizerSort(undefined)).toBe("newest");
  });
});

describe("parseOrganizerFilter", () => {
  it("accepts a bounded non-empty id only", () => {
    expect(parseOrganizerFilter(" abc ")).toBe("abc");
    expect(parseOrganizerFilter(["abc", "def"])).toBe("abc");
    expect(parseOrganizerFilter("")).toBeNull();
    expect(parseOrganizerFilter("   ")).toBeNull();
    expect(parseOrganizerFilter("x".repeat(65))).toBeNull();
    expect(parseOrganizerFilter(undefined)).toBeNull();
    expect(parseOrganizerFilter(5)).toBeNull();
  });
});

describe("mapOrganizerRow", () => {
  const base = {
    user_id: "u1",
    org_name: "HIMA",
    contact_phone: "0812",
    contact_email: null,
    activated_at: new Date("2026-01-01T00:00:00Z"),
    account_name: "Budi",
    account_email: "budi@test.test",
    disabled_at: null,
    draft_count: BigInt(1),
    published_count: BigInt(2),
    cancelled_count: 0,
    disabled_count: BigInt(1),
    registrant_count: BigInt(30),
    certificate_count: BigInt(4),
    last_active_at: null,
  };

  it("converts bigint counts and totals events", () => {
    expect(mapOrganizerRow(base)).toMatchObject({
      id: "u1",
      orgName: "HIMA",
      eventCounts: { draft: 1, published: 2, cancelled: 0, disabled: 1 },
      eventTotal: 4,
      registrantCount: 30,
      certificateCount: 4,
      lastActiveAt: null,
    });
  });

  it("summarizes only non-zero statuses", () => {
    expect(eventCountSummary(mapOrganizerRow(base).eventCounts)).toEqual(["Terbit 2", "Draf 1", "Dinonaktifkan 1"]);
    expect(eventCountSummary({ draft: 0, published: 0, cancelled: 0, disabled: 0 })).toEqual([]);
  });
});
