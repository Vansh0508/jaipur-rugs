import type { SketchAssignment } from "./types";

const DAY_MS = 86_400_000;

function dateMs(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Use a date in YYYY-MM-DD format.");
  const ms = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== value) {
    throw new Error("Invalid work date.");
  }
  return ms;
}

export function todayInIndia(): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const value = (kind: string) => parts.find((part) => part.type === kind)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function nextDate(value: string): string {
  return new Date(dateMs(value) + DAY_MS).toISOString().slice(0, 10);
}

// An assignment owns [startedOn, endedOn). Sunday and recorded leave dates earn no credit.
export function countWorkdays(startedOn: string, endedOn: string, excludedDates: string[] = []): number {
  const start = dateMs(startedOn);
  const end = dateMs(endedOn);
  if (end < start) throw new Error("The end date cannot be before the start date.");
  const excluded = new Set(excludedDates);
  let days = 0;
  for (let day = start; day < end; day += DAY_MS) {
    const date = new Date(day);
    if (date.getUTCDay() !== 0 && !excluded.has(date.toISOString().slice(0, 10))) days += 1;
  }
  return days;
}

export function assignmentWorkdays(assignment: SketchAssignment, today = todayInIndia()): number {
  if (!assignment.startedOn) return 0;
  return countWorkdays(assignment.startedOn, assignment.endedOn ?? nextDate(today), assignment.excludedDates);
}
