import type { SupabaseClient } from "@supabase/supabase-js";

// Backs the admin-only User Management screen (db/user-activity/001_login_sessions.sql).
// Admin-only in practice — login_sessions_select only returns every row to an
// orders.read.all holder; anyone else only sees their own (see requireAtlasStaffAccess.ts,
// checked again in the page itself for defense in depth since this is staff-activity
// data, not just another list).

export interface UserActivityRow {
  employeeId: string;
  fullName: string;
  employeeCode: string;
  departmentName: string | null;
  lastSignInAt: string | null;
  lastActiveAt: string | null;
  isOnline: boolean;
  totalSessions: number;
  totalSeconds: number;
}

export async function listUserActivity(supabase: SupabaseClient): Promise<UserActivityRow[]> {
  const { data, error } = await supabase
    .from("login_session_summary")
    .select(
      "employee_id, full_name, employee_code, department_name, last_sign_in_at, last_active_at, is_online, total_sessions, total_seconds",
    )
    .order("last_sign_in_at", { ascending: false, nullsFirst: false });
  if (error) throw error;

  return (data ?? []).map((row) => ({
    employeeId: row.employee_id as string,
    fullName: row.full_name as string,
    employeeCode: row.employee_code as string,
    departmentName: row.department_name as string | null,
    lastSignInAt: row.last_sign_in_at as string | null,
    lastActiveAt: row.last_active_at as string | null,
    isOnline: Boolean(row.is_online),
    totalSessions: Number(row.total_sessions),
    totalSeconds: Number(row.total_seconds),
  }));
}

export interface UserActivitySummary {
  totalUsers: number;
  onlineNow: number;
  activeLast7Days: number;
  avgSessionSeconds: number;
}

export function summarizeUserActivity(rows: UserActivityRow[]): UserActivitySummary {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const activeLast7Days = rows.filter(
    (r) => r.lastActiveAt !== null && new Date(r.lastActiveAt).getTime() >= sevenDaysAgo,
  ).length;
  const totalSessions = rows.reduce((sum, r) => sum + r.totalSessions, 0);
  const totalSeconds = rows.reduce((sum, r) => sum + r.totalSeconds, 0);

  return {
    totalUsers: rows.length,
    onlineNow: rows.filter((r) => r.isOnline).length,
    activeLast7Days,
    avgSessionSeconds: totalSessions > 0 ? Math.round(totalSeconds / totalSessions) : 0,
  };
}
