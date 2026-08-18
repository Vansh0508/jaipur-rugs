import type { SupabaseClient } from "@supabase/supabase-js";
import type { Tables } from "@jaipur-rugs/supabase-client";

export type Driver = Tables<"drivers">;

export async function listDrivers(supabase: SupabaseClient) {
  const { data, error } = await supabase.from("drivers").select("*").order("full_name");
  if (error) throw error;
  return (data ?? []) as Driver[];
}

export async function getDriverById(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase.from("drivers").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Driver | null;
}

export interface DriverAvailability {
  id: string;
  fullName: string;
  isAvailable: boolean;
  unavailableReason: string | null;
}

/** Same overlap logic as getAvailableCarsForWindow, for the driver picker. */
export async function getAvailableDriversForWindow(
  supabase: SupabaseClient,
  startIso: string,
  endIso: string,
): Promise<DriverAvailability[]> {
  const [{ data: drivers, error: driversError }, { data: overlapping, error: overlapError }] = await Promise.all([
    supabase.from("drivers").select("id, full_name, status").eq("status", "active").order("full_name"),
    supabase
      .from("journeys")
      .select("driver_id, date_from, date_to")
      .neq("status", "cancelled")
      .lte("first_pickup_at", endIso)
      .gte("last_drop_at", startIso),
  ]);
  if (driversError) throw driversError;
  if (overlapError) throw overlapError;

  const busyByDriver = new Map<string, { date_from: string; date_to: string }>();
  for (const row of overlapping ?? []) {
    if (!busyByDriver.has(row.driver_id)) {
      busyByDriver.set(row.driver_id, { date_from: row.date_from, date_to: row.date_to });
    }
  }

  return (drivers ?? []).map((d) => {
    const busy = busyByDriver.get(d.id);
    if (busy) {
      return {
        id: d.id,
        fullName: d.full_name,
        isAvailable: false,
        unavailableReason: `Busy on a journey (${busy.date_from} to ${busy.date_to})`,
      };
    }
    return { id: d.id, fullName: d.full_name, isAvailable: true, unavailableReason: null };
  });
}
