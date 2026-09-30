import type { SupabaseClient } from "@supabase/supabase-js";

// Conference module (apps/admin/internal-portal) — mirrors db/conference/ and the
// supabase/functions/conference-* Edge Functions. Every function here is Internal Portal
// admin-only; the function itself re-verifies that (supabase/functions/_shared/authz.ts).

async function invoke<T>(supabase: SupabaseClient, name: string, body: object): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(name, { body: body as Record<string, unknown> });
  if (error || !data) {
    // A non-2xx response surfaces as a generic FunctionsHttpError whose `.context` is the raw
    // Response — the function's own `{ error }` message has to be read back out of it.
    const context = (error as { context?: Response } | null)?.context;
    let message: string | null = null;
    if (context && typeof context.json === "function") {
      try {
        const parsed = await context.json();
        if (typeof parsed?.error === "string") message = parsed.error;
      } catch {
        // body wasn't JSON — fall back to the generic message below
      }
    }
    if (message) throw new Error(message);
    throw error instanceof Error ? error : new Error(`${name} returned no data`);
  }
  return data;
}

export interface CreateConferenceRoomInput {
  name: string;
  /** Seating limit; omit (or null) when not recorded. */
  capacity?: number | null;
}

/** Invokes `conference-room-create`. Throws (with the function's message) on a duplicate name. */
export function createConferenceRoom(supabase: SupabaseClient, input: CreateConferenceRoomInput) {
  return invoke<{ id: string }>(supabase, "conference-room-create", input);
}

export interface UpdateConferenceRoomInput {
  roomId: string;
  name?: string;
  /** `null` clears the limit; leave undefined to keep it. */
  capacity?: number | null;
  /** `inactive` is "remove" (a soft-delete); `active` restores. */
  status?: "active" | "inactive";
}

/**
 * Invokes `conference-room-update` — rename / re-size / remove / restore a room. Removing
 * throws (with the function's message) while the room still has unfinished confirmed bookings.
 */
export function updateConferenceRoom(supabase: SupabaseClient, input: UpdateConferenceRoomInput) {
  return invoke<{ id: string; name: string; capacity: number | null; status: "active" | "inactive" }>(
    supabase,
    "conference-room-update",
    input,
  );
}

export interface CreateConferenceBookingInput {
  roomId: string;
  /** `employees.id` — the form resolves the typed employee code to it. */
  employeeId: string;
  /** ISO timestamps; must fall within one IST calendar day. */
  startsAt: string;
  endsAt: string;
  /** Sitting arrangement — how many seats. */
  seatingCount: number;
  eventName: string;
  eventDetails?: string;
}

/**
 * Invokes `conference-booking-create`. Throws (with the function's message) if the room is
 * already booked in that window, is over capacity, has been removed, or the time has passed.
 */
export function createConferenceBooking(supabase: SupabaseClient, input: CreateConferenceBookingInput) {
  return invoke<{ id: string }>(supabase, "conference-booking-create", input);
}

export interface UpdateConferenceBookingInput {
  bookingId: string;
  startsAt: string;
  endsAt: string;
}

/**
 * Invokes `conference-booking-update` — moves a booking's window (stretch / contract on the
 * calendar). Throws (with the function's message) on an overlap with another booking.
 */
export function updateConferenceBooking(supabase: SupabaseClient, input: UpdateConferenceBookingInput) {
  return invoke<{ id: string; starts_at: string; ends_at: string }>(supabase, "conference-booking-update", input);
}

/** Invokes `conference-booking-cancel`. Throws if the booking already finished. */
export function cancelConferenceBooking(supabase: SupabaseClient, bookingId: string) {
  return invoke<{ id: string; status: "cancelled" }>(supabase, "conference-booking-cancel", { bookingId });
}
