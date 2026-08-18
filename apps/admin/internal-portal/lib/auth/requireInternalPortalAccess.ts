import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

// The single authorization primitive for this whole app, checked in TWO places on
// purpose (AGENTS.md Section 5 — "every app independently re-verifies... on load", not
// just at the edge): once in proxy.ts (route gating) and again here, called at the top of
// app/(shell)/layout.tsx (Server Component). A shared session proves "logged in," never
// "authorized for this app" — this mirrors private.is_internal_portal_admin exactly (see
// db/journeys/003_journey_admin_helpers_and_write_functions.sql): an active employee with
// a department_access_grants row on the 'admin' department at access_level 'admin'.

export interface InternalPortalEmployee {
  employeeId: string;
  authUserId: string;
  fullName: string;
  email: string;
}

/**
 * Redirects to /login (no session) or the force-logout route (session but not
 * authorized) if the check fails; otherwise returns the authorized employee's identity
 * for the caller to use.
 */
export async function requireInternalPortalAccess(
  supabase: SupabaseClient,
): Promise<InternalPortalEmployee> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: employee } = await supabase
    .from("employees")
    .select("id, full_name, email, status")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!employee || employee.status !== "active") {
    redirect("/api/force-logout?reason=not_authorized");
  }

  const { data: grant } = await supabase
    .from("department_access_grants")
    .select("id, departments!inner(code)")
    .eq("employee_id", employee.id)
    .eq("access_level", "admin")
    .eq("departments.code", "admin")
    .maybeSingle();

  if (!grant) {
    redirect("/api/force-logout?reason=not_authorized");
  }

  return { employeeId: employee.id, authUserId: user.id, fullName: employee.full_name, email: employee.email };
}
