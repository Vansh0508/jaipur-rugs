// db-management write endpoint for apps/hub's Settings > Roles row-level "Edit" action.
// Gated by the `roles.manage` permission (see requireEmployeePermission in
// ../_shared/authz.ts).

import { createClient } from "npm:@supabase/supabase-js@2";
import { requireEmployeePermission, authzErrorResponse } from "../_shared/authz.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UpdateRoleBody {
  roleId: string;
  name?: string;
  description?: string | null;
  isGlobal?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    await requireEmployeePermission(supabaseAdmin, supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, req, "roles.manage");

    const body = (await req.json()) as Partial<UpdateRoleBody>;
    if (!body.roleId) {
      return jsonResponse({ error: "roleId is required" }, 400);
    }

    const update: Record<string, unknown> = {};
    if (body.name !== undefined) update.name = body.name.trim();
    if (body.description !== undefined) update.description = body.description?.trim() || null;
    if (body.isGlobal !== undefined) update.is_global = body.isGlobal;

    if (Object.keys(update).length === 0) {
      return jsonResponse({ error: "no fields to update" }, 400);
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("roles")
      .update(update)
      .eq("id", body.roleId)
      .select("id")
      .maybeSingle();
    if (updateError) {
      if (updateError.code === "23505") {
        return jsonResponse({ error: "A role with this name already exists." }, 409);
      }
      return jsonResponse({ error: updateError.message }, 500);
    }
    if (!updated) {
      return jsonResponse({ error: "role not found" }, 404);
    }

    return jsonResponse({ roleId: updated.id });
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
