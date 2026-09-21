import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

// The app's authorization primitive, checked in two places on purpose (AGENTS.md Section
// 5 — "every app independently re-verifies... on load"): once in proxy.ts (route gating)
// and again at the top of app/(shell)/layout.tsx. A shared session proves "logged in,"
// never "authorized for this app."
//
// Access model (PRD Section 8.5, confirmed 2026-09-18): any ACTIVE employee can use the
// tool and sees only their own records; the `cad_layout.admin` permission (via the
// employee's primary role or a current employee_roles row — same vocabulary as
// private.employee_has_permission) unlocks every record plus the usage view.

export const CAD_LAYOUT_ADMIN_PERMISSION = "cad_layout.admin";

export interface CadLayoutEmployee {
  employeeId: string;
  authUserId: string;
  fullName: string;
  email: string;
  isAdmin: boolean;
}

/** Redirect-free variant for Route Handlers: null when there's no session, "unauthorized" for a non-active account. */
export async function getCadLayoutEmployee(supabase: SupabaseClient): Promise<CadLayoutEmployee | null | "unauthorized"> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: employee } = await supabase
    .from("employees")
    .select("id, full_name, email, status, primary_role_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!employee || employee.status !== "active") return "unauthorized";

  return {
    employeeId: employee.id,
    authUserId: user.id,
    fullName: employee.full_name,
    email: employee.email,
    isAdmin: await hasCadLayoutAdmin(supabase, employee.id, employee.primary_role_id),
  };
}

export async function requireCadLayoutAccess(supabase: SupabaseClient): Promise<CadLayoutEmployee> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: employee } = await supabase
    .from("employees")
    .select("id, full_name, email, status, primary_role_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!employee || employee.status !== "active") {
    redirect("/api/force-logout?reason=not_authorized");
  }

  return {
    employeeId: employee.id,
    authUserId: user.id,
    fullName: employee.full_name,
    email: employee.email,
    isAdmin: await hasCadLayoutAdmin(supabase, employee.id, employee.primary_role_id),
  };
}

/** Read-side mirror of employee_has_permission(emp, 'cad_layout.admin') using the RLS-visible tables. */
export async function hasCadLayoutAdmin(
  supabase: SupabaseClient,
  employeeId: string,
  primaryRoleId: string | null,
): Promise<boolean> {
  const { data: permission } = await supabase
    .from("permissions")
    .select("id")
    .eq("key", CAD_LAYOUT_ADMIN_PERMISSION)
    .maybeSingle();
  if (!permission) return false;

  const roleIds = new Set<string>();
  if (primaryRoleId) roleIds.add(primaryRoleId);
  const today = new Date().toISOString().slice(0, 10);
  const { data: assignments } = await supabase
    .from("employee_roles")
    .select("role_id, valid_from, valid_to")
    .eq("employee_id", employeeId)
    .lte("valid_from", today);
  for (const a of assignments ?? []) {
    if (!a.valid_to || a.valid_to >= today) roleIds.add(a.role_id);
  }
  if (roleIds.size === 0) return false;

  const { data: bindings } = await supabase
    .from("role_permissions")
    .select("id")
    .eq("permission_id", permission.id)
    .in("role_id", [...roleIds])
    .limit(1);
  return Boolean(bindings && bindings.length > 0);
}
