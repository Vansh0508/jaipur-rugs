import type { CSSProperties } from "react";
import { MINUTES_PER_DAY, minutesOfDay } from "@/lib/conference/calendar";
import type { ConferenceBooking } from "@/lib/queries/conference";

/**
 * A booking's tint and accent edge, from its room's colour (a CSS colour / token). A pending
 * request is drawn fainter, striped and dashed — visibly "not booked yet". (Same as the
 * Internal Portal's copy.)
 */
export function eventStyle(color: string, pending = false): CSSProperties {
  if (pending) {
    return {
      background: `repeating-linear-gradient(135deg, color-mix(in oklab, ${color} 10%, var(--surface)) 0 6px, var(--surface) 6px 12px)`,
      border: `1.5px dashed ${color}`,
      borderLeft: `4px dashed ${color}`,
    };
  }
  return {
    background: `color-mix(in oklab, ${color} 18%, var(--surface))`,
    borderLeft: `4px solid ${color}`,
  };
}

/** What a block's first line says: "Booked", or "Requested — pending" for a pending request. */
export function blockTitle(booking: ConferenceBooking) {
  return booking.eventName;
}

/**
 * Never, here. The calendar views are copied from apps/admin/internal-portal, where an admin
 * can stretch a booking; on the employee portal every block is someone else's busy slot, so
 * the resize handles are switched off at this one point rather than edited out of each view.
 */
export function isResizable(_booking: ConferenceBooking, _now: number = Date.now()) {
  return false;
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
    if (other.id === booking.id || other.roomId !== booking.roomId || other.status !== "confirmed" || other.pendingRequestId) continue;
    const otherStart = minutesOfDay(other.startsAt, date);
    const otherEnd = minutesOfDay(other.endsAt, date);
    if (otherEnd <= otherStart) continue; // not on this day
    if (otherEnd <= startMin) min = Math.max(min, otherEnd);
    else if (otherStart >= endMin) max = Math.min(max, otherStart);
  }
  return { min, max };
}
