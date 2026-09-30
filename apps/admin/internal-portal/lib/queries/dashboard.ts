import type { SupabaseClient } from "@supabase/supabase-js";
import { APP_TIME_ZONE, todayInAppZone } from "@/lib/format";
import type { CarListItem } from "@/lib/queries/cars";
import type { DriverListItem } from "@/lib/queries/drivers";

export interface RideCountDay {
  /** yyyy-mm-dd in the fleet's time zone (IST). */
  date: string;
  rides: number;
}

function addDays(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Journeys per day for the last `days` days, today included — a day with none is a zero
 * bar, not a gap. Cancelled journeys aren't rides. Bucketed by `first_pickup_at` on the
 * IST calendar (same reason as the journeys list: the stored date_from/date_to are cast
 * in the database's UTC zone, which would put an early-morning trip on the wrong day).
 * Includes planned journeys later today, so the chart shows what is on for today too.
 */
export async function getRideCountsByDay(supabase: SupabaseClient, days = 14): Promise<RideCountDay[]> {
  const today = todayInAppZone();
  const first = addDays(today, -(days - 1));
  const { data, error } = await supabase
    .from("journeys")
    .select("first_pickup_at")
    .neq("status", "cancelled")
    .gte("first_pickup_at", new Date(`${first}T00:00:00+05:30`).toISOString())
    .lte("first_pickup_at", new Date(`${today}T23:59:59.999+05:30`).toISOString());
  if (error) throw error;

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const day = new Date(row.first_pickup_at as string).toLocaleDateString("en-CA", { timeZone: APP_TIME_ZONE });
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(first, i);
    return { date, rides: counts.get(date) ?? 0 };
  });
}

export interface StatusCount {
  label: string;
  value: number;
}

/**
 * Drivers: Active = on the roster and free; Busy = on a journey right now; Inactive =
 * everyone else who can't be assigned (deactivated, on leave or suspended). Uses the
 * list's derived `displayStatus`, so "busy" matches the Drivers page exactly.
 */
export function driverStatusCounts(drivers: DriverListItem[]): StatusCount[] {
  const count = (pick: (d: DriverListItem) => boolean) => drivers.filter(pick).length;
  return [
    { label: "Active", value: count((d) => d.displayStatus === "active") },
    { label: "Busy", value: count((d) => d.displayStatus === "on_trip") },
    { label: "Inactive", value: count((d) => ["inactive", "on_leave", "suspended"].includes(d.displayStatus)) },
  ];
}

/**
 * Vehicles: Active = in service (vacant, or out on a trip); Under maintenance = out of
 * service for repair (maintenance, or accidental); Inactive = deactivated.
 */
export function vehicleStatusCounts(cars: CarListItem[]): StatusCount[] {
  const count = (pick: (c: CarListItem) => boolean) => cars.filter(pick).length;
  return [
    { label: "Active", value: count((c) => c.displayStatus === "vacant" || c.displayStatus === "on_trip") },
    { label: "Under maintenance", value: count((c) => c.displayStatus === "maintenance" || c.displayStatus === "accidental") },
    { label: "Inactive", value: count((c) => c.displayStatus === "inactive") },
  ];
}
