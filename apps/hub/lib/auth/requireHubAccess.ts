import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

// The single authorization primitive for the shell (AGENTS.md Section 5 — "every app
// independently re-verifies... on load", not just at the edge): checked here (called at
// the top of app/(shell)/layout.tsx) AND in proxy.ts, same dual-check pattern Internal
// Portal already uses for its own admin gate (see
// apps/admin/internal-portal/lib/auth/requireInternalPortalAccess.ts). A shared session
// proves "logged in," never "onboarded" or "authorized for the Team page."

export interface HubEmployee {
  employeeId: string;
  authUserId: string;
  fullName: string;
  email: string;
  avatarPath: string | null;
  /** Whether this employee holds the `employees.write` permission — gates the Team page's admin actions. */
  canManageTeam: boolean;
}

/**
 * Redirects to /login (no session), the force-logout route (session but no active
 * employee record), or /onboarding (active but onboarding_completed_at is still null) if
 * any check fails; otherwise returns the authorized employee's identity for the shell to use.
 */
export async function requireHubAccess(supabase: SupabaseClient): Promise<HubEmployee> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: employee } = await supabase
    .from("employees")
    .select("id, full_name, email, status, avatar_path, onboarding_completed_at, primary_role_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!employee || employee.status !== "active") {
    redirect("/api/force-logout?reason=not_authorized");
  }

  if (!employee.onboarding_completed_at) {
    redirect("/onboarding");
  }

  const canManageTeam = await employeeHasPermission(supabase, employee.id, employee.primary_role_id, "employees.write");

  return {
    employeeId: employee.id,
    authUserId: user.id,
    fullName: employee.full_name,
    email: employee.email,
    avatarPath: employee.avatar_path,
    canManageTeam,
  };
}

/**
 * Read-only mirror of `private.employee_has_permission` (see
 * db/team-members/001_team_members_schema.sql) for use client/server-side with the
 * RLS-scoped anon client — `roles`/`permissions`/`role_permissions`/`employee_roles` are
 * all open-SELECT reference tables, so this needs no edge function, just for deciding
 * whether to *show* an admin action. The edge functions that actually perform a Team-page
 * write (`invite-employee`/`update-employee`) re-check the same permission server-side via
 * `requireEmployeePermission`, which is the real authorization boundary.
 */
/** Exported so pages that don't need the full requireHubAccess() redirect chain (e.g. app/(shell)/team/page.tsx, which the shell layout already gated) can still resolve this one flag. */
export async function employeeHasPermission(
  supabase: SupabaseClient,
  employeeId: string,
  primaryRoleId: string | null,
  permissionKey: string,
): Promise<boolean> {
  const { data: permission } = await supabase.from("permissions").select("id").eq("key", permissionKey).maybeSingle();
  if (!permission) return false;

  if (primaryRoleId) {
    const { data: viaPrimaryRole } = await supabase
      .from("role_permissions")
      .select("id")
      .eq("role_id", primaryRoleId)
      .eq("permission_id", permission.id)
      .maybeSingle();
    if (viaPrimaryRole) return true;
  }

  const today = new Date().toISOString().slice(0, 10);
  const { data: employeeRoles } = await supabase
    .from("employee_roles")
    .select("role_id, valid_from, valid_to")
    .eq("employee_id", employeeId)
    .lte("valid_from", today);
  const currentRoleIds = (employeeRoles ?? [])
    .filter((er) => !er.valid_to || er.valid_to >= today)
    .map((er) => er.role_id);
  if (currentRoleIds.length === 0) return false;

  const { data: viaAssignedRole } = await supabase
    .from("role_permissions")
    .select("id")
    .in("role_id", currentRoleIds)
    .eq("permission_id", permission.id)
    .maybeSingle();
  return Boolean(viaAssignedRole);
}
