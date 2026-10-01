// Shared by the booking-request functions (employee-lookup-by-code, conference-availability,
// conference-request-create / -decide, journey-request-create / -decide) — see
// db/booking-requests/booking-requests-schema.mmd.
//
// The create / lookup / availability functions are called by the employee portal, which has
// NO session (product decision: no login). They run with verify_jwt = false, so everything a
// caller sends is untrusted: every id is re-checked here, strings are length-capped, and what
// they return is the minimum the page needs (no phone numbers, no names on other people's
// bookings). Nothing they write is live until an Internal Portal admin approves it.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const E164 = /^\+[1-9]\d{6,14}$/;

/** How many undecided, not-yet-over requests one employee code can have open per kind. */
export const MAX_OPEN_REQUESTS_PER_EMPLOYEE = 10;

export interface PublicEmployee {
  id: string;
  fullName: string;
  employeeCode: string;
  departmentName: string | null;
}

/**
 * One ACTIVE employee by exact employee code (case-insensitive), or null. An inactive code
 * and an unknown one both come back null, so the public lookup can't tell anyone which codes
 * belong to people who have left.
 */
export async function findActiveEmployeeByCode(supabaseAdmin: SupabaseClient, code: unknown): Promise<PublicEmployee | null> {
  if (typeof code !== "string") return null;
  const trimmed = code.trim();
  if (!trimmed || trimmed.length > 40) return null;
  // ilike without wildcards = case-insensitive equality; escape the ones a code could contain.
  const exact = trimmed.replace(/[\\%_]/g, "\\$&");
  const { data, error } = await supabaseAdmin
    .from("employees")
    .select("id, full_name, employee_code, status, department:departments!employees_department_id_fkey(name)")
    .ilike("employee_code", exact)
    .eq("status", "active")
    .limit(1);
  if (error) throw new Error(error.message);
  // PostgREST embeds aren't typed without the generated Database type — narrow via unknown.
  const row = (data ?? [])[0] as unknown as
    | { id: string; full_name: string; employee_code: string; department: { name: string } | null }
    | undefined;
  if (!row) return null;
  return { id: row.id, fullName: row.full_name, employeeCode: row.employee_code, departmentName: row.department?.name ?? null };
}

export function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

// ── Journey trip validation ──────────────────────────────────────────────────────────────

interface TripGuestInput {
  employeeId?: unknown;
  fullName?: unknown;
  phone?: unknown;
  key?: unknown;
}

interface TripStopInput {
  sequenceNo?: unknown;
  role?: unknown;
  locationName?: unknown;
  arrivalAt?: unknown;
  pickups?: unknown;
  drops?: unknown;
}

/** A passenger as stored in journey_requests.trip — create_journey's shape, plus display fields it ignores. */
export type TripGuest =
  | { employeeId: string; key: string; displayName: string; employeeCode: string }
  | { fullName: string; phone: string; key: string };

export interface TripStop {
  sequenceNo: number;
  role: "origin" | "stop" | "destination";
  locationName: string;
  arrivalAt: string;
  pickups: string[];
  drops: string[];
}

export interface ValidTrip {
  guests: TripGuest[];
  stops: TripStop[];
  firstPickupAt: string;
  lastDropAt: string;
  routeSummary: string;
}

const MAX_GUESTS = 30;
const MAX_STOPS = 20;

function stringList(value: unknown): string[] | null {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.some((v) => typeof v !== "string")) return null;
  return value as string[];
}

/**
 * Validates an untrusted { guests, stops } trip into create_journey's payload shape.
 * Guests can't reference an existing `guests` row (no guestId — an anonymous caller mustn't
 * be able to rename someone else's guest record); they're matched-or-created by phone when an
 * admin approves. Employee passengers are checked to be active and get their name attached
 * for the admin's review screen.
 */
