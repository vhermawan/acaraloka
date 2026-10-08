import { describe, expect, it } from "vitest";

import { eventStructuredData, serializeJsonLd } from "@/lib/structured-data";

const baseEvent = {
  slug: "seminar-ai",
  title: "Seminar AI",
  description: "Belajar AI\n\n  bersama praktisi.",
  status: "PUBLISHED",
  startAt: new Date("2026-11-01T02:00:00.000Z"),
  endAt: new Date("2026-11-01T05:00:00.000Z"),
  venue: "Aula Kampus, Surabaya",
  publishedAt: new Date("2026-10-01T00:00:00.000Z"),
  organizer: { orgName: "Komunitas AI" },
  ticketTypes: [
    { name: "Umum", price: 0, quota: 100, reservedCount: 40 },
    { name: "VIP", price: 0, quota: 10, reservedCount: 10 },
  ],
};

describe("eventStructuredData", () => {
  it("builds a schema.org Event with absolute URLs", () => {
    const data = eventStructuredData(baseEvent, "https://acaraloka.com", "https://cdn.example/poster.png");

    expect(data).toMatchObject({
      "@type": "Event",
      name: "Seminar AI",
      description: "Belajar AI bersama praktisi.",
      url: "https://acaraloka.com/e/seminar-ai",
      startDate: "2026-11-01T02:00:00.000Z",
      endDate: "2026-11-01T05:00:00.000Z",
      eventStatus: "https://schema.org/EventScheduled",
      location: { "@type": "Place", name: "Aula Kampus, Surabaya", address: "Aula Kampus, Surabaya" },
      image: ["https://cdn.example/poster.png"],
      organizer: { "@type": "Organization", name: "Komunitas AI" },
    });
  });

  it("maps ticket availability and price per offer", () => {
    const { offers } = eventStructuredData(baseEvent, "https://acaraloka.com", null);

    expect(offers).toEqual([
      expect.objectContaining({
        name: "Umum",
        price: "0",
        priceCurrency: "IDR",
        url: "https://acaraloka.com/e/seminar-ai/register",
        availability: "https://schema.org/InStock",
        validFrom: "2026-10-01T00:00:00.000Z",
      }),
      expect.objectContaining({ name: "VIP", availability: "https://schema.org/SoldOut" }),
    ]);
  });

  it("marks cancelled events and omits a missing poster", () => {
    const data = eventStructuredData({ ...baseEvent, status: "CANCELLED" }, "https://acaraloka.com", null);

    expect(data.eventStatus).toBe("https://schema.org/EventCancelled");
    expect(data).not.toHaveProperty("image");
  });
});

describe("serializeJsonLd", () => {
  it("escapes angle brackets so the script tag cannot be closed early", () => {
    expect(serializeJsonLd({ name: "</script><b>" })).toBe('{"name":"\\u003c/script>\\u003cb>"}');
  });
});
