// db-management write endpoint for apps/hub's Team page "Add team member" action. Gated by
// the `employees.write` permission (see requireEmployeePermission in ../_shared/authz.ts).
// Creates a `status: 'invited'` row with no auth_user_id — employee_code allocated from
// employee_code_seq via next_employee_code(), same race-free pattern as create-driver's
// driver_code allocation. This composes with open signup (employee-signup): if the
// invited person later signs up with this exact email, that function claims this row
// instead of creating a duplicate, preserving whatever department/manager/role is set here.

import { createClient } from "npm:@supabase/supabase-js@2";
import { requireEmployeePermission, authzErrorResponse } from "../_shared/authz.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InviteEmployeeBody {
  fullName: string;
  email: string;
  departmentId?: string;
  managerId?: string;
  primaryRoleId?: string;
  employmentType?: "full_time" | "part_time" | "contract" | "intern" | "consultant";
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

    const body = (await req.json()) as Partial<InviteEmployeeBody>;
    const fullName = body.fullName?.trim();
    const email = body.email?.trim().toLowerCase();

    if (!fullName || !email) {
      return jsonResponse({ error: "fullName and email are required" }, 400);
    }

    const { data: existing, error: lookupError } = await supabaseAdmin
      .from("employees")
      .select("id")
      .ilike("email", email)
      .maybeSingle();
    if (lookupError) {
      return jsonResponse({ error: lookupError.message }, 500);
    }
    if (existing) {
      return jsonResponse({ error: "An employee with this email already exists." }, 409);
    }

    const { data: employeeCode, error: codeError } = await supabaseAdmin.rpc("next_employee_code");
    if (codeError || !employeeCode) {
      return jsonResponse({ error: codeError?.message ?? "failed to allocate employee_code" }, 500);
    }

    const { data: created, error: insertError } = await supabaseAdmin
      .from("employees")
      .insert({
        employee_code: employeeCode,
        full_name: fullName,
        email,
        department_id: body.departmentId ?? null,
        manager_id: body.managerId ?? null,
        primary_role_id: body.primaryRoleId ?? null,
        employment_type: body.employmentType ?? "full_time",
        status: "invited",
      })
      .select("id, employee_code")
      .single();
    if (insertError || !created) {
      return jsonResponse({ error: insertError?.message ?? "insert failed" }, 500);
    }

    return jsonResponse({ employeeId: created.id, employeeCode: created.employee_code }, 201);
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
