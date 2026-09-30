import type { SupabaseClient } from "@supabase/supabase-js";

export interface FeedbackRow {
  id: string;
  driverId: string;
  driverName: string;
  rating: number;
  description: string | null;
  travelDate: string;
  createdAt: string;
  reviewStatus: "pending" | "approved" | "rejected";
  /** Set when the review is tied to a planned ride; null for an unplanned ("direct") review. */
  journeyId: string | null;
  /** Who left it — a guest or an employee; "Unknown reviewer" if neither row is readable. */
  reviewerName: string;
  reviewerKind: "guest" | "employee" | null;
  /** Guests only — shown on the moderation card so an admin can recognise the reviewer. */
  reviewerPhone: string | null;
}

// feedback has two FKs to employees (employee_id = the reviewer, reviewed_by = the
// moderating admin), so the reviewer embed needs the constraint name to disambiguate.
const FEEDBACK_SELECT = `
  id, driver_id, rating, description, travel_date, created_at, review_status, journey_id,
  drivers(full_name),
  guest:guests(full_name, phone),
  employee:employees!feedback_employee_id_fkey(full_name)
`;

interface RawFeedbackRow {
  id: string;
  driver_id: string;
  rating: number;
  description: string | null;
  travel_date: string;
  created_at: string;
  review_status: "pending" | "approved" | "rejected";
  journey_id: string | null;
  drivers: { full_name: string } | null;
  guest: { full_name: string; phone: string } | null;
  employee: { full_name: string } | null;
}

function toFeedbackRow(row: RawFeedbackRow): FeedbackRow {
  return {
    id: row.id,
    driverId: row.driver_id,
    driverName: row.drivers?.full_name ?? "Unknown driver",
    rating: row.rating,
    description: row.description,
    travelDate: row.travel_date,
    createdAt: row.created_at,
    reviewStatus: row.review_status,
    journeyId: row.journey_id,
    reviewerName: row.employee?.full_name ?? row.guest?.full_name ?? "Unknown reviewer",
    reviewerKind: row.employee ? "employee" : row.guest ? "guest" : null,
    reviewerPhone: row.guest?.phone ?? null,
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

/**
 * Every review of a driver, newest first — approved, pending and rejected. The driver
 * page splits them: approved ones count toward the rating, pending unplanned ones wait in
 * the moderation queue, rejected ones are dropped.
 */
export async function listFeedbackForDriver(supabase: SupabaseClient, driverId: string) {
  const { data, error } = await supabase
    .from("feedback")
    .select(FEEDBACK_SELECT)
    .eq("driver_id", driverId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as RawFeedbackRow[]).map(toFeedbackRow);
}
