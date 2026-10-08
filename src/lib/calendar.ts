const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;
const LOCAL_DATE_TIME = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/;

export type MonthView = { year: number; month: number };

export function splitLocalDateTime(value: string): { date: string; time: string } | null {
  const match = LOCAL_DATE_TIME.exec(value);
  return match ? { date: match[1], time: match[2] } : null;
}

function keyToUtc(key: string): Date {
  const match = DATE_KEY.exec(key);
  if (!match) throw new Error(`Invalid date key: ${key}`);
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function utcToKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(key: string, days: number): string {
  const date = keyToUtc(key);
  date.setUTCDate(date.getUTCDate() + days);
  return utcToKey(date);
}

export function addMonthsToKey(key: string, months: number): string {
  const date = keyToUtc(key);
  const day = date.getUTCDate();
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return utcToKey(target);
}

export function viewOfKey(key: string): MonthView {
  const date = keyToUtc(key);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() };
}

export function shiftView(view: MonthView, months: number): MonthView {
  const date = new Date(Date.UTC(view.year, view.month + months, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() };
}

export function weekdayIndex(key: string): number {
  return (keyToUtc(key).getUTCDay() + 6) % 7;
}

export function monthGrid(view: MonthView): { key: string; inMonth: boolean }[][] {
  const first = utcToKey(new Date(Date.UTC(view.year, view.month, 1)));
  const start = addDays(first, -weekdayIndex(first));
  const weeks: { key: string; inMonth: boolean }[][] = [];
  for (let week = 0; week < 6; week += 1) {
    const days = [];
    for (let day = 0; day < 7; day += 1) {
      const key = addDays(start, week * 7 + day);
      days.push({ key, inMonth: viewOfKey(key).month === view.month });
    }
    weeks.push(days);
  }
  return weeks;
}

export function localDateKey(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    date,
  );
}

export function timeSlots(stepMinutes: number): string[] {
  const slots: string[] = [];
  for (let minutes = 0; minutes < 24 * 60; minutes += stepMinutes) {
    slots.push(`${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`);
  }
  return slots;
}

export function formatDateKey(key: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("id-ID", { ...options, timeZone: "UTC" }).format(keyToUtc(key));
}

export function formatMonthView(view: MonthView): string {
  return new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(view.year, view.month, 1)),
  );
}
