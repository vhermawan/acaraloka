const EVENT_ID = "[A-Za-z0-9_-]+";

export function aiResultPath(eventId: string, generationId: string): string {
  return `events/${eventId}/cert-${generationId}.jpg`;
}

export function aiThumbPath(eventId: string, generationId: string): string {
  return `events/${eventId}/cert-${generationId}-thumb.jpg`;
}

export function aiLogoPath(eventId: string, hex: string): string {
  return `events/${eventId}/logo-${hex}.png`;
}

export function aiRawLogoPath(eventId: string, hex: string, extension: "png" | "jpg"): string {
  return `events/${eventId}/upload-${hex}.${extension}`;
}

const LOGO_PATTERN = new RegExp(`^events/(${EVENT_ID})/logo-[0-9a-f]{16}\\.png$`);
const RAW_LOGO_PATTERN = new RegExp(`^events/(${EVENT_ID})/upload-[0-9a-f]{16}\\.(png|jpg)$`);

export function isAiLogoPathFor(eventId: string, path: string): boolean {
  return LOGO_PATTERN.exec(path)?.[1] === eventId;
}

export function isAiRawLogoPathFor(eventId: string, path: string): boolean {
  return RAW_LOGO_PATTERN.exec(path)?.[1] === eventId;
}

export function resultPathsFor(eventId: string, generationId: string): [string, string] {
  return [aiResultPath(eventId, generationId), aiThumbPath(eventId, generationId)];
}
