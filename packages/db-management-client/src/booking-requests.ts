import type { SupabaseClient } from "@supabase/supabase-js";

// Booking-requests module — mirrors db/booking-requests/ and its Edge Functions.
//
// Two audiences:
// - apps/admin/employee-portal (NO login): lookupEmployeeByCode, getConferenceAvailability,
//   requestConferenceBooking, requestJourney. Pass it a session-less client (publishable key
//   only) — these functions run with verify_jwt = false and ignore any session anyway.
// - apps/admin/internal-portal (admins): decideConferenceRequest, decideJourneyRequest — the
//   function re-verifies the caller is an Internal Portal admin.

async function invoke<T>(supabase: SupabaseClient, name: string, body: object): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(name, { body: body as Record<string, unknown> });
  if (error || !data) {
    // A non-2xx response is a FunctionsHttpError whose `.context` is the raw Response — the
    // function's own `{ error }` message is read back out of it (same as ./conference.ts).
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

export interface PublicEmployee {
  id: string;
  fullName: string;
  employeeCode: string;
  departmentName: string | null;
}

/**
 * Invokes `employee-lookup-by-code` — one ACTIVE employee by exact employee code. Resolves to
 * null for an unknown or inactive code (the function's 404); throws on anything else.
 */
export async function lookupEmployeeByCode(supabase: SupabaseClient, employeeCode: string): Promise<PublicEmployee | null> {
  const { data, error } = await supabase.functions.invoke<{ employee: PublicEmployee }>("employee-lookup-by-code", {
    body: { employeeCode },
  });
  if (data?.employee) return data.employee;
  const status = (error as { context?: Response } | null)?.context?.status;
  if (status === 404) return null;
  throw error instanceof Error ? error : new Error("employee-lookup-by-code returned no data");
}

export interface ConferenceAvailability {
  rooms: { id: string; name: string; capacity: number | null }[];
  /** Confirmed bookings as bare time ranges — no names or details. */
  busy: { roomId: string; startsAt: string; endsAt: string }[];
}

/** Invokes `conference-availability` for [from, to) (ISO timestamps, at most 62 days apart). */
export function getConferenceAvailability(supabase: SupabaseClient, from: string, to: string) {
  return invoke<ConferenceAvailability>(supabase, "conference-availability", { from, to });
}

export interface RequestConferenceBookingInput {
  /** The requesting employee's own employee code. */
  employeeCode: string;
  roomId: string;
  /** ISO timestamps within one IST day. */
  startsAt: string;
  endsAt: string;
  seatingCount: number;
  eventName: string;
  eventDetails?: string;
}

/** Invokes `conference-request-create` — a pending request, not a booking. Throws with the reason on a clash etc. */
export function requestConferenceBooking(supabase: SupabaseClient, input: RequestConferenceBookingInput) {
  return invoke<{ id: string }>(supabase, "conference-request-create", input);
}

/** A passenger on a journey request: an employee (by id, found via lookupEmployeeByCode) or a guest. */
export type JourneyRequestGuestInput = { employeeId: string } | { fullName: string; phone: string };

export interface JourneyRequestStopInput {
  sequenceNo: number;
  role: "origin" | "stop" | "destination";
  locationName: string;
  arrivalAt: string;
  /** Passenger keys: a guest's phone, or "employee:<id>". */
  pickups: string[];
  drops: string[];
}

export interface RequestJourneyInput {
  employeeCode: string;
  guests: JourneyRequestGuestInput[];
  stops: JourneyRequestStopInput[];
  notes?: string;
}

/** Invokes `journey-request-create` — a pending request; the admin assigns the car and driver. */
export function requestJourney(supabase: SupabaseClient, input: RequestJourneyInput) {
  return invoke<{ id: string }>(supabase, "journey-request-create", input);
}

export interface DecideConferenceRequestInput {
  requestId: string;
  decision: "approved" | "rejected";
  note?: string;
}

/** Invokes `conference-request-decide`. Approving throws (with the reason) on a clash, capacity, removed room... */
export function decideConferenceRequest(supabase: SupabaseClient, input: DecideConferenceRequestInput) {
  return invoke<{ decision: "approved" | "rejected"; bookingId: string | null }>(supabase, "conference-request-decide", input);
}

export interface DecideJourneyRequestInput {
  requestId: string;
  decision: "approved" | "rejected";
  note?: string;
  /** Required when approving. */
  vehicleId?: string;
  driverId?: string;
}

/** Invokes `journey-request-decide`. Approving throws (with the reason) if the car or driver is taken then. */
export function decideJourneyRequest(supabase: SupabaseClient, input: DecideJourneyRequestInput) {
  return invoke<{ decision: "approved" | "rejected"; journeyId: string | null }>(supabase, "journey-request-decide", input);
}
