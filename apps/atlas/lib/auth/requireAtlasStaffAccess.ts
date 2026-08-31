import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

// The staff-side authorization primitive for Atlas — same dual-check pattern as
// apps/hub's requireHubAccess (checked here AND independently in proxy.ts, AGENTS.md
// Section 5: a shared session proves "logged in," never "authorized for Atlas"). Unlike
// Hub/Internal Portal's single admin flag, Atlas authorization is "any real reason to be
// here": org-wide admin, a production/shipping/sales department grant, or being a sales
// rep whose own salesperson_code appears on real orders. Redirects to the Hub launcher
// on failure (AGENTS.md's "Do": never render an empty/broken department screen) rather
// than this app's own /login, since Hub is the one place every employee's session
// definitely already works.

const ATLAS_DEPARTMENT_CODES = ["production", "shipping", "sales"] as const;

export interface AtlasStaffAccess {
  employeeId: string;
  fullName: string;
  /** org-wide admin (orders.read.all) — sees every order, can correct stage/shipping on any of them. */
  isAdmin: boolean;
  /** department codes this employee holds ANY grant on, restricted to the ones Atlas cares about. */
  departmentCodes: string[];
  salespersonCode: string | null;
}

export async function requireAtlasStaffAccess(supabase: SupabaseClient): Promise<AtlasStaffAccess> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: employee } = await supabase
    .from("employees")
    .select("id, full_name, status, primary_role_id, salesperson_code")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!employee || employee.status !== "active") {
    redirect("/api/force-logout?reason=not_authorized");
  }

  const isAdmin = await hasPermission(supabase, employee.id, employee.primary_role_id, "orders.read.all");

  const { data: grants } = await supabase
    .from("department_access_grants")
    .select("departments!inner(code)")
    .eq("employee_id", employee.id)
    .in("departments.code", ATLAS_DEPARTMENT_CODES);
  const departmentCodes = (grants ?? []).map((g) => (g as unknown as { departments: { code: string } }).departments.code);

  const isAuthorized = isAdmin || departmentCodes.length > 0 || Boolean(employee.salesperson_code);
  if (!isAuthorized) {
    redirect(env.hubUrl ?? "/login");
  }

  return {
    employeeId: employee.id,
    fullName: employee.full_name,
    isAdmin,
    departmentCodes,
    salespersonCode: employee.salesperson_code,
  };
}

/** Read-only mirror of private.employee_has_permission, same pattern as apps/hub's
 * requireHubAccess.ts — the RLS-scoped anon client can read permissions/role_permissions
 * directly (open-SELECT reference tables), no edge function needed just to decide what
 * to *show*. Every actual write re-checks this server-side regardless. */
async function hasPermission(
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
