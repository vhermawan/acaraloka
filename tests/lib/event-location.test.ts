import { describe, expect, it } from "vitest";

import { locationSummary, meetingLinkForViewer, resolveEventLocation, toPublicLocation } from "@/lib/event-location";
import { mapsEmbedUrl, mapsSearchUrl } from "@/lib/maps";

const MEETING = "https://zoom.us/j/999?pwd=secret";

const hybrid = {
  locationType: "HYBRID" as const,
  venueName: "Aula A",
  venueAddress: "Jl. Mawar 1, Bandung",
  placeId: "ChIJabc_123-xyz",
  onlineUrl: MEETING,
  status: "PUBLISHED",
};

describe("toPublicLocation", () => {
  it("never carries the meeting URL", () => {
    const location = toPublicLocation(hybrid);
    expect(JSON.stringify(location)).not.toContain("zoom.us/j");
    expect(JSON.stringify(location)).not.toContain("secret");
    expect(location.onlineProvider).toEqual({ id: "zoom", label: "Zoom" });
  });

  it("hides venue fields for ONLINE and provider for OFFLINE", () => {
    expect(toPublicLocation({ ...hybrid, locationType: "ONLINE" })).toMatchObject({
      venueName: null,
      venueAddress: null,
      placeId: null,
    });
    expect(toPublicLocation({ ...hybrid, locationType: "OFFLINE" }).onlineProvider).toBeNull();
  });
});

describe("locationSummary", () => {
  it("summarises each type without the link", () => {
    expect(locationSummary(toPublicLocation({ ...hybrid, locationType: "OFFLINE" }))).toBe("Aula A, Jl. Mawar 1, Bandung");
    expect(locationSummary(toPublicLocation({ ...hybrid, locationType: "ONLINE" }))).toBe("Online via Zoom");
    expect(locationSummary(toPublicLocation(hybrid))).toBe("Aula A, Jl. Mawar 1, Bandung + Online via Zoom");
    expect(locationSummary(toPublicLocation({ ...hybrid, locationType: "ONLINE", onlineUrl: "https://example.com/x" }))).toBe("Online");
  });
});

describe("meetingLinkForViewer", () => {
  it("hides the link from anonymous and unregistered viewers", () => {
    expect(meetingLinkForViewer(hybrid, { isOrganizer: false, registrationStatus: null })).toBeNull();
  });

  it("hides the link from cancelled registrations", () => {
    expect(meetingLinkForViewer(hybrid, { isOrganizer: false, registrationStatus: "CANCELLED" })).toBeNull();
  });

  it("shows the link to confirmed registrants of a published event", () => {
    expect(meetingLinkForViewer(hybrid, { isOrganizer: false, registrationStatus: "CONFIRMED" })).toBe(MEETING);
  });

  it("hides the link from confirmed registrants once the event is cancelled or disabled", () => {
    for (const status of ["CANCELLED", "DISABLED", "DRAFT"]) {
      expect(meetingLinkForViewer({ ...hybrid, status }, { isOrganizer: false, registrationStatus: "CONFIRMED" })).toBeNull();
    }
  });

  it("shows the link to the owning organizer in any status", () => {
    expect(meetingLinkForViewer({ ...hybrid, status: "DRAFT" }, { isOrganizer: true, registrationStatus: null })).toBe(MEETING);
  });

  it("returns nothing for OFFLINE events or a missing link", () => {
    expect(meetingLinkForViewer({ ...hybrid, locationType: "OFFLINE" }, { isOrganizer: true, registrationStatus: null })).toBeNull();
    expect(meetingLinkForViewer({ ...hybrid, onlineUrl: null }, { isOrganizer: true, registrationStatus: null })).toBeNull();
  });
});

describe("maps urls", () => {
  it("builds a Maps URL with query_place_id and falls back to text only", () => {
    const withId = new URL(mapsSearchUrl({ name: "Aula A", address: "Bandung", placeId: "ChIJabc" })!);
    expect(withId.origin + withId.pathname).toBe("https://www.google.com/maps/search/");
    expect(withId.searchParams.get("api")).toBe("1");
    expect(withId.searchParams.get("query")).toBe("Aula A, Bandung");
    expect(withId.searchParams.get("query_place_id")).toBe("ChIJabc");

    const noId = new URL(mapsSearchUrl({ name: "Aula A", address: null, placeId: null })!);
    expect(noId.searchParams.has("query_place_id")).toBe(false);
    expect(mapsSearchUrl({ name: null, address: null, placeId: null })).toBeNull();
  });

  it("builds an embed URL only with both a key and a place id", () => {
    const url = new URL(mapsEmbedUrl("ChIJabc", "KEY")!);
    expect(url.origin + url.pathname).toBe("https://www.google.com/maps/embed/v1/place");
    expect(url.searchParams.get("key")).toBe("KEY");
    expect(url.searchParams.get("q")).toBe("place_id:ChIJabc");
    expect(mapsEmbedUrl("ChIJabc", undefined)).toBeNull();
    expect(mapsEmbedUrl(null, "KEY")).toBeNull();
  });
});

describe("legacy venue fallback", () => {
  const legacy = { locationType: "OFFLINE" as const, venueName: null, venueAddress: null, placeId: null, onlineUrl: null };

  it("uses the legacy venue text as the venue name when venueName is empty", () => {
    expect(toPublicLocation({ ...legacy, venue: "  Aula Lama " })).toMatchObject({ venueName: "Aula Lama" });
    expect(toPublicLocation({ ...legacy, locationType: "HYBRID", venue: "Aula Lama" })).toMatchObject({ venueName: "Aula Lama" });
    expect(locationSummary(toPublicLocation({ ...legacy, venue: "Aula Lama" }))).toBe("Aula Lama");
  });

  it("prefers venueName and ignores an empty legacy venue", () => {
    expect(toPublicLocation({ ...legacy, venueName: "Baru", venue: "Lama" }).venueName).toBe("Baru");
    expect(toPublicLocation({ ...legacy, venue: "" }).venueName).toBeNull();
  });

  it("treats a legacy https venue as an online meeting and never exposes it as a venue name", () => {
    const resolved = resolveEventLocation({ ...legacy, venue: "https://zoom.us/j/1" });
    expect(resolved).toMatchObject({ locationType: "ONLINE", venueName: null, onlineUrl: "https://zoom.us/j/1" });

    const location = toPublicLocation({ ...legacy, venue: "https://zoom.us/j/1" });
    expect(JSON.stringify(location)).not.toContain("zoom.us/j");
    expect(location.onlineProvider?.id).toBe("zoom");
    expect(
      meetingLinkForViewer(
        { ...legacy, venue: "https://zoom.us/j/1", status: "PUBLISHED" },
        { isOrganizer: false, registrationStatus: "CONFIRMED" },
      ),
    ).toBe("https://zoom.us/j/1");
    expect(
      meetingLinkForViewer({ ...legacy, venue: "https://zoom.us/j/1", status: "PUBLISHED" }, { isOrganizer: false, registrationStatus: null }),
    ).toBeNull();
  });
});
