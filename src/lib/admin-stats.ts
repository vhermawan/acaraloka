export const DB_QUOTA_BYTES = 500 * 1024 * 1024;
export const STATS_TIMEZONE = "Asia/Jakarta";
export const DAILY_BUCKETS = 30;
export const WEEKLY_BUCKETS = 12;

const DAY_MS = 24 * 60 * 60 * 1000;
const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;
const KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

export type SeriesPoint = { key: string; count: number };
export type BucketRow = { bucket: string; count: number | bigint };

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function keyFromUtcMs(ms: number) {
  const date = new Date(ms);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function utcMsFromKey(key: string) {
  const match = KEY_PATTERN.exec(key);
  if (!match) throw new Error(`Invalid bucket key: ${key}`);
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function jakartaDayKey(date: Date): string {
  return keyFromUtcMs(date.getTime() + JAKARTA_OFFSET_MS);
}

export function jakartaWeekKey(date: Date): string {
  const localMs = utcMsFromKey(jakartaDayKey(date));
  const sinceMonday = (new Date(localMs).getUTCDay() + 6) % 7;
  return keyFromUtcMs(localMs - sinceMonday * DAY_MS);
}

export function dayBucketKeys(now: Date, count = DAILY_BUCKETS): string[] {
  const today = utcMsFromKey(jakartaDayKey(now));
  return Array.from({ length: count }, (_, index) => keyFromUtcMs(today - (count - 1 - index) * DAY_MS));
}

export function weekBucketKeys(now: Date, count = WEEKLY_BUCKETS): string[] {
  const thisWeek = utcMsFromKey(jakartaWeekKey(now));
  return Array.from({ length: count }, (_, index) => keyFromUtcMs(thisWeek - (count - 1 - index) * 7 * DAY_MS));
}

export function bucketStart(key: string): Date {
  return new Date(utcMsFromKey(key) - JAKARTA_OFFSET_MS);
}

export function fillSeries(keys: string[], rows: BucketRow[]): SeriesPoint[] {
  const totals = new Map<string, number>();
  for (const row of rows) totals.set(row.bucket, (totals.get(row.bucket) ?? 0) + Number(row.count));
  return keys.map((key) => ({ key, count: totals.get(key) ?? 0 }));
}

export function seriesTotal(series: SeriesPoint[]): number {
  return series.reduce((sum, point) => sum + point.count, 0);
}

export function formatDayLabel(key: string): string {
  const date = new Date(utcMsFromKey(key));
  return `${date.getUTCDate()} ${SHORT_MONTHS[date.getUTCMonth()]}`;
}

export function formatWeekLabel(key: string): string {
  const start = new Date(utcMsFromKey(key));
  const end = new Date(utcMsFromKey(key) + 6 * DAY_MS);
  const startLabel = `${start.getUTCDate()} ${SHORT_MONTHS[start.getUTCMonth()]}`;
  const endLabel = `${end.getUTCDate()} ${SHORT_MONTHS[end.getUTCMonth()]}`;
  return `${startLabel} – ${endLabel}`;
}

export function usagePercent(used: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}
