import { describe, expect, it } from "vitest";

import {
  describeUserAgent,
  loginMethods,
  parseRoleFilter,
  parseStatusFilter,
  userDisableDenial,
} from "@/lib/admin-users";

describe("filter parsing", () => {
  it("accepts known roles and statuses only", () => {
    expect(parseRoleFilter("ORGANIZER")).toBe("ORGANIZER");
    expect(parseRoleFilter(["ADMIN", "x"])).toBe("ADMIN");
    expect(parseRoleFilter("organizer")).toBeNull();
    expect(parseRoleFilter(undefined)).toBeNull();
    expect(parseStatusFilter("disabled")).toBe("disabled");
    expect(parseStatusFilter("active")).toBe("active");
    expect(parseStatusFilter("DISABLED")).toBeNull();
    expect(parseStatusFilter("'; drop table user")).toBeNull();
  });
});

describe("loginMethods", () => {
  it("labels, dedupes, and sorts providers", () => {
    expect(loginMethods(["credential", "google", "google"])).toEqual(["Google", "Password"]);
    expect(loginMethods([])).toEqual([]);
    expect(loginMethods(["github"])).toEqual(["github"]);
  });
});

describe("userDisableDenial", () => {
  it("refuses self and admins, allows others", () => {
    expect(userDisableDenial({ id: "a", role: "ADMIN" }, "a")).toBe("SELF");
    expect(userDisableDenial({ id: "b", role: "ADMIN" }, "a")).toBe("ADMIN_TARGET");
    expect(userDisableDenial({ id: "c", role: "PARTICIPANT" }, "a")).toBeNull();
    expect(userDisableDenial({ id: "d", role: "ORGANIZER" }, "a")).toBeNull();
  });
});

describe("describeUserAgent", () => {
  it("summarizes common browsers", () => {
    expect(
      describeUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      ),
    ).toBe("Chrome di macOS");
    expect(describeUserAgent("Mozilla/5.0 (Linux; Android 14) Chrome/120.0 Mobile Safari/537.36")).toBe("Chrome di Android");
    expect(describeUserAgent(null)).toBe("Tidak diketahui");
  });
});
