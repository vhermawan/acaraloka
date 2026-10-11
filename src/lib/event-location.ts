import { detectMeetingProvider, type MeetingProvider } from "@/lib/meeting-provider";

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

export function toPublicLocation(event: EventLocationFields): PublicEventLocation {
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
  event: Pick<EventLocationFields, "locationType" | "onlineUrl"> & { status: string },
  viewer: MeetingLinkViewer,
): string | null {
  if (!hasOnlineMeeting(event.locationType) || !event.onlineUrl) return null;
  if (viewer.isOrganizer) return event.onlineUrl;
  if (viewer.registrationStatus === "CONFIRMED" && event.status === "PUBLISHED") return event.onlineUrl;
  return null;
}
