import type { LocationType, PublicEventLocation } from "@/lib/event-location";

type StructuredDataEvent = {
  slug: string;
  title: string;
  description: string;
  status: string;
  startAt: Date;
  endAt: Date;
  location: PublicEventLocation;
  publishedAt: Date | null;
  organizer: { orgName: string };
  ticketTypes: { name: string; price: number; quota: number; reservedCount: number }[];
};

const ATTENDANCE_MODES: Record<LocationType, string> = {
  OFFLINE: "https://schema.org/OfflineEventAttendanceMode",
  ONLINE: "https://schema.org/OnlineEventAttendanceMode",
  HYBRID: "https://schema.org/MixedEventAttendanceMode",
};

function structuredLocation(location: PublicEventLocation, pageUrl: string) {
  const place =
    location.locationType !== "ONLINE" && location.venueName
      ? { "@type": "Place", name: location.venueName, address: location.venueAddress ?? location.venueName }
      : null;
  const virtual = location.locationType !== "OFFLINE" ? { "@type": "VirtualLocation", url: pageUrl } : null;
  const parts = [place, virtual].filter((part) => part !== null);
  return parts.length === 1 ? parts[0] : parts;
}

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
    eventAttendanceMode: ATTENDANCE_MODES[event.location.locationType],
    location: structuredLocation(event.location, pageUrl),
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
