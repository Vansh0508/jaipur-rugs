// db-management endpoint: starts (or reuses) the caller's own login_sessions row.
// Self-service, always the CALLER'S OWN account (resolved from the JWT) — same posture
// as update-own-profile. Called client-side once per browser tab on app load (see
// apps/atlas/components/shell/SessionTracker.tsx).
//
// Reuses an existing OPEN session (ended_at is null) whose last_heartbeat_at is within
// the last 20 minutes, rather than inserting a new row on every page load/navigation —
// that 20-minute window is deliberately wider than the ~5-minute heartbeat interval, so a
// brief network hiccup or a tab left in the background doesn't fragment one real visit
// into several rows. Anything older than that is treated as a genuinely new session
// (the old row is left as-is with whatever last_heartbeat_at it last reached — that IS
// its real end time for analytics purposes, see login_session_summary).

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const REUSE_WINDOW_MINUTES = 20;

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
      .select("id, status")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (employeeError) {
      return jsonResponse({ error: employeeError.message }, 500);
    }
    if (!employee || employee.status !== "active") {
      return jsonResponse({ error: "no active employee record for this account" }, 403);
    }

    const reuseCutoff = new Date(Date.now() - REUSE_WINDOW_MINUTES * 60_000).toISOString();
    const { data: existing, error: existingError } = await supabaseAdmin
      .from("login_sessions")
      .select("id, started_at")
      .eq("employee_id", employee.id)
      .is("ended_at", null)
      .gt("last_heartbeat_at", reuseCutoff)
      .order("last_heartbeat_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingError) {
      return jsonResponse({ error: existingError.message }, 500);
    }

    if (existing) {
      return jsonResponse({ sessionId: existing.id, startedAt: existing.started_at, reused: true });
    }

    const { data: created, error: insertError } = await supabaseAdmin
      .from("login_sessions")
      .insert({ employee_id: employee.id, auth_user_id: user.id })
      .select("id, started_at")
      .single();
    if (insertError || !created) {
      return jsonResponse({ error: insertError?.message ?? "insert failed" }, 500);
    }

    return jsonResponse({ sessionId: created.id, startedAt: created.started_at, reused: false }, 201);
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
