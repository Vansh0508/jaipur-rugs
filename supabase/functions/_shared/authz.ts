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
