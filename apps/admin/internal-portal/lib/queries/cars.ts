import type { SupabaseClient } from "@supabase/supabase-js";
import type { Enums, Tables } from "@jaipur-rugs/supabase-client";

export type Car = Tables<"vehicles">;

export async function listCars(supabase: SupabaseClient) {
  const { data, error } = await supabase.from("vehicles").select("*").order("name");
  if (error) throw error;
  return (data ?? []) as Car[];
}

export interface CarListItem extends Car {
  /** `status`, except `on_trip` whenever a journey is in progress right now. */
  displayStatus: Enums<"vehicle_status">;
  activeJourneyId: string | null;
}

/**
 * Cars list/table/card data. Nothing writes `vehicles.status = 'on_trip'`, so the stored
 * status alone reads "Vacant" for a car that's mid-journey — derived here instead from any
 * non-cancelled journey whose busy window contains now(). An in-progress journey wins
 * over the stored status, matching driver-app-new's GET /api/cars ("busy" beats
 * everything); update-car-status already refuses maintenance while a car is mid-trip.
 */
export async function listCarsWithActivity(supabase: SupabaseClient): Promise<CarListItem[]> {
  const nowIso = new Date().toISOString();
  const [cars, { data: active, error }] = await Promise.all([
    listCars(supabase),
    supabase
      .from("journeys")
      .select("id, vehicle_id")
      .neq("status", "cancelled")
      .lte("first_pickup_at", nowIso)
      .gte("last_drop_at", nowIso),
  ]);
  if (error) throw error;

  const activeByVehicle = new Map((active ?? []).map((j) => [j.vehicle_id as string, j.id as string]));
  return cars.map((car) => {
    const activeJourneyId = activeByVehicle.get(car.id) ?? null;
    return { ...car, displayStatus: activeJourneyId ? "on_trip" : car.status, activeJourneyId };
  });
}

export async function getCarById(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase.from("vehicles").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Car | null;
}

/** One car in the list's shape (derived "on trip" status), for the detail page's header and ⋮ menu. */
export async function getCarListItemById(supabase: SupabaseClient, id: string): Promise<CarListItem | null> {
  const nowIso = new Date().toISOString();
  const [car, { data: active, error }] = await Promise.all([
    getCarById(supabase, id),
    supabase
      .from("journeys")
      .select("id")
      .eq("vehicle_id", id)
      .neq("status", "cancelled")
      .lte("first_pickup_at", nowIso)
      .gte("last_drop_at", nowIso)
      .limit(1),
  ]);
  if (error) throw error;
  if (!car) return null;

  const activeJourneyId = (active?.[0]?.id as string | undefined) ?? null;
  return { ...car, displayStatus: activeJourneyId ? "on_trip" : car.status, activeJourneyId };
}

export interface CarAvailability {
  id: string;
  name: string;
  registrationNumber: string;
  isAvailable: boolean;
  unavailableReason: string | null;
}

/**
 * A car is unavailable for [startIso, endIso] if it's under maintenance, or has any
 * non-cancelled journey whose busy window overlaps that range (classic interval-overlap:
 * `existing.first_pickup_at <= end AND existing.last_drop_at >= start`) — a journey
 * ending before this window starts is correctly NOT a conflict, same semantics as the
 * DB's EXCLUDE constraint this mirrors for the picker preview (the constraint itself is
 * still the actual guarantee at create-journey time; this is read-only UX).
 */
export async function getAvailableCarsForWindow(
  supabase: SupabaseClient,
  startIso: string,
  endIso: string,
): Promise<CarAvailability[]> {
  const [{ data: vehicles, error: vehiclesError }, { data: overlapping, error: overlapError }] = await Promise.all([
    supabase.from("vehicles").select("id, name, registration_number, status").order("name"),
    supabase
      .from("journeys")
      .select("vehicle_id, date_from, date_to")
      .neq("status", "cancelled")
      .lte("first_pickup_at", endIso)
      .gte("last_drop_at", startIso),
  ]);
  if (vehiclesError) throw vehiclesError;
  if (overlapError) throw overlapError;

  const busyByVehicle = new Map<string, { date_from: string; date_to: string }>();
  for (const row of overlapping ?? []) {
    if (!busyByVehicle.has(row.vehicle_id)) {
      busyByVehicle.set(row.vehicle_id, { date_from: row.date_from, date_to: row.date_to });
    }
  }

  // Deactivated cars (the soft-delete) aren't offered at all; maintenance/accidental ones
  // are listed but unpickable, with the reason shown.
  return (vehicles ?? []).filter((v) => v.status !== "inactive").map((v) => {
    if (v.status === "maintenance" || v.status === "accidental") {
      return {
        id: v.id,
        name: v.name,
        registrationNumber: v.registration_number,
        isAvailable: false,
        unavailableReason: v.status === "maintenance" ? "Under maintenance" : "Out of service — accidental",
      };
    }
    const busy = busyByVehicle.get(v.id);
    if (busy) {
      return {
        id: v.id,
        name: v.name,
        registrationNumber: v.registration_number,
        isAvailable: false,
        unavailableReason: "Busy on another journey then",
      };
    }
    return { id: v.id, name: v.name, registrationNumber: v.registration_number, isAvailable: true, unavailableReason: null };
  });
}
