import { describe, expect, it } from "vitest";

import { createEventSlug, slugify } from "@/lib/slug";
import { dateToLocalInput, localInputToDate } from "@/lib/timezone";
import { eventFormSchema, validatePosterFile } from "@/lib/validation/event";

const valid = {
  title: "Workshop Next.js",
  description: "Belajar App Router dari nol sampai deploy.",
  timezone: "Asia/Jakarta",
  startAt: "2026-11-01T09:00",
  endAt: "2026-11-01T12:00",
  locationType: "OFFLINE",
  venueName: "Aula Kampus A",
  venueAddress: "",
  placeId: "",
  onlineUrl: "",
};

describe("timezone conversion", () => {
  it("converts local WIB/WITA/WIT input to UTC", () => {
    expect(localInputToDate("2026-11-01T09:00", "Asia/Jakarta")?.toISOString()).toBe("2026-11-01T02:00:00.000Z");
    expect(localInputToDate("2026-11-01T09:00", "Asia/Makassar")?.toISOString()).toBe("2026-11-01T01:00:00.000Z");
    expect(localInputToDate("2026-11-01T09:00", "Asia/Jayapura")?.toISOString()).toBe("2026-11-01T00:00:00.000Z");
  });

  it("round-trips back to the input value", () => {
    const date = localInputToDate("2026-12-31T23:30", "Asia/Makassar")!;
    expect(dateToLocalInput(date, "Asia/Makassar")).toBe("2026-12-31T23:30");
  });

  it("rejects malformed or impossible dates", () => {
    expect(localInputToDate("", "Asia/Jakarta")).toBeNull();
    expect(localInputToDate("2026-02-30T10:00", "Asia/Jakarta")).toBeNull();
  });
});

describe("eventFormSchema", () => {
  it("parses valid input into dates", () => {
    const result = eventFormSchema.parse(valid);
    expect(result.startAt.toISOString()).toBe("2026-11-01T02:00:00.000Z");
    expect(result.endAt.toISOString()).toBe("2026-11-01T05:00:00.000Z");
  });

  it("keeps venue fields and drops the meeting link for OFFLINE", () => {
    const result = eventFormSchema.parse({
      ...valid,
      venueAddress: " Jl. Diponegoro 22 ",
      placeId: "ChIJabc_123-xyz",
      onlineUrl: "https://zoom.us/j/1",
    });
    expect(result).toMatchObject({
      locationType: "OFFLINE",
      venueName: "Aula Kampus A",
      venueAddress: "Jl. Diponegoro 22",
      placeId: "ChIJabc_123-xyz",
      onlineUrl: null,
    });
  });

  it("requires an https link for ONLINE and drops venue fields", () => {
    const base = { ...valid, locationType: "ONLINE", venueName: "Sisa", placeId: "ChIJabc_123-xyz" };
    const ok = eventFormSchema.parse({ ...base, onlineUrl: "https://meet.google.com/abc-defg-hij" });
    expect(ok).toMatchObject({ venueName: null, venueAddress: null, placeId: null, onlineUrl: "https://meet.google.com/abc-defg-hij" });

    for (const onlineUrl of ["", "http://zoom.us/j/1", "javascript:alert(1)", "zoom.us/j/1", "https://user:pw@zoom.us/j/1"]) {
      const result = eventFormSchema.safeParse({ ...base, onlineUrl });
      expect(result.success, onlineUrl).toBe(false);
      expect(result.error?.flatten().fieldErrors.onlineUrl).toBeDefined();
    }
  });

  it("requires both venue name and link for HYBRID", () => {
    const result = eventFormSchema.safeParse({ ...valid, locationType: "HYBRID", venueName: "A" });
    expect(Object.keys(result.error!.flatten().fieldErrors).sort()).toEqual(["onlineUrl", "venueName"]);
    expect(
      eventFormSchema.parse({ ...valid, locationType: "HYBRID", onlineUrl: "https://zoom.us/j/1" }),
    ).toMatchObject({ venueName: "Aula Kampus A", onlineUrl: "https://zoom.us/j/1" });
  });

  it("requires a venue name of at least 3 characters for OFFLINE", () => {
    const result = eventFormSchema.safeParse({ ...valid, venueName: "ab" });
    expect(result.error?.flatten().fieldErrors.venueName).toBeDefined();
  });

  it("rejects an unknown location type and malformed place id", () => {
    expect(eventFormSchema.safeParse({ ...valid, locationType: "MOON" }).success).toBe(false);
    expect(eventFormSchema.safeParse({ ...valid, placeId: "a b/c" }).success).toBe(false);
  });

  it("rejects end before start", () => {
    const result = eventFormSchema.safeParse({ ...valid, endAt: "2026-11-01T08:00" });
    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.endAt).toBeDefined();
  });

  it("rejects unknown timezone and missing fields", () => {
    const result = eventFormSchema.safeParse({ ...valid, timezone: "Europe/London", title: "", startAt: "" });
    expect(result.success).toBe(false);
    expect(Object.keys(result.error!.flatten().fieldErrors).sort()).toEqual(["timezone", "title"]);
  });
});

describe("validatePosterFile", () => {
  it("accepts allowed images up to 2 MB", () => {
    expect(validatePosterFile("image/webp", 2 * 1024 * 1024)).toBeNull();
  });

  it("rejects other types and oversize files", () => {
    expect(validatePosterFile("image/gif", 1000)).not.toBeNull();
    expect(validatePosterFile("image/png", 2 * 1024 * 1024 + 1)).not.toBeNull();
  });
});

describe("slug", () => {
  it("slugifies Indonesian titles", () => {
    expect(slugify("Seminar Nasional: Teknologi & Masa Depan!")).toBe("seminar-nasional-teknologi-masa-depan");
  });

  it("adds a random suffix", () => {
    expect(createEventSlug("Meetup")).toMatch(/^meetup-[0-9a-f]{6}$/);
    expect(createEventSlug("!!!")).toMatch(/^acara-[0-9a-f]{6}$/);
  });
});
