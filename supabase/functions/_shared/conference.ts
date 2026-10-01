// Shared by the conference-* write functions (conference-booking-create / -update /
// -cancel, conference-room-create / -update): request plumbing, the booking-window rules,
// and the friendly message for a double-booking. The no-double-booking guarantee itself is
// the database's (conference_bookings_room_no_overlap, db/conference/001) — this only turns
// its 23P01 into something a person can act on.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Postgres exclusion_violation — two confirmed bookings of one room overlapped. */
export const EXCLUSION_VIOLATION = "23P01";
/** Postgres unique_violation — here, a duplicate room name. */
export const UNIQUE_VIOLATION = "23505";

/** conference_rooms.description's length cap (db/conference/003). */
export const MAX_DESCRIPTION = 500;

// The fleet and offices run on India time; a booking is for one calendar day *there*.
const APP_TIME_ZONE = "Asia/Kolkata";

function istDay(date: Date) {
  return date.toLocaleDateString("en-CA", { timeZone: APP_TIME_ZONE });
}

function istTime(date: Date) {
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: APP_TIME_ZONE });
}

/** "30 Sep, 2:00 PM – 3:30 PM" in IST. */
export function formatIstRange(start: Date, end: Date) {
  const day = start.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: APP_TIME_ZONE });
  return `${day}, ${istTime(start)} – ${istTime(end)}`;
}

/**
 * How far behind "now" a start may be and still count as not yet passed — slack for clock
 * drift between the browser and the server, and for a form sent a moment after the minute it
 * starts on. Mirrored by db/booking-requests/004 (decide_conference_request).
 */
export const START_GRACE_MS = 5 * 60_000;

/** Whether `start` is already in the past (allowing START_GRACE_MS). */
export function startHasPassed(start: Date, now: number = Date.now()) {
  return start.getTime() < now - START_GRACE_MS;
}

/**
 * Validates a booking window: parseable, end after start, and within ONE IST calendar day
 * (a meeting room booking is a slot in a day, not a multi-day hold). `requireFuture`
 * additionally rejects a window that has already started — a room can't be booked (or
 * requested) for time that's begun. A resize of a meeting that's under way passes `false`
 * and checks the moved edges itself (conference-booking-update).
 */
export function parseWindow(
  startsAt: unknown,
  endsAt: unknown,
  requireFuture: boolean,
): { start: Date; end: Date } | { error: string } {
  if (typeof startsAt !== "string" || typeof endsAt !== "string") {
    return { error: "startsAt and endsAt are required" };
  }
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { error: "startsAt and endsAt must be valid timestamps" };
  }
  if (end <= start) {
    return { error: "The end time must be after the start time." };
  }
  // end is exclusive, so a booking that ends exactly at midnight is still that day's.
  if (istDay(start) !== istDay(new Date(end.getTime() - 1))) {
    return { error: "A booking must start and end on the same day." };
  }
  if (requireFuture && startHasPassed(start)) {
    return { error: "That start time has already passed — pick a time from now on." };
  }
  return { start, end };
}

/**
 * After a 23P01: look up what the requested window collided with and say so. `ignoreId`
 * is the booking being resized (it overlaps itself in the query, not in the constraint).
 */
export async function describeConflict(
  supabaseAdmin: SupabaseClient,
  roomId: string,
  start: Date,
  end: Date,
  ignoreId?: string,
): Promise<string> {
  let query = supabaseAdmin
    .from("conference_bookings")
    .select("id, event_name, starts_at, ends_at")
    .eq("room_id", roomId)
    .eq("status", "confirmed")
    .lt("starts_at", end.toISOString())
    .gt("ends_at", start.toISOString())
    .order("starts_at")
    .limit(1);
  if (ignoreId) query = query.neq("id", ignoreId);
  const { data } = await query;
  const clash = data?.[0];
  if (!clash) return "This room is already booked for that time.";
  return `This room is already booked ${formatIstRange(new Date(clash.starts_at), new Date(clash.ends_at))} for “${clash.event_name}”.`;
}