export async function validateTrip(
  supabaseAdmin: SupabaseClient,
  rawGuests: unknown,
  rawStops: unknown,
): Promise<{ trip: ValidTrip } | { error: string }> {
  if (!Array.isArray(rawGuests) || rawGuests.length === 0) return { error: "Add at least one passenger." };
  if (rawGuests.length > MAX_GUESTS) return { error: `A journey request can have at most ${MAX_GUESTS} passengers.` };
  if (!Array.isArray(rawStops) || rawStops.length < 2) return { error: "The route needs a start point and a destination." };
  if (rawStops.length > MAX_STOPS) return { error: `A journey request can have at most ${MAX_STOPS} stops.` };

  const keys = new Set<string>();
  const employeeIds: string[] = [];
  const guests: TripGuest[] = [];
  for (const raw of rawGuests as TripGuestInput[]) {
    if (!raw || typeof raw !== "object") return { error: "Every passenger needs details." };
    if (raw.employeeId !== undefined) {
      if (typeof raw.employeeId !== "string" || !UUID_PATTERN.test(raw.employeeId)) return { error: "An employee passenger is invalid." };
      const key = `employee:${raw.employeeId}`;
      if (keys.has(key)) return { error: "The same employee is on the journey twice." };
      keys.add(key);
      employeeIds.push(raw.employeeId);
      guests.push({ employeeId: raw.employeeId, key, displayName: "", employeeCode: "" });
    } else {
      const fullName = cleanText(raw.fullName, 120);
      const phone = typeof raw.phone === "string" ? raw.phone.trim() : "";
      if (!fullName || !phone) return { error: "Every guest needs a name and a phone number." };
      if (!E164.test(phone)) return { error: `${fullName}'s phone number isn't valid.` };
      if (keys.has(phone)) return { error: "Two guests have the same phone number." };
      keys.add(phone);
      guests.push({ fullName, phone, key: phone });
    }
  }

  if (employeeIds.length > 0) {
    const { data, error } = await supabaseAdmin
      .from("employees")
      .select("id, full_name, employee_code")
      .in("id", employeeIds)
      .eq("status", "active");
    if (error) throw new Error(error.message);
    const byId = new Map((data ?? []).map((e) => [e.id as string, e as { id: string; full_name: string; employee_code: string }]));
    for (const g of guests) {
      if (!("employeeId" in g)) continue;
      const found = byId.get(g.employeeId);
      if (!found) return { error: "An employee passenger isn't an active employee." };
      g.displayName = found.full_name;
      g.employeeCode = found.employee_code;
    }
  }

  const stops: TripStop[] = [];
  for (const raw of rawStops as TripStopInput[]) {
    if (!raw || typeof raw !== "object") return { error: "Every stop needs details." };
    const sequenceNo = raw.sequenceNo;
    const role = raw.role;
    const locationName = cleanText(raw.locationName, 200);
    const pickups = stringList(raw.pickups);
    const drops = stringList(raw.drops);
    if (typeof sequenceNo !== "number" || !Number.isInteger(sequenceNo)) return { error: "A stop is out of order." };
    if (role !== "origin" && role !== "stop" && role !== "destination") return { error: "A stop has an unknown role." };
    if (!locationName) return { error: "Every stop needs a location." };
    if (typeof raw.arrivalAt !== "string" || Number.isNaN(new Date(raw.arrivalAt).getTime())) return { error: `"${locationName}" needs a time.` };
    if (!pickups || !drops) return { error: `"${locationName}" has an invalid passenger list.` };
    stops.push({ sequenceNo, role, locationName, arrivalAt: new Date(raw.arrivalAt).toISOString(), pickups, drops });
  }
  stops.sort((a, b) => a.sequenceNo - b.sequenceNo);

  for (let i = 0; i < stops.length; i++) {
    if (stops[i]!.sequenceNo !== i) return { error: "The stops are out of order." };
  }
  const last = stops.length - 1;
  if (stops[0]!.role !== "origin" || stops.filter((s) => s.role === "origin").length !== 1) return { error: "The route needs exactly one start point, first." };
  if (stops[last]!.role !== "destination" || stops.filter((s) => s.role === "destination").length !== 1) {
    return { error: "The route needs exactly one destination, last." };
  }
  if (stops[0]!.drops.length > 0) return { error: "Nobody can be dropped off at the start point." };
  if (stops[last]!.pickups.length > 0) return { error: "Nobody can be picked up at the destination." };
  for (let i = 1; i < stops.length; i++) {
    if (new Date(stops[i]!.arrivalAt) < new Date(stops[i - 1]!.arrivalAt)) {
      return { error: `"${stops[i]!.locationName}" is scheduled before the stop ahead of it.` };
    }
  }

  // Each passenger is picked up once, then dropped once, later on the route.
  const pickedAt = new Map<string, number>();
  const droppedAt = new Map<string, number>();
  stops.forEach((stop, index) => {
    stop.pickups.forEach((key) => pickedAt.set(key, pickedAt.has(key) ? -1 : index));
    stop.drops.forEach((key) => droppedAt.set(key, droppedAt.has(key) ? -1 : index));
  });
  for (const key of [...pickedAt.keys(), ...droppedAt.keys()]) {
    if (!keys.has(key)) return { error: "A stop refers to a passenger who isn't on the journey." };
  }
  for (const [key, at] of pickedAt) {
    const drop = droppedAt.get(key);
    if (at === -1 || drop === -1) return { error: "A passenger is picked up or dropped off more than once." };
    if (drop === undefined || drop <= at) return { error: "Every passenger picked up has to be dropped off later on the route." };
  }
  if (pickedAt.size === 0) return { error: "Pick up at least one passenger along the route." };
  for (const key of droppedAt.keys()) {
    if (!pickedAt.has(key)) return { error: "A passenger is dropped off without being picked up." };
  }

  // Same definition as create_journey: first stop with a pickup → last stop with a drop.
  const firstPickupAt = stops.filter((s) => s.pickups.length > 0).map((s) => s.arrivalAt).sort()[0]!;
  const lastDropAt = stops.filter((s) => s.drops.length > 0).map((s) => s.arrivalAt).sort().reverse()[0]!;
  if (new Date(lastDropAt) <= new Date(firstPickupAt)) return { error: "The last drop-off has to be after the first pickup." };

  return {
    trip: {
      guests,
      stops,
      firstPickupAt,
      lastDropAt,
      routeSummary: stops.map((s) => s.locationName).join(" → ").slice(0, 1000),
    },
  };
}

