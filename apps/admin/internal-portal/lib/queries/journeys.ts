import type { SupabaseClient } from "@supabase/supabase-js";
import { effectiveJourneyStatus, type JourneyStatus } from "@/lib/journeyStatus";
import { todayInAppZone } from "@/lib/format";

/** A journey passenger — a guest, or an employee (db/journeys/011). */
export interface GuestRef {
  kind: "guest" | "employee";
  name: string;
  /** "" when an employee has no phone on file (most don't). */
  phone: string;
  /** Employees only. */
  employeeCode?: string;
}

export interface JourneyStopSummary {
  sequenceNo: number;
  role: "origin" | "stop" | "destination";
  locationName: string;
  arrivalAt: string;
  pickups: GuestRef[];
  drops: GuestRef[];
}

export interface JourneySummary {
  id: string;
  /** Stored status — only ever changed by cancel-journey / complete-journey. */
  status: JourneyStatus;
  /** What the journey actually is right now (see lib/journeyStatus.ts). Display this. */
  displayStatus: JourneyStatus;
  firstPickupAt: string;
  lastDropAt: string;
  dateFrom: string;
  dateTo: string;
  guestCount: number;
  routeSummary: string;
  vehicleId: string;
  driverId: string;
  carName: string | null;
  plate: string | null;
  driverName: string | null;
  carLabel: string | null;
  driverLabel: string | null;
  /** Ordered origin → stops → destination. */
  stops: JourneyStopSummary[];
  guests: GuestRef[];
}

const JOURNEY_SELECT = `
  id, status, first_pickup_at, last_drop_at, date_from, date_to, notes, vehicle_id, driver_id,
  vehicle:vehicles(id, name, registration_number),
  driver:drivers(id, full_name),
  journey_guests(id, guest:guests(full_name, phone), employee:employees(full_name, phone, employee_code)),
  journey_stops(id, location_name, role, sequence_no, arrival_at, journey_stop_guests(action, journey_guest_id))
`;

// PostgREST embeds aren't reflected in the generated Database type — narrow with a local
// shape matching JOURNEY_SELECT instead of `any`.
interface RawJourneyRow {
  id: string;
  status: JourneyStatus;
  first_pickup_at: string;
  last_drop_at: string;
  date_from: string;
  date_to: string;
  notes: string | null;
  vehicle_id: string;
  driver_id: string;
  vehicle: { id: string; name: string; registration_number: string } | null;
  driver: { id: string; full_name: string } | null;
  journey_guests: {
    id: string;
    guest: { full_name: string; phone: string } | null;
    employee: { full_name: string; phone: string | null; employee_code: string } | null;
  }[];
  journey_stops: {
    id: string;
    location_name: string;
    role: JourneyStopSummary["role"];
    sequence_no: number;
    arrival_at: string;
    journey_stop_guests: { action: "pickup" | "drop"; journey_guest_id: string }[];
  }[];
}

function toSummary(row: RawJourneyRow, now: number): JourneySummary {
  const guestByJourneyGuestId = new Map<string, GuestRef>(
    row.journey_guests.map((jg) => [
      jg.id,
      jg.employee
        ? { kind: "employee", name: jg.employee.full_name, phone: jg.employee.phone ?? "", employeeCode: jg.employee.employee_code }
        : { kind: "guest", name: jg.guest?.full_name ?? "Unknown guest", phone: jg.guest?.phone ?? "" },
    ]),
  );
  const stops = [...row.journey_stops]
    .sort((a, b) => a.sequence_no - b.sequence_no)
    .map((s) => ({
      sequenceNo: s.sequence_no,
      role: s.role,
      locationName: s.location_name,
      arrivalAt: s.arrival_at,
      pickups: s.journey_stop_guests.filter((g) => g.action === "pickup").map((g) => guestByJourneyGuestId.get(g.journey_guest_id)!).filter(Boolean),
      drops: s.journey_stop_guests.filter((g) => g.action === "drop").map((g) => guestByJourneyGuestId.get(g.journey_guest_id)!).filter(Boolean),
    }));

  return {
    id: row.id,
    status: row.status,
    displayStatus: effectiveJourneyStatus(row.status, row.first_pickup_at, row.last_drop_at, now),
    firstPickupAt: row.first_pickup_at,
    lastDropAt: row.last_drop_at,
    dateFrom: row.date_from,
    dateTo: row.date_to,
    guestCount: row.journey_guests.length,
    routeSummary: stops.map((s) => s.locationName).join(" → "),
    vehicleId: row.vehicle_id,
    driverId: row.driver_id,
    carName: row.vehicle?.name ?? null,
    plate: row.vehicle?.registration_number ?? null,
    driverName: row.driver?.full_name ?? null,
    carLabel: row.vehicle ? `${row.vehicle.name} — ${row.vehicle.registration_number}` : null,
    driverLabel: row.driver?.full_name ?? null,
    stops,
    guests: [...guestByJourneyGuestId.values()],
  };
}

