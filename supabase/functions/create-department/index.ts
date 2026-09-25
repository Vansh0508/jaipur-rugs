// db-management write endpoint for apps/hub's Settings > Departments "Add department"
// action. Gated by the `departments.manage` permission (see requireEmployeePermission in
// ../_shared/authz.ts).

import { createClient } from "npm:@supabase/supabase-js@2";
import { requireEmployeePermission, authzErrorResponse } from "../_shared/authz.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateDepartmentBody {
  name: string;
  code: string;
  parentDepartmentId?: string;
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

    const body = (await req.json()) as Partial<CreateDepartmentBody>;
    const name = body.name?.trim();
    const code = body.code?.trim();

    if (!name || !code) {
      return jsonResponse({ error: "name and code are required" }, 400);
    }

    const { data: created, error: insertError } = await supabaseAdmin
      .from("departments")
      .insert({
        name,
        code,
        parent_department_id: body.parentDepartmentId ?? null,
      })
      .select("id")
      .single();
    if (insertError) {
      if (insertError.code === "23505") {
        return jsonResponse({ error: "A department with this name or code already exists." }, 409);
      }
      return jsonResponse({ error: insertError.message }, 500);
    }
    if (!created) {
      return jsonResponse({ error: "insert failed" }, 500);
    }

    return jsonResponse({ departmentId: created.id }, 201);
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