// ── Decision errors ──────────────────────────────────────────────────────────────────────

/** Turns decide_*_request's `request_<reason>` exceptions into something an admin can act on. */
export function describeDecisionError(message: string): { status: number; error: string } | null {
  if (message.includes("request_not_found")) return { status: 404, error: "That request no longer exists." };
  const decided = message.match(/request_already_decided:(\w+)/);
  if (decided) return { status: 409, error: `This request has already been ${decided[1]}.` };
  if (message.includes("request_time_passed")) return { status: 409, error: "The requested time has already passed — this request can only be rejected now." };
  if (message.includes("request_employee_inactive")) return { status: 409, error: "The employee who asked is no longer active." };
  if (message.includes("request_room_removed")) return { status: 409, error: "That room has been removed, so it can't be booked." };
  const capacity = message.match(/request_over_capacity:(\d+)/);
  if (capacity) return { status: 409, error: `The room only seats ${capacity[1]} — more seats were asked for.` };
  if (message.includes("request_assignment_required")) return { status: 400, error: "Choose a car and a driver to approve this journey." };
  if (message.includes("request_decision_invalid")) return { status: 400, error: "decision must be approved or rejected." };
  if (/employee .* not found or not active/.test(message)) return { status: 409, error: "An employee passenger on this journey is no longer active." };
  return null;
}
