import type { Entity, StartDate, TimelineEvent } from "../../types";

export function metadataLabel(entity: Entity): string {
  const data = entity.metadata;
  if (!data) return "Anime";
  const release = data.startDate?.year ? formatStartDate(data.startDate) : null;
  return (
    [release, data.status?.replaceAll("_", " ").toLowerCase()]
      .filter(Boolean)
      .join(" · ") || "Anime"
  );
}

export function comingSoonDescription(entity: Entity): string {
  const date = entity.metadata?.startDate;
  return date?.year ? `Expected ${formatStartDate(date)}` : "No date announced";
}

export function eventLabel(
  event: Pick<TimelineEvent, "type" | "episodeNumber">,
): string {
  return event.type === "episode" && event.episodeNumber
    ? `Episode ${event.episodeNumber}`
    : capitalize(event.type);
}

export function formatEventDate(
  event: Pick<TimelineEvent, "startsAt" | "startsOn">,
): string {
  const value = event.startsAt ?? event.startsOn;
  if (!value) return "Date unavailable";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    ...(event.startsAt ? { hour: "numeric", minute: "2-digit" } : {}),
  }).format(new Date(value));
}

export function formatEventTime(
  event: Pick<TimelineEvent, "startsAt" | "startsOn">,
): string {
  if (!event.startsAt) return "All day";
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(event.startsAt));
}

export function groupByDay(
  events: TimelineEvent[],
): Array<[string, TimelineEvent[]]> {
  const groups = new Map<string, TimelineEvent[]>();
  for (const event of events) {
    const date = eventDate(event);
    const key = new Intl.DateTimeFormat("en", {
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(date);
    groups.set(key, [...(groups.get(key) ?? []), event]);
  }
  return [...groups.entries()];
}

export function nextSectionLabel(event: TimelineEvent): string {
  if (isToday(event)) return "TODAY";
  return `NEXT UP · ${new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(eventDate(event))}`;
}

export function isFutureEvent(event: TimelineEvent): boolean {
  const value = event.startsAt ?? `${event.startsOn}T23:59:59`;
  return new Date(value).getTime() >= Date.now();
}

export function isInThisCalendarWeek(event: TimelineEvent): boolean {
  const now = new Date();
  const endOfWeek = new Date(now);
  endOfWeek.setHours(23, 59, 59, 999);
  endOfWeek.setDate(now.getDate() + ((7 - now.getDay()) % 7));
  return eventDate(event) <= endOfWeek;
}

export function calendarWeekStart(offset = 0, now = new Date()): Date {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay() + offset * 7);
  return start;
}

export function calendarDays(start: Date): Date[] {
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

export function isEventOnDay(event: TimelineEvent, day: Date): boolean {
  return dateKey(eventDate(event)) === dateKey(day);
}

export function formatCalendarDay(day: Date): string {
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(day);
}

export function isTodayDate(day: Date): boolean {
  return dateKey(day) === dateKey(new Date());
}

function eventDate(event: Pick<TimelineEvent, "startsAt" | "startsOn">): Date {
  return new Date(event.startsAt ?? `${event.startsOn}T12:00:00`);
}

function dateKey(date: Date): string {
  return [date.getFullYear(), date.getMonth(), date.getDate()].join("-");
}

function isToday(event: TimelineEvent): boolean {
  const date = eventDate(event);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function formatStartDate(date: StartDate): string {
  const month = date.month ?? 1;
  const day = date.day ?? 1;
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(Date.UTC(date.year!, month - 1, day)));
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}
