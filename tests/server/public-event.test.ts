import { describe, expect, it, vi } from "vitest";

const findUnique = vi.hoisted(() => vi.fn());

vi.mock("@/server/db", () => ({ prisma: { event: { findUnique } } }));
vi.mock("react", async (importOriginal) => ({ ...(await importOriginal<typeof import("react")>()), cache: <T,>(fn: T) => fn }));

const { getPublicEvent } = await import("@/server/public-event");

const row = {
  id: "e1",
  slug: "s",
  status: "PUBLISHED",
  locationType: "HYBRID",
  venueName: "Aula A",
  venueAddress: "Bandung",
  placeId: "ChIJabc",
  onlineUrl: "https://zoom.us/j/999?pwd=secret",
  organizer: { orgName: "Org" },
  ticketTypes: [],
};

describe("getPublicEvent", () => {
  it("strips the meeting URL and exposes only the provider", async () => {
    findUnique.mockResolvedValue(row);

    const event = await getPublicEvent("s");

    expect(event).not.toHaveProperty("onlineUrl");
    expect(JSON.stringify(event)).not.toContain("zoom.us/j");
    expect(event?.location.onlineProvider).toEqual({ id: "zoom", label: "Zoom" });
  });

  it("returns nothing for non-public events", async () => {
    findUnique.mockResolvedValue({ ...row, status: "DRAFT" });

    await expect(getPublicEvent("s")).resolves.toBeNull();
  });
});
