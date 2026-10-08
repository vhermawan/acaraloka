export const EVENT_TIMEZONES = [
  { id: "Asia/Jakarta", label: "WIB", offsetHours: 7 },
  { id: "Asia/Makassar", label: "WITA", offsetHours: 8 },
  { id: "Asia/Jayapura", label: "WIT", offsetHours: 9 },
] as const;

export type EventTimezone = (typeof EVENT_TIMEZONES)[number]["id"];

export const EVENT_TIMEZONE_IDS = EVENT_TIMEZONES.map((tz) => tz.id) as [EventTimezone, ...EventTimezone[]];

const LOCAL_INPUT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

function offsetMs(timezone: string): number {
  const tz = EVENT_TIMEZONES.find((item) => item.id === timezone) ?? EVENT_TIMEZONES[0];
  return tz.offsetHours * 60 * 60 * 1000;
}

export function timezoneLabel(timezone: string): string {
  return (EVENT_TIMEZONES.find((item) => item.id === timezone) ?? EVENT_TIMEZONES[0]).label;
}

export function localInputToDate(value: string, timezone: string): Date | null {
  const match = LOCAL_INPUT_PATTERN.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match.map(Number);
  const utc = Date.UTC(year, month - 1, day, hour, minute);
  const check = new Date(utc);
  if (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  return new Date(utc - offsetMs(timezone));
}

export function dateToLocalInput(date: Date, timezone: string): string {
  return new Date(date.getTime() + offsetMs(timezone)).toISOString().slice(0, 16);
}

export function formatEventDateTime(date: Date, timezone: string): string {
  const formatted = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  }).format(date);
  return `${formatted} ${timezoneLabel(timezone)}`;
}

export function formatEventSchedule(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("id-ID", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: timezone,
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("weekday")}, ${part("day")} ${part("month")} ${part("year")} · ${part("hour")}.${part("minute")} ${timezoneLabel(timezone)}`;
}
