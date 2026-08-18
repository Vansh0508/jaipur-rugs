import type { SupabaseClient } from "@supabase/supabase-js";

export interface FeedbackRow {
  id: string;
  driverId: string;
  driverName: string;
  rating: number;
  description: string | null;
  travelDate: string;
  reviewStatus: "pending" | "approved" | "rejected";
}

const FEEDBACK_SELECT = "id, driver_id, rating, description, travel_date, review_status, drivers(full_name)";

interface RawFeedbackRow {
  id: string;
  driver_id: string;
  rating: number;
  description: string | null;
  travel_date: string;
  review_status: "pending" | "approved" | "rejected";
  drivers: { full_name: string } | null;
}

function toFeedbackRow(row: RawFeedbackRow): FeedbackRow {
  return {
    id: row.id,
    driverId: row.driver_id,
    driverName: row.drivers?.full_name ?? "Unknown driver",
    rating: row.rating,
    description: row.description,
    travelDate: row.travel_date,
    reviewStatus: row.review_status,
  };
}

export async function listRecentFeedback(supabase: SupabaseClient, limit = 5) {
  const { data, error } = await supabase
    .from("feedback")
    .select(FEEDBACK_SELECT)
    .eq("review_status", "approved")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as unknown as RawFeedbackRow[]).map(toFeedbackRow);
}

export async function listPlannedFeedbackForDriver(supabase: SupabaseClient, driverId: string) {
  const { data, error } = await supabase
    .from("feedback")
    .select(FEEDBACK_SELECT)
    .eq("driver_id", driverId)
    .not("journey_id", "is", null)
    .order("travel_date", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as RawFeedbackRow[]).map(toFeedbackRow);
}

export async function listPendingFeedbackForDriver(supabase: SupabaseClient, driverId: string) {
  const { data, error } = await supabase
    .from("feedback")
    .select(FEEDBACK_SELECT)
    .eq("driver_id", driverId)
    .is("journey_id", null)
    .eq("review_status", "pending")
    .order("travel_date", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as RawFeedbackRow[]).map(toFeedbackRow);
}
