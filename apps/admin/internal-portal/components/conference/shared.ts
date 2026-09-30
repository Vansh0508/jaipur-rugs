import type { CSSProperties } from "react";
import { MINUTES_PER_DAY, minutesOfDay } from "@/lib/conference/calendar";
import type { ConferenceBooking } from "@/lib/queries/conference";

/** A booking's tint and accent edge, from its room's colour (a CSS colour / token). */
export function eventStyle(color: string): CSSProperties {
  return {
    background: `color-mix(in oklab, ${color} 18%, var(--surface))`,
    borderLeft: `4px solid ${color}`,
  };
}

/** Only a confirmed booking that hasn't finished can be stretched or contracted (the server agrees). */
export function isResizable(booking: ConferenceBooking, now: number = Date.now()) {
  return booking.status === "confirmed" && new Date(booking.endsAt).getTime() > now;
}

/**
 * How far a booking's edges can move on `date` before running into another booking in the
 * same room (or the day's edge): `min` is where the previous one ends, `max` where the next
 * one starts. Everything in minutes past midnight IST.
 */
export function neighbourLimits(booking: ConferenceBooking, all: ConferenceBooking[], date: string, startMin: number, endMin: number) {
  let min = 0;
  let max = MINUTES_PER_DAY;
  for (const other of all) {
    if (other.id === booking.id || other.roomId !== booking.roomId || other.status !== "confirmed") continue;
    const otherStart = minutesOfDay(other.startsAt, date);
    const otherEnd = minutesOfDay(other.endsAt, date);
    if (otherEnd <= otherStart) continue; // not on this day
    if (otherEnd <= startMin) min = Math.max(min, otherEnd);
    else if (otherStart >= endMin) max = Math.min(max, otherStart);
  }
  return { min, max };
}
