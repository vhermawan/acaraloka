export type MeetingProviderId = "zoom" | "meet" | "teams" | "youtube" | "link";

export type MeetingProvider = { id: MeetingProviderId; label: string };

const PROVIDERS: { id: Exclude<MeetingProviderId, "link">; label: string; hosts: string[] }[] = [
  { id: "zoom", label: "Zoom", hosts: ["zoom.us", "zoom.com", "zoomgov.com"] },
  { id: "meet", label: "Google Meet", hosts: ["meet.google.com"] },
  { id: "teams", label: "Microsoft Teams", hosts: ["teams.microsoft.com", "teams.live.com"] },
  { id: "youtube", label: "YouTube", hosts: ["youtube.com", "youtu.be"] },
];

const GENERIC: MeetingProvider = { id: "link", label: "Tautan" };

function hostMatches(hostname: string, host: string) {
  return hostname === host || hostname.endsWith(`.${host}`);
}

export function parseHttpsUrl(value: string): URL | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.username || url.password || !url.hostname.includes(".")) return null;
    return url;
  } catch {
    return null;
  }
}

export function detectMeetingProvider(value: string): MeetingProvider {
  const url = parseHttpsUrl(value);
  if (!url) return GENERIC;
  const hostname = url.hostname.toLowerCase();
  const match = PROVIDERS.find((provider) => provider.hosts.some((host) => hostMatches(hostname, host)));
  return match ? { id: match.id, label: match.label } : GENERIC;
}
