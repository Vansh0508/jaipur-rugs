// db-management endpoint for apps/hub: open self-service sign-up — the actual Supabase
// Auth user is created here (via the Admin API), not by the client calling
// supabase.auth.signUp() directly, so an unmatched signup can't leave an orphaned
// auth.users row with no employees record. See db/team-members/006_hub_onboarding_and_admin.sql.
//
// Three cases, matched by lowercased email against `employees`:
//   1. A row already has auth_user_id set  -> reject, "sign in instead."
//   2. A row exists but auth_user_id is null (created by invite-employee, status
//      'invited') -> claim it: create the auth user, link auth_user_id, flip to 'active'.
//      Whatever department/manager/role an admin pre-set is preserved.
//   3. No row at all -> open signup: allocate an employee_code and create a fresh row.
// Either way this never issues a session — the client calls signInWithPassword itself
// right after, mirroring how every other write function here stays session-free.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmployeeSignUpBody {
  email: string;
  password: string;
  fullName: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as Partial<EmployeeSignUpBody>;
    const email = body.email?.trim().toLowerCase();
    const password = body.password;
    const fullName = body.fullName?.trim();

    if (!email || !password || !fullName) {
      return jsonResponse({ error: "email, password, and fullName are required" }, 400);
    }
    if (password.length < 8) {
      return jsonResponse({ error: "password must be at least 8 characters" }, 400);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: existing, error: lookupError } = await supabaseAdmin
      .from("employees")
      .select("id, auth_user_id, status")
      .ilike("email", email)
      .maybeSingle();
    if (lookupError) {
      return jsonResponse({ error: lookupError.message }, 500);
    }

    if (existing?.auth_user_id) {
      return jsonResponse({ error: "An account already exists for this email. Try signing in instead." }, 409);
    }

    const { data: created, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createUserError || !created?.user) {
      return jsonResponse({ error: createUserError?.message ?? "failed to create account" }, 500);
    }
    const authUserId = created.user.id;

    if (existing) {
      // Case 2: claim a pre-invited row — preserve whatever department/manager/role an
      // admin already set, just link the account and mark it active.
      const { error: linkError } = await supabaseAdmin
        .from("employees")
        .update({ auth_user_id: authUserId, status: existing.status === "invited" ? "active" : existing.status })
        .eq("id", existing.id);
      if (linkError) {
        return jsonResponse({ error: linkError.message }, 500);
      }
      return jsonResponse({ employeeId: existing.id }, 200);
    }

    // Case 3: no pre-invited row — open signup, create one from scratch.
    const { data: employeeCode, error: codeError } = await supabaseAdmin.rpc("next_employee_code");
    if (codeError || !employeeCode) {
      return jsonResponse({ error: codeError?.message ?? "failed to allocate employee_code" }, 500);
    }

    const { data: employee, error: insertError } = await supabaseAdmin
      .from("employees")
      .insert({
        auth_user_id: authUserId,
        employee_code: employeeCode,
        full_name: fullName,
        email,
        status: "active",
        employment_type: "full_time",
      })
      .select("id")
      .single();
    if (insertError || !employee) {
      return jsonResponse({ error: insertError?.message ?? "insert failed" }, 500);
    }

    return jsonResponse({ employeeId: employee.id }, 201);
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
