import type { SupabaseClient } from "@supabase/supabase-js";
import type { GuestRef, JourneyStopSummary } from "@/lib/queries/journeys";

// Requests employees send from the employee portal (db/booking-requests/), waiting on an
// Internal Portal admin. Readable to admins only (RLS). Only `pending` ones are listed — an
// approved request has become a real booking / journey, which is where it shows up next.

export interface RequestEmployee {
  id: string;
  fullName: string;
  employeeCode: string;
  departmentName: string | null;
}

export interface ConferenceRequest {
  kind: "conference";
  id: string;
  roomId: string;
  roomName: string;
  roomCapacity: number | null;
  requester: RequestEmployee;
  startsAt: string;
  endsAt: string;
  seatingCount: number;
  eventName: string;
  eventDetails: string | null;
  createdAt: string;
}

export interface JourneyRequest {
  kind: "journey";
  id: string;
  requester: RequestEmployee;
  firstPickupAt: string;
  lastDropAt: string;
  routeSummary: string;
  passengerCount: number;
  notes: string | null;
  createdAt: string;
  /** Ordered origin → stops → destination, passengers resolved to names. */
  stops: JourneyStopSummary[];
  guests: GuestRef[];
}

export type BookingRequest = ConferenceRequest | JourneyRequest;

/** When the requested slot starts — both kinds sort and display by it. */
export function requestStartsAt(request: BookingRequest) {
  return request.kind === "conference" ? request.startsAt : request.firstPickupAt;
}

/** A pending request whose time has already gone can only be rejected (the server agrees). */
export function isRequestExpired(request: BookingRequest, now: number = Date.now()) {
  const end = request.kind === "conference" ? request.endsAt : request.lastDropAt;
  return new Date(end).getTime() <= now;
}

type RawEmployee = {
  id: string;
  full_name: string;
  employee_code: string;
  department: { name: string } | null;
} | null;

function toEmployee(row: RawEmployee): RequestEmployee {
  return {
    id: row?.id ?? "",
    fullName: row?.full_name ?? "Unknown employee",
    employeeCode: row?.employee_code ?? "",
    departmentName: row?.department?.name ?? null,
  };
}

const EMPLOYEE_EMBED = "id, full_name, employee_code, department:departments!employees_department_id_fkey(name)";

// Two FKs to employees on each table (requested_by, decided_by), so the embed names its constraint.
const CONFERENCE_SELECT = `
  id, room_id, starts_at, ends_at, seating_count, event_name, event_details, created_at,
  room:conference_rooms(name, capacity),
  requester:employees!conference_booking_requests_requested_by_fkey(${EMPLOYEE_EMBED})
`;

interface RawConferenceRequest {
  id: string;
  room_id: string;
  starts_at: string;
  ends_at: string;
  seating_count: number;
  event_name: string;
  event_details: string | null;
  created_at: string;
  room: { name: string; capacity: number | null } | null;
  requester: RawEmployee;
}

export async function listPendingConferenceRequests(supabase: SupabaseClient): Promise<ConferenceRequest[]> {
  const { data, error } = await supabase
    .from("conference_booking_requests")
    .select(CONFERENCE_SELECT)
    .eq("status", "pending")
    .order("starts_at");
  if (error) throw error;
  return ((data ?? []) as unknown as RawConferenceRequest[]).map((row) => ({
    kind: "conference",
    id: row.id,
    roomId: row.room_id,
    roomName: row.room?.name ?? "Unknown room",
    roomCapacity: row.room?.capacity ?? null,
    requester: toEmployee(row.requester),
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    seatingCount: row.seating_count,
    eventName: row.event_name,
    eventDetails: row.event_details,
    createdAt: row.created_at,
  }));
}

const JOURNEY_SELECT = `
  id, trip, first_pickup_at, last_drop_at, route_summary, passenger_count, notes, created_at,
  requester:employees!journey_requests_requested_by_fkey(${EMPLOYEE_EMBED})
`;

/** journey_requests.trip — see supabase/functions/_shared/bookingRequests.ts (TripGuest / TripStop). */
type TripGuest =
  | { employeeId: string; key: string; displayName?: string; employeeCode?: string }
  | { fullName: string; phone: string; key?: string };

interface RawJourneyRequest {
  id: string;
  trip: {
    guests: TripGuest[];
    stops: { sequenceNo: number; role: JourneyStopSummary["role"]; locationName: string; arrivalAt: string; pickups: string[]; drops: string[] }[];
  };
  first_pickup_at: string;
  last_drop_at: string;
  route_summary: string;
  passenger_count: number;
  notes: string | null;
  created_at: string;
  requester: RawEmployee;
}

function toJourneyRequest(row: RawJourneyRequest): JourneyRequest {
  const byKey = new Map<string, GuestRef>();
  for (const g of row.trip.guests ?? []) {
    if ("employeeId" in g) {
      byKey.set(g.key, { kind: "employee", name: g.displayName || "Employee", phone: "", employeeCode: g.employeeCode ?? "" });
    } else {
      byKey.set(g.key ?? g.phone, { kind: "guest", name: g.fullName, phone: g.phone });
    }
  }
  const resolve = (keys: string[]) => keys.map((k) => byKey.get(k)).filter((g): g is GuestRef => Boolean(g));
  const stops = [...(row.trip.stops ?? [])]
    .sort((a, b) => a.sequenceNo - b.sequenceNo)
    .map((s) => ({
      sequenceNo: s.sequenceNo,
      role: s.role,
      locationName: s.locationName,
      arrivalAt: s.arrivalAt,
      pickups: resolve(s.pickups ?? []),
      drops: resolve(s.drops ?? []),
    }));
  return {
    kind: "journey",
    id: row.id,
    requester: toEmployee(row.requester),
    firstPickupAt: row.first_pickup_at,
    lastDropAt: row.last_drop_at,
    routeSummary: row.route_summary,
    passengerCount: row.passenger_count,
    notes: row.notes,
    createdAt: row.created_at,
    stops,
    guests: [...byKey.values()],
  };
}

export async function listPendingJourneyRequests(supabase: SupabaseClient): Promise<JourneyRequest[]> {
  const { data, error } = await supabase
    .from("journey_requests")
    .select(JOURNEY_SELECT)
    .eq("status", "pending")
    .order("first_pickup_at");
  if (error) throw error;
  return ((data ?? []) as unknown as RawJourneyRequest[]).map(toJourneyRequest);
}

/**
 * For the pages that show requests beside their main content (Dashboard, Journeys,
 * Conference): a failed read logs and shows no requests rather than taking the whole page
 * down — e.g. this app deployed before db/booking-requests is applied.
 */
export function requestsOrEmpty<T>(promise: Promise<T[]>): Promise<T[]> {
  return promise.catch((err) => {
    // A warning, not console.error: this is a handled fallback, and next dev's error overlay
    // treats every console.error as a crash. PostgrestError is a plain object that logs as
    // `{}`, so print its fields.
    const { message, code, hint } = (err ?? {}) as { message?: string; code?: string; hint?: string };
    console.warn(`Couldn't load booking requests (showing none): ${message ?? String(err)}${code ? ` [${code}]` : ""}${hint ? ` — ${hint}` : ""}`);
    return [];
  });
}

/** Both kinds together, earliest requested slot first — the dashboard's list. */
export async function listPendingRequests(supabase: SupabaseClient): Promise<BookingRequest[]> {
  const [conference, journeys] = await Promise.all([listPendingConferenceRequests(supabase), listPendingJourneyRequests(supabase)]);
  return [...conference, ...journeys].sort((a, b) => requestStartsAt(a).localeCompare(requestStartsAt(b)));
}
