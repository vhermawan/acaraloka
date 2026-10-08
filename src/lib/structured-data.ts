type StructuredDataEvent = {
  slug: string;
  title: string;
  description: string;
  status: string;
  startAt: Date;
  endAt: Date;
  venue: string;
  publishedAt: Date | null;
  organizer: { orgName: string };
  ticketTypes: { name: string; price: number; quota: number; reservedCount: number }[];
};

export function eventStructuredData(event: StructuredDataEvent, baseUrl: string, imageUrl: string | null) {
  const pageUrl = new URL(`/e/${event.slug}`, baseUrl).toString();
  const registerUrl = new URL(`/e/${event.slug}/register`, baseUrl).toString();

  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    description: event.description.replace(/\s+/g, " ").trim(),
    url: pageUrl,
    startDate: event.startAt.toISOString(),
    endDate: event.endAt.toISOString(),
    eventStatus:
      event.status === "CANCELLED" ? "https://schema.org/EventCancelled" : "https://schema.org/EventScheduled",
    location: { "@type": "Place", name: event.venue, address: event.venue },
    ...(imageUrl ? { image: [imageUrl] } : {}),
    organizer: { "@type": "Organization", name: event.organizer.orgName },
    offers: event.ticketTypes.map((ticket) => ({
      "@type": "Offer",
      name: ticket.name,
      price: String(ticket.price),
      priceCurrency: "IDR",
      url: registerUrl,
      availability:
        ticket.quota - ticket.reservedCount > 0 ? "https://schema.org/InStock" : "https://schema.org/SoldOut",
      ...(event.publishedAt ? { validFrom: event.publishedAt.toISOString() } : {}),
    })),
  };
}

export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
