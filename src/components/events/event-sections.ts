import { ClipboardList, FileBadge, FileText, ScanLine, Tickets, Users } from "lucide-react";

const EVENT_SECTIONS = [
  { segment: "", label: "Detail", icon: FileText },
  { segment: "tickets", label: "Tiket", icon: Tickets },
  { segment: "form", label: "Formulir", icon: ClipboardList },
  { segment: "participants", label: "Peserta", icon: Users },
  { segment: "checkin", label: "Check-in", icon: ScanLine },
  { segment: "certificate", label: "Sertifikat", icon: FileBadge },
] as const;

const EVENT_PATH = /^\/organizer\/events\/(?!new(?:\/|$))([^/]+)(?:\/([^/]+))?/;

function parseEventPath(pathname: string) {
  const match = EVENT_PATH.exec(pathname);
  if (!match) return null;
  const segment = match[2] ?? "";
  const section = EVENT_SECTIONS.find((item) => item.segment === segment) ?? EVENT_SECTIONS[0];
  return { eventId: match[1], section };
}

function eventSectionHref(eventId: string, segment: string) {
  const base = `/organizer/events/${eventId}`;
  return segment ? `${base}/${segment}` : base;
}

export { EVENT_SECTIONS, eventSectionHref, parseEventPath };
