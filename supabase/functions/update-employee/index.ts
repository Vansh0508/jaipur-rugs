// db-management write endpoint for apps/hub's Team page row-level "Edit" action — sets an
// employee's department/manager/role/employment type/status. Gated by the
// `employees.write` permission (see requireEmployeePermission in ../_shared/authz.ts).
// Unlike invite-employee this never touches email/full_name/employee_code — those are
// identity fields, not the "org-chart admin" fields this action is for.

import { createClient } from "npm:@supabase/supabase-js@2";
import { requireEmployeePermission, authzErrorResponse } from "../_shared/authz.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UpdateEmployeeBody {
  employeeId: string;
  departmentId?: string | null;
  managerId?: string | null;
  primaryRoleId?: string | null;
  employmentType?: "full_time" | "part_time" | "contract" | "intern" | "consultant";
  status?: "invited" | "active" | "inactive" | "on_leave" | "offboarded";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    await requireEmployeePermission(
      supabaseAdmin,
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      req,
      "employees.write",
    );

    const body = (await req.json()) as Partial<UpdateEmployeeBody>;
    if (!body.employeeId) {
      return jsonResponse({ error: "employeeId is required" }, 400);
    }
    if (body.managerId === body.employeeId) {
      return jsonResponse({ error: "an employee cannot be their own manager" }, 400);
    }

    const update: Record<string, unknown> = {};
    if (body.departmentId !== undefined) update.department_id = body.departmentId;
    if (body.managerId !== undefined) update.manager_id = body.managerId;
    if (body.primaryRoleId !== undefined) update.primary_role_id = body.primaryRoleId;
    if (body.employmentType !== undefined) update.employment_type = body.employmentType;
    if (body.status !== undefined) update.status = body.status;

    if (Object.keys(update).length === 0) {
      return jsonResponse({ error: "no fields to update" }, 400);
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("employees")
      .update(update)
      .eq("id", body.employeeId)
      .select("id")
      .maybeSingle();
    if (updateError) {
      return jsonResponse({ error: updateError.message }, 500);
    }
    if (!updated) {
      return jsonResponse({ error: "employee not found" }, 404);
    }

    return jsonResponse({ employeeId: updated.id });
  } catch (err) {
    return authzErrorResponse(err, corsHeaders);
  }
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
