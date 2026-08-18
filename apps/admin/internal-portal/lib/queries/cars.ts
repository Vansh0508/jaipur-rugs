import type { SupabaseClient } from "@supabase/supabase-js";
import type { Tables } from "@jaipur-rugs/supabase-client";

export type Car = Tables<"vehicles">;

export async function listCars(supabase: SupabaseClient) {
  const { data, error } = await supabase.from("vehicles").select("*").order("name");
  if (error) throw error;
  return (data ?? []) as Car[];
}

export async function getCarById(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase.from("vehicles").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Car | null;
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

  return (vehicles ?? []).map((v) => {
    if (v.status === "maintenance") {
      return { id: v.id, name: v.name, registrationNumber: v.registration_number, isAvailable: false, unavailableReason: "Under maintenance" };
    }
    const busy = busyByVehicle.get(v.id);
    if (busy) {
      return {
        id: v.id,
        name: v.name,
        registrationNumber: v.registration_number,
        isAvailable: false,
        unavailableReason: `Busy on a journey (${busy.date_from} to ${busy.date_to})`,
      };
    }
    return { id: v.id, name: v.name, registrationNumber: v.registration_number, isAvailable: true, unavailableReason: null };
  });
}
