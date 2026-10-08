export function splitEventsByStart<T extends { startAt: Date }>(events: T[], now: Date = new Date()) {
  const upcoming = events
    .filter((event) => event.startAt >= now)
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  const past = events
    .filter((event) => event.startAt < now)
    .sort((a, b) => b.startAt.getTime() - a.startAt.getTime());
  return { upcoming, past };
}
