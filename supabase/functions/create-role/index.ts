// db-management write endpoint for apps/hub's Settings > Roles "Add role" action. Gated by
// the `roles.manage` permission (see requireEmployeePermission in ../_shared/authz.ts).

import { createClient } from "npm:@supabase/supabase-js@2";
import { requireEmployeePermission, authzErrorResponse } from "../_shared/authz.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateRoleBody {
  name: string;
  description?: string;
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

    const body = (await req.json()) as Partial<CreateRoleBody>;
    const name = body.name?.trim();

    if (!name) {
      return jsonResponse({ error: "name is required" }, 400);
    }

    const { data: created, error: insertError } = await supabaseAdmin
      .from("roles")
      .insert({
        name,
        description: body.description?.trim() || null,
        is_global: body.isGlobal ?? false,
      })
      .select("id")
      .single();
    if (insertError) {
      if (insertError.code === "23505") {
        return jsonResponse({ error: "A role with this name already exists." }, 409);
      }
      return jsonResponse({ error: insertError.message }, 500);
    }
    if (!created) {
      return jsonResponse({ error: "insert failed" }, 500);
    }

    return jsonResponse({ roleId: created.id }, 201);
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
