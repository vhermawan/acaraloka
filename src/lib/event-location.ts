import { detectMeetingProvider, parseHttpsUrl, type MeetingProvider } from "@/lib/meeting-provider";

export const LOCATION_TYPES = ["OFFLINE", "ONLINE", "HYBRID"] as const;

export type LocationType = (typeof LOCATION_TYPES)[number];

export const LOCATION_TYPE_LABELS: Record<LocationType, string> = {
  OFFLINE: "Offline (tatap muka)",
  ONLINE: "Online",
  HYBRID: "Hybrid (offline dan online)",
};

export type EventLocationFields = {
  locationType: LocationType;
  venueName: string | null;
  venueAddress: string | null;
  placeId: string | null;
  onlineUrl: string | null;
  venue?: string;
};

export type PublicEventLocation = {
  locationType: LocationType;
  venueName: string | null;
  venueAddress: string | null;
  placeId: string | null;
  onlineProvider: MeetingProvider | null;
};

export function hasPhysicalVenue(type: LocationType) {
  return type === "OFFLINE" || type === "HYBRID";
}

export function hasOnlineMeeting(type: LocationType) {
  return type === "ONLINE" || type === "HYBRID";
}

export function resolveEventLocation(event: EventLocationFields): Omit<EventLocationFields, "venue"> {
  const { venue, ...fields } = event;
  const legacy = venue?.trim();
  if (!legacy || fields.venueName || fields.onlineUrl || fields.locationType === "ONLINE") return fields;
  if (parseHttpsUrl(legacy)) {
    return { locationType: "ONLINE", venueName: null, venueAddress: null, placeId: null, onlineUrl: legacy };
  }
  return { ...fields, venueName: legacy };
}

export function toPublicLocation(input: EventLocationFields): PublicEventLocation {
  const event = resolveEventLocation(input);
  return {
    locationType: event.locationType,
    venueName: hasPhysicalVenue(event.locationType) ? event.venueName : null,
    venueAddress: hasPhysicalVenue(event.locationType) ? event.venueAddress : null,
    placeId: hasPhysicalVenue(event.locationType) ? event.placeId : null,
    onlineProvider:
      hasOnlineMeeting(event.locationType) && event.onlineUrl ? detectMeetingProvider(event.onlineUrl) : null,
  };
}

export function locationSummary(location: PublicEventLocation): string {
  const parts: string[] = [];
  if (location.venueName) parts.push(location.venueAddress ? `${location.venueName}, ${location.venueAddress}` : location.venueName);
  if (location.onlineProvider) {
    parts.push(location.onlineProvider.id === "link" ? "Online" : `Online via ${location.onlineProvider.label}`);
  }
  return parts.join(" + ");
}

export type MeetingLinkViewer = {
  isOrganizer: boolean;
  registrationStatus: string | null;
};

export function meetingLinkForViewer(
  input: Pick<EventLocationFields, "locationType" | "onlineUrl" | "venueName" | "venue"> & { status: string },
  viewer: MeetingLinkViewer,
): string | null {
  const event = { ...resolveEventLocation({ venueAddress: null, placeId: null, ...input }), status: input.status };
  if (!hasOnlineMeeting(event.locationType) || !event.onlineUrl) return null;
  if (viewer.isOrganizer) return event.onlineUrl;
  if (viewer.registrationStatus === "CONFIRMED" && event.status === "PUBLISHED") return event.onlineUrl;
  return null;
}
