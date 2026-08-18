import type { SupabaseClient } from "@supabase/supabase-js";
import type { Enums } from "@jaipur-rugs/supabase-client";

export interface JourneySummary {
  id: string;
  dateFrom: string;
  dateTo: string;
  guestCount: number;
  routeSummary: string;
  carLabel: string | null;
  driverLabel: string | null;
  status: Enums<"journey_status">;
}

const JOURNEY_SELECT = `
  id, status, first_pickup_at, last_drop_at, date_from, date_to, notes,
  vehicle:vehicles(id, name, registration_number),
  driver:drivers(id, full_name),
  journey_guests(id),
  journey_stops(location_name, role, sequence_no)
`;

// The DB relations above are typed loosely (PostgREST embedding isn't reflected in the
// generated Database type without a manual override) — narrow with a small local shape
// instead of `any`, matching what JOURNEY_SELECT actually returns.
interface RawJourneyRow {
  id: string;
  status: Enums<"journey_status">;
  date_from: string;
  date_to: string;
  vehicle: { id: string; name: string; registration_number: string } | null;
  driver: { id: string; full_name: string } | null;
  journey_guests: { id: string }[];
  journey_stops: { location_name: string; role: string; sequence_no: number }[];
}

function toSummary(row: RawJourneyRow): JourneySummary {
  const stops = [...row.journey_stops].sort((a, b) => a.sequence_no - b.sequence_no);
  return {
    id: row.id,
    dateFrom: row.date_from,
    dateTo: row.date_to,
    guestCount: row.journey_guests.length,
    routeSummary: stops.map((s) => s.location_name).join(" → "),
    carLabel: row.vehicle ? `${row.vehicle.name} — ${row.vehicle.registration_number}` : null,
    driverLabel: row.driver?.full_name ?? null,
    status: row.status,
  };
}

export interface ListJourneysFilter {
  from?: string;
  to?: string;
  status?: Enums<"journey_status">;
}

export async function listJourneys(supabase: SupabaseClient, filter: ListJourneysFilter = {}) {
  let query = supabase.from("journeys").select(JOURNEY_SELECT).order("first_pickup_at", { ascending: false });

  if (filter.from) query = query.gte("date_to", filter.from);
  if (filter.to) query = query.lte("date_from", filter.to);
  if (filter.status) query = query.eq("status", filter.status);

  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as unknown as RawJourneyRow[]).map(toSummary);
}

export async function listJourneysForCar(
  supabase: SupabaseClient,
  vehicleId: string,
  filter: { status?: "upcoming" | "past" } = {},
) {
  let query = supabase.from("journeys").select(JOURNEY_SELECT).eq("vehicle_id", vehicleId);
  query =
    filter.status === "upcoming"
      ? query.gte("last_drop_at", new Date().toISOString()).order("first_pickup_at", { ascending: true })
      : filter.status === "past"
        ? query.lt("last_drop_at", new Date().toISOString()).order("first_pickup_at", { ascending: false })
        : query.order("first_pickup_at", { ascending: false });

  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as unknown as RawJourneyRow[]).map(toSummary);
}

export interface JourneyDetail extends JourneySummary {
  notes: string | null;
  vehicleId: string | null;
  driverId: string | null;
  stops: { locationName: string; role: string; sequenceNo: number; arrivalAt: string; pickups: string[]; drops: string[] }[];
}

interface RawJourneyDetailRow extends RawJourneyRow {
  notes: string | null;
  vehicle_id: string;
  driver_id: string;
  journey_stops: { location_name: string; role: string; sequence_no: number; arrival_at: string; id: string }[];
  journey_guests: { id: string; guest_id: string; guests: { full_name: string; phone: string } | null }[];
}

export async function getJourneyById(supabase: SupabaseClient, id: string): Promise<JourneyDetail | null> {
  const { data, error } = await supabase
    .from("journeys")
    .select(
      `
      id, status, first_pickup_at, last_drop_at, date_from, date_to, notes, vehicle_id, driver_id,
      vehicle:vehicles(id, name, registration_number),
      driver:drivers(id, full_name),
      journey_guests(id, guest_id, guests(full_name, phone)),
      journey_stops(id, location_name, role, sequence_no, arrival_at)
    `,
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const row = data as unknown as RawJourneyDetailRow;
  const guestNameByJourneyGuestId = new Map(row.journey_guests.map((jg) => [jg.id, jg.guests?.full_name ?? "Unknown guest"]));

  const stopsWithGuests = await supabase
    .from("journey_stop_guests")
    .select("stop_id, action, journey_guest_id")
    .in("stop_id", row.journey_stops.map((s) => s.id));
  if (stopsWithGuests.error) throw stopsWithGuests.error;

  const stops = [...row.journey_stops]
    .sort((a, b) => a.sequence_no - b.sequence_no)
    .map((s) => ({
      locationName: s.location_name,
      role: s.role,
      sequenceNo: s.sequence_no,
      arrivalAt: s.arrival_at,
      pickups: (stopsWithGuests.data ?? [])
        .filter((sg) => sg.stop_id === s.id && sg.action === "pickup")
        .map((sg) => guestNameByJourneyGuestId.get(sg.journey_guest_id) ?? "Unknown guest"),
      drops: (stopsWithGuests.data ?? [])
        .filter((sg) => sg.stop_id === s.id && sg.action === "drop")
        .map((sg) => guestNameByJourneyGuestId.get(sg.journey_guest_id) ?? "Unknown guest"),
    }));

  return { ...toSummary(row), notes: row.notes, vehicleId: row.vehicle_id, driverId: row.driver_id, stops };
}

export async function listJourneysForDriver(
  supabase: SupabaseClient,
  driverId: string,
  filter: { status?: "upcoming" | "past" } = {},
) {
  let query = supabase.from("journeys").select(JOURNEY_SELECT).eq("driver_id", driverId);
  query =
    filter.status === "upcoming"
      ? query.gte("last_drop_at", new Date().toISOString()).order("first_pickup_at", { ascending: true })
      : filter.status === "past"
        ? query.lt("last_drop_at", new Date().toISOString()).order("first_pickup_at", { ascending: false })
        : query.order("first_pickup_at", { ascending: false });

  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as unknown as RawJourneyRow[]).map(toSummary);
}
