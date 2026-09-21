import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

// The staff-side authorization primitive for Atlas — same dual-check pattern as
// apps/hub's requireHubAccess (checked here AND independently in proxy.ts, AGENTS.md
// Section 5: a shared session proves "logged in," never "authorized for Atlas"). Atlas
// authorization is "any real reason to be here": org-wide admin, a
// production/shipping/sales department grant, a sales rep with rows in
// employee_salesperson_codes (self-service — see db/orders/010, there's no reliable way
// to derive a name<->code mapping from the ERP feed, so a person adds their own known
// code themselves from /my-access), or — since 2026-09-01's auth consolidation —
// being a territory head/B2B salesperson ("merchant" in this business's own
// vocabulary, not an external customer) with rows in merchant_customer_codes. That last
// case used to be a wholly separate Clerk-based login (apps/atlas/app/merchant/*,
// removed) — now it's just another employee, scoped by RLS to their own customer codes
// like everyone else. Redirects to /my-access on failure — that's the one page whose
// whole job is letting someone with no access yet grant themselves one (a sales code or
// a Management/Production department), so an unauthorized-but-active employee always
// has somewhere useful to land — UNLESS `allowUnauthorized` is set, which is how
// /my-access itself avoids requiring the very access it exists to grant. (Previously
// redirected to the Hub launcher, which has never been deployed anywhere reachable —
// see proxy.ts's matching fix, 2026-09-10, for the dead-end this caused.)

// "management" added 2026-09-05 (self-service, db/orders/011) — directors/managers who
// should see every order, same as production/shipping/sales, but deliberately its own
// department rather than a re-use of "admin" (see that migration's comment).
const ATLAS_DEPARTMENT_CODES = ["production", "shipping", "sales", "management"] as const;

export interface AtlasStaffAccess {
  employeeId: string;
  fullName: string;
  /** From the Supabase Auth user, not the `employees` row (which has no email column) —
   * added 2026-09-10 for the sidebar's profile popover. Null in the (unexpected) case an
   * authenticated Supabase user somehow has no email on the session. */
  email: string | null;
  /** org-wide admin (orders.read.all) — sees every order, can correct stage/shipping on any of them. */
  isAdmin: boolean;
  /** department codes this employee holds ANY grant on, restricted to the ones Atlas cares about. */
  departmentCodes: string[];
  /** true if this employee has any employee_salesperson_codes rows (self-service, db/orders/010). */
  hasSalespersonCodeGrants: boolean;
  /** true if this employee has any merchant_customer_codes rows — a territory head/B2B
   * salesperson scoped to specific ERP customer codes rather than a department. */
  hasCustomerCodeGrants: boolean;
  /** true if this employee belongs to a department that itself holds
   * department_customer_codes rows (db/orders/034) — e.g. Jaipur Living, where the codes
   * are pre-set on the department rather than self-added per employee like Back Ops. */
  hasDepartmentCodeGrants: boolean;
}

export async function requireAtlasStaffAccess(
  supabase: SupabaseClient,
  options: { allowUnauthorized?: boolean } = {},
): Promise<AtlasStaffAccess> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: employee } = await supabase
    .from("employees")
    .select("id, full_name, status, primary_role_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!employee || employee.status !== "active") {
    redirect("/api/force-logout?reason=not_authorized");
  }

  const isAdmin = await hasPermission(supabase, employee.id, employee.primary_role_id, "orders.read.all");

  // Fetched unfiltered (every department grant, not just the ATLAS_DEPARTMENT_CODES
  // ones) so the same round trip can also answer "does any department this employee
  // belongs to hold department_customer_codes rows" below — e.g. Jaipur Living, which
  // is deliberately NOT in ATLAS_DEPARTMENT_CODES (it's code-scoped, not blanket).
  const { data: grants } = await supabase
    .from("department_access_grants")
    .select("department_id, departments!inner(code)")
    .eq("employee_id", employee.id);
  const grantRows = (grants ?? []) as unknown as { department_id: string; departments: { code: string } }[];
  const departmentCodes = grantRows
    .filter((g) => (ATLAS_DEPARTMENT_CODES as readonly string[]).includes(g.departments.code))
    .map((g) => g.departments.code);
  const grantedDepartmentIds = grantRows.map((g) => g.department_id);

  const { count: salespersonCodeCount } = await supabase
    .from("employee_salesperson_codes")
    .select("id", { count: "exact", head: true })
    .eq("employee_id", employee.id);
  const hasSalespersonCodeGrants = Boolean(salespersonCodeCount);

  const { count: customerCodeCount } = await supabase
    .from("merchant_customer_codes")
    .select("id", { count: "exact", head: true })
    .eq("employee_id", employee.id);
  const hasCustomerCodeGrants = Boolean(customerCodeCount);

  let hasDepartmentCodeGrants = false;
  if (grantedDepartmentIds.length > 0) {
    const { count: departmentCodeCount } = await supabase
      .from("department_customer_codes")
      .select("id", { count: "exact", head: true })
      .in("department_id", grantedDepartmentIds);
    hasDepartmentCodeGrants = Boolean(departmentCodeCount);
  }

  const isAuthorized =
    isAdmin || departmentCodes.length > 0 || hasSalespersonCodeGrants || hasCustomerCodeGrants || hasDepartmentCodeGrants;
  if (!isAuthorized && !options.allowUnauthorized) {
    redirect("/my-access?welcome=1");
  }

  return {
    employeeId: employee.id,
    fullName: employee.full_name,
    email: user.email ?? null,
    isAdmin,
    departmentCodes,
    hasSalespersonCodeGrants,
    hasCustomerCodeGrants,
    hasDepartmentCodeGrants,
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
