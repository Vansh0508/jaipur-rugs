// Shared by every Internal Portal write function (create-car, update-car-status,
// create-driver, create-journey, update-journey, cancel-journey, approve-feedback, and
// submit-feedback's approval path). Verifies the caller's session JWT, then checks
// private.is_internal_portal_admin(emp_id) via plain table reads — the private.* SQL
// functions aren't PostgREST-exposed to ANY caller, service-role included (that's a
// schema-exposure restriction, not an RLS one), so this re-implements the same check as
// two ordinary queries instead of calling the SQL helper directly.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

export class AuthzError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export interface AuthorizedEmployee {
  employeeId: string;
  authUserId: string;
}

/**
 * The minimal gate: any active employee, no permission/department check. Used for
 * Atlas actions that are intentionally open to any signed-in staff member — filing a
 * work request (order punch, warehouse create, QC review) is the write-side equivalent
 * of "any back-ops person can email order@ today," not something that needs a
 * department grant. Actioning a request (marking it done) still goes through
 * requireAtlasAccess with the owning department — this only gates *filing*.
 */
export async function requireActiveEmployee(
  supabaseAdmin: SupabaseClient,
  supabaseUrl: string,
  anonKey: string,
  req: Request,
): Promise<AuthorizedEmployee> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    throw new AuthzError("missing Authorization header", 401);
  }
  const anonClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: userError,
  } = await anonClient.auth.getUser();
  if (userError || !user) {
    throw new AuthzError("not authenticated", 401);
  }
  const { data: employee, error: employeeError } = await supabaseAdmin
    .from("employees")
    .select("id, status")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (employeeError) {
    throw new AuthzError(employeeError.message, 500);
  }
  if (!employee || employee.status !== "active") {
    throw new AuthzError("no active employee record for this account", 403);
  }
  return { employeeId: employee.id, authUserId: user.id };
}

/**
 * Verifies the request carries a valid session for an active employee who holds an
 * admin-level department_access_grants row on the 'admin' department — the single
 * authorization primitive for the whole Internal Portal (mirrors
 * private.is_internal_portal_admin, see db/journeys/003_journey_admin_helpers_and_write_functions.sql).
 */
export async function requireInternalPortalAdmin(
  supabaseAdmin: SupabaseClient,
  supabaseUrl: string,
  anonKey: string,
  req: Request,
): Promise<AuthorizedEmployee> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    throw new AuthzError("missing Authorization header", 401);
  }

  const anonClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: userError,
  } = await anonClient.auth.getUser();
  if (userError || !user) {
    throw new AuthzError("not authenticated", 401);
  }

  const { data: employee, error: employeeError } = await supabaseAdmin
    .from("employees")
    .select("id, status")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (employeeError) {
    throw new AuthzError(employeeError.message, 500);
  }
  if (!employee || employee.status !== "active") {
    throw new AuthzError("no active employee record for this account", 403);
  }

  const { data: grant, error: grantError } = await supabaseAdmin
    .from("department_access_grants")
    .select("id, departments!inner(code)")
    .eq("employee_id", employee.id)
    .eq("access_level", "admin")
    .eq("departments.code", "admin")
    .maybeSingle();
  if (grantError) {
    throw new AuthzError(grantError.message, 500);
  }
  if (!grant) {
    throw new AuthzError("not authorized for the Internal Portal", 403);
  }

  return { employeeId: employee.id, authUserId: user.id };
}

/**
 * Verifies the request carries a valid session for an active employee who holds the given
 * permission — either via their `primary_role_id` or a current (not yet expired)
 * `employee_roles` row. Used by apps/hub's Team-management functions (invite-employee,
 * update-employee), the generalized counterpart to requireInternalPortalAdmin above (which
 * is deliberately narrower — one hardcoded department_access_grants check — since that's
 * the only primitive the Internal Portal module needed).
 *
 * Re-implements employee_has_permission (private.employee_has_permission in Postgres) as
 * plain queries rather than calling it — same reason requireInternalPortalAdmin already
 * re-implements its own check: functions in the `private` schema aren't PostgREST-exposed
 * to any caller, service-role included.
 */
