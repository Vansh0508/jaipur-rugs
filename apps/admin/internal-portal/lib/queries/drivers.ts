import type { SupabaseClient } from "@supabase/supabase-js";
import type { Enums, Tables } from "@jaipur-rugs/supabase-client";

export type Driver = Tables<"drivers">;

export async function listDrivers(supabase: SupabaseClient) {
  const { data, error } = await supabase.from("drivers").select("*").order("full_name");
  if (error) throw error;
  return (data ?? []) as Driver[];
}

/** Stored `driver_status`, plus a read-time `on_trip` (never stored, see below). */
export type DriverDisplayStatus = Enums<"driver_status"> | "on_trip";

export interface DriverListItem extends Driver {
  displayStatus: DriverDisplayStatus;
  activeJourneyId: string | null;
  /** Average of approved reviews, one decimal; null when there are none. */
  avgRating: number | null;
  reviewCount: number;
}

/**
 * Drivers list/table/card data — three queries aggregated in memory (no N+1), same shape
 * as driver-app-new's listDriversWithStats. Only `review_status = 'approved'` feedback
 * counts toward the rating, matching the public Feedback App and the dashboard (pending
 * unplanned-ride reviews are unverified until an admin approves them). "On trip" is
 * derived like cars' (listCarsWithActivity), and only overrides an `active` driver — a
 * suspended/on-leave driver keeps showing that status.
 */
export async function listDriversWithStats(supabase: SupabaseClient): Promise<DriverListItem[]> {
  const nowIso = new Date().toISOString();
  const [drivers, { data: feedback, error: feedbackError }, { data: active, error: activeError }] = await Promise.all([
    listDrivers(supabase),
    supabase.from("feedback").select("driver_id, rating").eq("review_status", "approved"),
    supabase
      .from("journeys")
      .select("id, driver_id")
      .neq("status", "cancelled")
      .lte("first_pickup_at", nowIso)
      .gte("last_drop_at", nowIso),
  ]);
  if (feedbackError) throw feedbackError;
  if (activeError) throw activeError;

  const stats = new Map<string, { count: number; sum: number }>();
  for (const row of feedback ?? []) {
    const current = stats.get(row.driver_id) ?? { count: 0, sum: 0 };
    current.count++;
    current.sum += row.rating;
    stats.set(row.driver_id, current);
  }
  const activeByDriver = new Map((active ?? []).map((j) => [j.driver_id as string, j.id as string]));

  return drivers.map((driver) => toListItem(driver, stats.get(driver.id), activeByDriver.get(driver.id) ?? null));
}

function toListItem(driver: Driver, stats: { count: number; sum: number } | undefined, activeJourneyId: string | null): DriverListItem {
  return {
    ...driver,
    displayStatus: activeJourneyId && driver.status === "active" ? "on_trip" : driver.status,
    activeJourneyId,
    avgRating: stats ? Math.round((stats.sum / stats.count) * 10) / 10 : null,
    reviewCount: stats?.count ?? 0,
  };
}

export async function getDriverById(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase.from("drivers").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Driver | null;
}

/**
 * One driver in the list's shape (derived "on trip" status + approved-review stats), for
 * the detail page's header and ⋮ menu — the same numbers the list row for this driver shows.
 */
export async function getDriverListItemById(supabase: SupabaseClient, id: string): Promise<DriverListItem | null> {
  const nowIso = new Date().toISOString();
  const [driver, { data: feedback, error: feedbackError }, { data: active, error: activeError }] = await Promise.all([
    getDriverById(supabase, id),
    supabase.from("feedback").select("rating").eq("driver_id", id).eq("review_status", "approved"),
    supabase
      .from("journeys")
      .select("id")
      .eq("driver_id", id)
      .neq("status", "cancelled")
      .lte("first_pickup_at", nowIso)
      .gte("last_drop_at", nowIso)
      .limit(1),
  ]);
  if (feedbackError) throw feedbackError;
  if (activeError) throw activeError;
  if (!driver) return null;

  const ratings = feedback ?? [];
  const stats = ratings.length > 0 ? { count: ratings.length, sum: ratings.reduce((sum, r) => sum + r.rating, 0) } : undefined;
  return toListItem(driver, stats, (active?.[0]?.id as string | undefined) ?? null);
}

export interface DriverAvailability {
  id: string;
  fullName: string;
  phone: string;
  isAvailable: boolean;
  unavailableReason: string | null;
}

const UNAVAILABLE_STATUS_REASON: Partial<Record<Driver["status"], string>> = {
  on_leave: "On leave",
  suspended: "Suspended",
};

/**
 * Same overlap logic as getAvailableCarsForWindow, for the driver picker. On-leave and
 * suspended drivers are listed but unpickable (with the reason), like driver-app-new's
 * picker; deactivated drivers aren't offered at all.
 */
export async function getAvailableDriversForWindow(
  supabase: SupabaseClient,
  startIso: string,
  endIso: string,
): Promise<DriverAvailability[]> {
  const [{ data: drivers, error: driversError }, { data: overlapping, error: overlapError }] = await Promise.all([
    supabase.from("drivers").select("id, full_name, phone, status").neq("status", "inactive").order("full_name"),
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
    const base = { id: d.id, fullName: d.full_name, phone: d.phone };
    const statusReason = UNAVAILABLE_STATUS_REASON[d.status as Driver["status"]];
    if (statusReason) return { ...base, isAvailable: false, unavailableReason: statusReason };
    const busy = busyByDriver.get(d.id);
    if (busy) return { ...base, isAvailable: false, unavailableReason: "Busy on another journey then" };
    return { ...base, isAvailable: true, unavailableReason: null };
  });
}
