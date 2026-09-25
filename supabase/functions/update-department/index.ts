// db-management write endpoint for apps/hub's Settings > Departments row-level "Edit"
// action. Gated by the `departments.manage` permission (see requireEmployeePermission in
// ../_shared/authz.ts).

import { createClient } from "npm:@supabase/supabase-js@2";
import { requireEmployeePermission, authzErrorResponse } from "../_shared/authz.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UpdateDepartmentBody {
  departmentId: string;
  name?: string;
  code?: string;
  parentDepartmentId?: string | null;
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

    const body = (await req.json()) as Partial<UpdateDepartmentBody>;
    if (!body.departmentId) {
      return jsonResponse({ error: "departmentId is required" }, 400);
    }
    if (body.parentDepartmentId === body.departmentId) {
      return jsonResponse({ error: "a department cannot be its own parent" }, 400);
    }

    const update: Record<string, unknown> = {};
    if (body.name !== undefined) update.name = body.name.trim();
    if (body.code !== undefined) update.code = body.code.trim();
    if (body.parentDepartmentId !== undefined) update.parent_department_id = body.parentDepartmentId;

    if (Object.keys(update).length === 0) {
      return jsonResponse({ error: "no fields to update" }, 400);
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("departments")
      .update(update)
      .eq("id", body.departmentId)
      .select("id")
      .maybeSingle();
    if (updateError) {
      if (updateError.code === "23505") {
        return jsonResponse({ error: "A department with this name or code already exists." }, 409);
      }
      return jsonResponse({ error: updateError.message }, 500);
    }
    if (!updated) {
      return jsonResponse({ error: "department not found" }, 404);
    }

    return jsonResponse({ departmentId: updated.id });
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