export async function requireEmployeePermission(
  supabaseAdmin: SupabaseClient,
  supabaseUrl: string,
  anonKey: string,
  req: Request,
  permissionKey: string,
): Promise<AuthorizedEmployee> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    throw new AuthzError("missing Authorization header", 401);
  }

  const anonClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: userError,
  } = await anonClient.auth.getUser();
  if (userError || !user) {
    throw new AuthzError("not authenticated", 401);
  }

  const { data: employee, error: employeeError } = await supabaseAdmin
    .from("employees")
    .select("id, status, primary_role_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (employeeError) {
    throw new AuthzError(employeeError.message, 500);
  }
  if (!employee || employee.status !== "active") {
    throw new AuthzError("no active employee record for this account", 403);
  }

  const { data: permission, error: permissionError } = await supabaseAdmin
    .from("permissions")
    .select("id")
    .eq("key", permissionKey)
    .maybeSingle();
  if (permissionError) {
    throw new AuthzError(permissionError.message, 500);
  }
  if (!permission) {
    throw new AuthzError(`unknown permission key: ${permissionKey}`, 500);
  }

  if (employee.primary_role_id) {
    const { data: viaPrimaryRole, error: primaryRoleError } = await supabaseAdmin
      .from("role_permissions")
      .select("id")
      .eq("role_id", employee.primary_role_id)
      .eq("permission_id", permission.id)
      .maybeSingle();
    if (primaryRoleError) {
      throw new AuthzError(primaryRoleError.message, 500);
    }
    if (viaPrimaryRole) {
      return { employeeId: employee.id, authUserId: user.id };
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const { data: employeeRoles, error: employeeRolesError } = await supabaseAdmin
    .from("employee_roles")
    .select("role_id, valid_from, valid_to")
    .eq("employee_id", employee.id)
    .lte("valid_from", today);
  if (employeeRolesError) {
    throw new AuthzError(employeeRolesError.message, 500);
  }
  const currentRoleIds = (employeeRoles ?? [])
    .filter((er) => !er.valid_to || er.valid_to >= today)
    .map((er) => er.role_id);

  if (currentRoleIds.length > 0) {
    const { data: viaAssignedRole, error: assignedRoleError } = await supabaseAdmin
      .from("role_permissions")
      .select("id")
      .in("role_id", currentRoleIds)
      .eq("permission_id", permission.id)
      .maybeSingle();
    if (assignedRoleError) {
      throw new AuthzError(assignedRoleError.message, 500);
    }
    if (viaAssignedRole) {
      return { employeeId: employee.id, authUserId: user.id };
    }
  }

  throw new AuthzError(`missing required permission: ${permissionKey}`, 403);
}

/**
 * Atlas module (apps/atlas) authorization — mirrors requireEmployeePermission's shape but
 * additionally accepts department_access_grants on any of the given department codes
 * (production/shipping/sales), not just a permission key. Used by
 * orders-update-stage/orders-set-shipping-detail: admin (orders.write.all) or a grant on
 * the department that owns the field being written.
 *
 * Re-implements the check as plain queries rather than calling
 * private.has_atlas_department_access/private.employee_has_permission directly, for the
 * same reason requireInternalPortalAdmin does — private.* functions aren't
 * PostgREST-exposed to any caller, service-role included.
 */
export async function requireAtlasAccess(
  supabaseAdmin: SupabaseClient,
  supabaseUrl: string,
  anonKey: string,
  req: Request,
  options: { permissionKey?: string; departmentCodes?: string[] } = {},
): Promise<AuthorizedEmployee> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    throw new AuthzError("missing Authorization header", 401);
  }

  const anonClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: userError,
  } = await anonClient.auth.getUser();
  if (userError || !user) {
    throw new AuthzError("not authenticated", 401);
  }

  const { data: employee, error: employeeError } = await supabaseAdmin
    .from("employees")
    .select("id, status, primary_role_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (employeeError) {
    throw new AuthzError(employeeError.message, 500);
  }
  if (!employee || employee.status !== "active") {
    throw new AuthzError("no active employee record for this account", 403);
  }

  if (options.permissionKey) {
    const { data: permission } = await supabaseAdmin
      .from("permissions")
      .select("id")
      .eq("key", options.permissionKey)
      .maybeSingle();
    if (permission) {
      if (employee.primary_role_id) {
        const { data: viaPrimaryRole } = await supabaseAdmin
          .from("role_permissions")
          .select("id")
          .eq("role_id", employee.primary_role_id)
          .eq("permission_id", permission.id)
          .maybeSingle();
        if (viaPrimaryRole) return { employeeId: employee.id, authUserId: user.id };
      }
      const today = new Date().toISOString().slice(0, 10);
      const { data: employeeRoles } = await supabaseAdmin
        .from("employee_roles")
        .select("role_id, valid_from, valid_to")
        .eq("employee_id", employee.id)
        .lte("valid_from", today);
      const currentRoleIds = (employeeRoles ?? [])
        .filter((er) => !er.valid_to || er.valid_to >= today)
        .map((er) => er.role_id);
      if (currentRoleIds.length > 0) {
        const { data: viaAssignedRole } = await supabaseAdmin
          .from("role_permissions")
          .select("id")
          .in("role_id", currentRoleIds)
          .eq("permission_id", permission.id)
          .maybeSingle();
        if (viaAssignedRole) return { employeeId: employee.id, authUserId: user.id };
      }
    }
  }

  if (options.departmentCodes?.length) {
    const { data: grant, error: grantError } = await supabaseAdmin
      .from("department_access_grants")
      .select("id, access_level, departments!inner(code)")
      .eq("employee_id", employee.id)
      .in("departments.code", options.departmentCodes)
      .in("access_level", ["manage", "admin"])
      .maybeSingle();
    if (grantError) {
      throw new AuthzError(grantError.message, 500);
    }
    if (grant) {
      return { employeeId: employee.id, authUserId: user.id };
    }
  }

  throw new AuthzError("not authorized for this Atlas action", 403);
}

/** Converts a thrown AuthzError (or anything else) into a JSON error Response. */
export function authzErrorResponse(err: unknown, corsHeaders: Record<string, string>): Response {
  if (err instanceof AuthzError) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: err.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return new Response(
    JSON.stringify({ error: err instanceof Error ? err.message : "unexpected error" }),
    { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}
