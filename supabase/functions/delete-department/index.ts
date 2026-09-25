// db-management write endpoint for apps/hub's Settings > Departments row-level "Delete"
// action. Gated by the `departments.manage` permission (see requireEmployeePermission in
// ../_shared/authz.ts). Postgres's default NO ACTION foreign-key behavior already blocks
// deleting a department still referenced by employees/employee_roles/
// department_access_grants/other departments' parent_department_id — this just turns that
// into a friendly 409 instead of a raw 500.

import { createClient } from "npm:@supabase/supabase-js@2";
import { requireEmployeePermission, authzErrorResponse } from "../_shared/authz.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DeleteDepartmentBody {
  departmentId: string;
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
      "departments.manage",
    );

    const body = (await req.json()) as Partial<DeleteDepartmentBody>;
    if (!body.departmentId) {
      return jsonResponse({ error: "departmentId is required" }, 400);
    }

    const { data: deleted, error: deleteError } = await supabaseAdmin
      .from("departments")
      .delete()
      .eq("id", body.departmentId)
      .select("id")
      .maybeSingle();
    if (deleteError) {
      if (deleteError.code === "23503") {
        return jsonResponse({ error: "This department is still in use and can't be deleted." }, 409);
      }
      return jsonResponse({ error: deleteError.message }, 500);
    }
    if (!deleted) {
      return jsonResponse({ error: "department not found" }, 404);
    }

    return jsonResponse({ departmentId: deleted.id });
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