/** Start/end of a yyyy-mm-dd day in IST, as ISO timestamps (the fleet's day, not UTC's). */
function istDayStart(date: string) {
  return new Date(`${date}T00:00:00+05:30`).toISOString();
}
function istDayEnd(date: string) {
  return new Date(`${date}T23:59:59.999+05:30`).toISOString();
}

export interface ListJourneysFilter {
  /** yyyy-mm-dd (IST) — journeys whose busy window overlaps [from, to] at all. */
  from?: string;
  to?: string;
  /** Matched against the *derived* displayStatus, not the stored column. */
  status?: JourneyStatus;
}

// Date filtering uses first_pickup_at/last_drop_at against IST day boundaries rather than
// the stored date_from/date_to columns: those are cast in the database's own time zone
// (UTC on Supabase), so a trip starting before 5:30 AM IST would land on the wrong day.
export async function listJourneys(supabase: SupabaseClient, filter: ListJourneysFilter = {}) {
  let query = supabase.from("journeys").select(JOURNEY_SELECT).order("first_pickup_at", { ascending: false });
  if (filter.from) query = query.gte("last_drop_at", istDayStart(filter.from));
  if (filter.to) query = query.lte("first_pickup_at", istDayEnd(filter.to));

  const { data, error } = await query;
  if (error) throw error;
  const now = Date.now();
  const journeys = ((data ?? []) as unknown as RawJourneyRow[]).map((row) => toSummary(row, now));
  return filter.status ? journeys.filter((j) => j.displayStatus === filter.status) : journeys;
}

/**
 * driver-app-new's list opens on today's date, widened to cover every journey that is
 * still upcoming or in progress (so none is hidden by the default filter). Returns
 * yyyy-mm-dd (IST) bounds.
 */
export async function getDefaultJourneyRange(supabase: SupabaseClient): Promise<{ from: string; to: string }> {
  const today = todayInAppZone();
  const { data, error } = await supabase
    .from("journeys")
    .select("first_pickup_at, last_drop_at")
    .in("status", ["planned", "ongoing"])
    .gte("last_drop_at", new Date().toISOString());
  if (error) throw error;
  if (!data || data.length === 0) return { from: today, to: today };

  const toIstDate = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const starts = data.map((j) => toIstDate(j.first_pickup_at)).concat(today).sort();
  const ends = data.map((j) => toIstDate(j.last_drop_at)).concat(today).sort();
  return { from: starts[0]!, to: ends[ends.length - 1]! };
}

async function listJourneysFor(
  supabase: SupabaseClient,
  column: "vehicle_id" | "driver_id",
  id: string,
  filter: { status?: "upcoming" | "past" },
) {
  const nowIso = new Date().toISOString();
  let query = supabase.from("journeys").select(JOURNEY_SELECT).eq(column, id);
  query =
    filter.status === "upcoming"
      ? query.gte("last_drop_at", nowIso).order("first_pickup_at", { ascending: true })
      : filter.status === "past"
        ? query.lt("last_drop_at", nowIso).order("first_pickup_at", { ascending: false })
        : query.order("first_pickup_at", { ascending: false });

  const { data, error } = await query;
  if (error) throw error;
  const now = Date.now();
  return ((data ?? []) as unknown as RawJourneyRow[]).map((row) => toSummary(row, now));
}

export function listJourneysForCar(supabase: SupabaseClient, vehicleId: string, filter: { status?: "upcoming" | "past" } = {}) {
  return listJourneysFor(supabase, "vehicle_id", vehicleId, filter);
}

export function listJourneysForDriver(supabase: SupabaseClient, driverId: string, filter: { status?: "upcoming" | "past" } = {}) {
  return listJourneysFor(supabase, "driver_id", driverId, filter);
}

export interface JourneyDetail extends JourneySummary {
  notes: string | null;
}

export async function getJourneyById(supabase: SupabaseClient, id: string): Promise<JourneyDetail | null> {
  const { data, error } = await supabase.from("journeys").select(JOURNEY_SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as unknown as RawJourneyRow;
  return { ...toSummary(row, Date.now()), notes: row.notes };
}
