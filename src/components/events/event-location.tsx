import { ExternalLink, MapPin } from "lucide-react";

import { MeetingProviderIcon } from "@/components/events/meeting-provider-icon";
import { Button } from "@/components/ui/button";
import { hasOnlineMeeting, hasPhysicalVenue, type PublicEventLocation } from "@/lib/event-location";
import { mapsEmbedUrl, mapsSearchUrl } from "@/lib/maps";

type EventLocationProps = {
  location: PublicEventLocation;
  eventTitle: string;
  meetingUrl: string | null;
  embedKey: string | undefined;
};

function EventLocation({ location, eventTitle, meetingUrl, embedKey }: EventLocationProps) {
  const venue = hasPhysicalVenue(location.locationType) && location.venueName ? location : null;
  const provider = hasOnlineMeeting(location.locationType) ? location.onlineProvider : null;
  const mapsUrl = venue ? mapsSearchUrl({ name: venue.venueName, address: venue.venueAddress, placeId: venue.placeId }) : null;
  const embedUrl = venue ? mapsEmbedUrl(venue.placeId, embedKey) : null;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {venue ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-2">
            <MapPin aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="font-medium wrap-break-word">{venue.venueName}</p>
              {venue.venueAddress ? <p className="text-muted-foreground wrap-break-word">{venue.venueAddress}</p> : null}
            </div>
          </div>
          {mapsUrl ? (
            <Button
              variant="outline"
              size="sm"
              className="w-fit gap-1.5"
              nativeButton={false}
              render={<a href={mapsUrl} target="_blank" rel="noopener noreferrer" />}
            >
              <ExternalLink aria-hidden="true" />
              Buka di Google Maps
              <span className="sr-only">(tab baru)</span>
            </Button>
          ) : null}
          {embedUrl ? (
            <iframe
              src={embedUrl}
              title={`Peta lokasi ${venue.venueName} untuk ${eventTitle}`}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
              className="h-56 w-full rounded-lg border border-border"
            />
          ) : null}
        </div>
      ) : null}
      {provider ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <MeetingProviderIcon provider={provider.id} />
            <span className="font-medium">{provider.id === "link" ? "Online" : `Online via ${provider.label}`}</span>
          </div>
          {meetingUrl ? (
            <Button
              size="sm"
              className="w-fit gap-1.5"
              nativeButton={false}
              render={<a href={meetingUrl} target="_blank" rel="noopener noreferrer" />}
            >
              <ExternalLink aria-hidden="true" />
              Buka tautan meeting
              <span className="sr-only">(tab baru)</span>
            </Button>
          ) : (
            <p className="text-muted-foreground">Tautan meeting dibagikan kepada peserta yang sudah terdaftar.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

export { EventLocation };
