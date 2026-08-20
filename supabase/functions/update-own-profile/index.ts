// db-management endpoint for apps/hub: self-service update of the caller's own employee
// row. Used by two call sites — the onboarding wizard's last step (which also completes
// onboarding) and later edits from /profile — one function, not two, since both are "the
// caller updates their own row" with the same field set.
//
// No permission check: this only ever touches the row whose auth_user_id matches the
// caller's own JWT, which is what `employees_write`'s RLS policy comment (see
// db/team-members/001_team_members_schema.sql) calls "no self-service path... flagged as
// an open decision, not built" — this function IS that decision, implemented the same way
// every other write in this repo is (service-role client + an authz check in code, not a
// new RLS policy), so self-service can never accidentally reach another employee's row.
//
// Sets onboarding_completed_at the first time this is called for a given employee (it's
// null until then) — subsequent calls (later profile edits) leave it untouched since it's
// already set.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UpdateOwnProfileBody {
  phone?: string;
  employmentType?: "full_time" | "part_time" | "contract" | "intern" | "consultant";
  departmentId?: string;
  joinedAt?: string;
  avatarPath?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "missing Authorization header" }, 401);
    }

    const anonClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const {
      data: { user },
      error: userError,
    } = await anonClient.auth.getUser();
    if (userError || !user) {
      return jsonResponse({ error: "not authenticated" }, 401);
    }

    const { data: employee, error: employeeError } = await supabaseAdmin
      .from("employees")
      .select("id, onboarding_completed_at")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (employeeError) {
      return jsonResponse({ error: employeeError.message }, 500);
    }
    if (!employee) {
      return jsonResponse({ error: "no employee record for this account" }, 403);
    }

    const body = (await req.json()) as UpdateOwnProfileBody;
    const update: Record<string, unknown> = {};
    if (body.phone !== undefined) update.phone = body.phone.trim();
    if (body.employmentType !== undefined) update.employment_type = body.employmentType;
    if (body.departmentId !== undefined) update.department_id = body.departmentId;
    if (body.joinedAt !== undefined) update.joined_at = body.joinedAt;
    if (body.avatarPath !== undefined) update.avatar_path = body.avatarPath;
    if (!employee.onboarding_completed_at) {
      update.onboarding_completed_at = new Date().toISOString();
    }

    const { error: updateError } = await supabaseAdmin.from("employees").update(update).eq("id", employee.id);
    if (updateError) {
      return jsonResponse({ error: updateError.message }, 500);
    }

    return jsonResponse({ employeeId: employee.id });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "unexpected error" }, 500);
  }
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
