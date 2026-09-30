// Pure date + layout helpers behind the conference calendar. Dates are plain `yyyy-mm-dd`
// strings on the IST calendar (APP_TIME_ZONE) — never `Date` objects in the browser's
// zone, which would put a late-evening booking on the wrong day for anyone not in India.
// India has no daylight saving, so "a day in IST" is always exactly 24 × 60 minutes from
// the same fixed +05:30 offset, which keeps every conversion below plain arithmetic.

import { APP_TIME_ZONE, todayInAppZone } from "@/lib/format";

export const CONFERENCE_VIEWS = ["day", "week", "month", "timeline"] as const;
export type ConferenceView = (typeof CONFERENCE_VIEWS)[number];

export const MINUTES_PER_DAY = 1440;
/** Bookings snap to this many minutes when created by click or stretched by drag. */
export const SNAP_MINUTES = 15;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseConferenceView(value: string | undefined): ConferenceView {
  return (CONFERENCE_VIEWS as readonly string[]).includes(value ?? "") ? (value as ConferenceView) : "week";
}

/** A valid yyyy-mm-dd, else today (IST). */
export function parseDateParam(value: string | undefined): string {
  if (value && DATE_RE.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`))) return value;
  return todayInAppZone();
}

// A calendar date as a UTC-noon Date: noon keeps it on the same calendar day under any
// offset, and getUTC* then reads it back without the local zone interfering.
function toDate(date: string) {
  return new Date(`${date}T12:00:00Z`);
}
function fromDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number) {
  const d = toDate(date);
  d.setUTCDate(d.getUTCDate() + days);
  return fromDate(d);
}

/** 0 = Monday … 6 = Sunday (the office week starts on Monday). */
function weekdayIndex(date: string) {
  return (toDate(date).getUTCDay() + 6) % 7;
}

export function startOfWeek(date: string) {
  return addDays(date, -weekdayIndex(date));
}

export function weekDates(date: string) {
  const first = startOfWeek(date);
  return Array.from({ length: 7 }, (_, i) => addDays(first, i));
}

/** Every date on the month's grid: whole Monday-first weeks covering the month. */
export function monthGridDates(date: string) {
  const d = toDate(date);
  const first = fromDate(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 12)));
  const last = fromDate(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 12)));
  const start = startOfWeek(first);
  const end = addDays(startOfWeek(last), 6);
  const dates: string[] = [];
  for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) dates.push(cursor);
  return dates;
}

/** The dates a view shows, first to last inclusive. Timeline is one day, rooms down the side. */
export function visibleRange(view: ConferenceView, date: string): { from: string; to: string } {
  if (view === "week") {
    const days = weekDates(date);
    return { from: days[0]!, to: days[6]! };
  }
  if (view === "month") {
    const days = monthGridDates(date);
    return { from: days[0]!, to: days[days.length - 1]! };
  }
  return { from: date, to: date };
}

/** The date one step (day / week / month) before or after `date`, for the ‹ › buttons. */
export function shiftDate(view: ConferenceView, date: string, direction: -1 | 1) {
  if (view === "week") return addDays(date, 7 * direction);
  if (view === "month") {
    const d = toDate(date);
    const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + direction, 1, 12));
    const daysInTarget = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0, 12)).getUTCDate();
    target.setUTCDate(Math.min(d.getUTCDate(), daysInTarget));
    return fromDate(target);
  }
  return addDays(date, direction);
}

export function isToday(date: string) {
  return date === todayInAppZone();
}

// --- instants <-> minutes of an IST day ---------------------------------------------------

/** The instant (ms since epoch) that is `minutes` past midnight IST on `date`. */
export function istInstantMs(date: string, minutes: number) {
  return Date.parse(`${date}T00:00:00+05:30`) + minutes * 60_000;
}

/** The IST calendar date an instant falls on. */
export function istDateOf(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: APP_TIME_ZONE });
}

/** Minutes past midnight IST on `date` for an instant, clamped to that day (0..1440). */
export function minutesOfDay(iso: string, date: string) {
  const minutes = (Date.parse(iso) - istInstantMs(date, 0)) / 60_000;
  return Math.min(MINUTES_PER_DAY, Math.max(0, Math.round(minutes)));
}

export function snap(minutes: number, step = SNAP_MINUTES) {
  return Math.round(minutes / step) * step;
}

/** 570 → "9:30 AM"; 1440 → "12:00 AM" (end of day). */
export function formatMinutes(minutes: number) {
  const m = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hour = Math.floor(m / 60);
  const minute = m % 60;
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${String(minute).padStart(2, "0")} ${suffix}`;
}

/** 570 → "09:30" — the TimeInput's value format. */
export function toTimeValue(minutes: number) {
  const m = Math.min(MINUTES_PER_DAY - 1, Math.max(0, minutes));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** "09:30" → 570. */
export function fromTimeValue(value: string) {
  const [h, m] = value.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

// --- labels -------------------------------------------------------------------------------

// Fixed English names, not Intl: these render on the server (Node's ICU) and again in the
// browser, and their locale data disagrees on small things (Node prints "Sept" where Chrome
// prints "Sep"), which shows up as a hydration mismatch. The names never change, so a table is
// both simpler and identical everywhere.
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function parts(date: string) {
  const d = toDate(date);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth(), day: d.getUTCDate(), weekday: d.getUTCDay() };
}

const short = (name: string) => name.slice(0, 3);

export function rangeLabel(view: ConferenceView, date: string) {
  if (view === "month") {
    const { month, year } = parts(date);
    return `${MONTHS[month]} ${year}`;
  }
  if (view === "week") {
    const days = weekDates(date);
    const first = parts(days[0]!);
    const last = parts(days[6]!);
    const from = first.month === last.month && first.year === last.year ? `${first.day}` : `${first.day} ${short(MONTHS[first.month]!)}`;
    return `${from} – ${last.day} ${short(MONTHS[last.month]!)} ${last.year}`;
  }
  const { weekday, day, month, year } = parts(date);
  return `${WEEKDAYS[weekday]}, ${day} ${MONTHS[month]} ${year}`;
}

/** Column header parts for a date: "Wed" and "30". */
export function dayHeader(date: string) {
  const { weekday, day } = parts(date);
  return { weekday: short(WEEKDAYS[weekday]!), day: String(day) };
}

// --- overlap layout -----------------------------------------------------------------------

/**
 * Side-by-side lanes for events that overlap in time (two rooms booked at once, in the
 * day/week grid): overlapping events are grouped into clusters, and within a cluster each
 * event takes the first lane that's free when it starts. `lanes` is the cluster's width in
 * lanes, so every event in a cluster is drawn `1/lanes` wide and they line up.
 */
export function layoutLanes<T extends { startMin: number; endMin: number }>(items: T[]): (T & { lane: number; lanes: number })[] {
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);
  const result: (T & { lane: number; lanes: number })[] = [];
  let cluster: (T & { lane: number; lanes: number })[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -1;

  const flush = () => {
    for (const item of cluster) item.lanes = laneEnds.length;
    result.push(...cluster);
    cluster = [];
    laneEnds = [];
  };

  for (const item of sorted) {
    if (cluster.length > 0 && item.startMin >= clusterEnd) flush();
    let lane = laneEnds.findIndex((end) => end <= item.startMin);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(item.endMin);
    } else {
      laneEnds[lane] = item.endMin;
    }
    cluster.push({ ...item, lane, lanes: 1 });
    clusterEnd = Math.max(clusterEnd, item.endMin);
  }
  flush();
  return result;
}

// --- room colours -------------------------------------------------------------------------

// Hero UI status tokens first (they follow the theme), then fixed hues once those run out.
const ROOM_COLORS = [
  "var(--accent)",
  "var(--success)",
  "var(--warning)",
  "var(--danger)",
  "oklch(0.62 0.18 300)",
  "oklch(0.66 0.12 200)",
  "oklch(0.64 0.17 20)",
  "oklch(0.6 0.1 150)",
];

/** A stable colour per room id: the room's position in the (name-ordered) room list. */
export function roomColorMap(rooms: { id: string }[]) {
  return new Map(rooms.map((room, index) => [room.id, ROOM_COLORS[index % ROOM_COLORS.length]!]));
}
