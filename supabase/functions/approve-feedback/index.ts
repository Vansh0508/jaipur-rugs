// db-management write endpoint: approve or reject an unplanned-ride feedback submission
// (fraud-prevention — an unplanned review has no journey record to corroborate it, so it
// sits `review_status='pending'` until an admin acts on it). Internal Portal admin only,
// see ../_shared/authz.ts — also records who decided and when.

import { createClient } from "npm:@supabase/supabase-js@2";
import { requireInternalPortalAdmin, authzErrorResponse } from "../_shared/authz.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ApproveFeedbackBody {
  feedbackId: string;
  decision: "approved" | "rejected";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const { employeeId } = await requireInternalPortalAdmin(
      supabaseAdmin,
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      req,
    );

    const body = (await req.json()) as Partial<ApproveFeedbackBody>;
    const { feedbackId, decision } = body;

    if (!feedbackId || !decision) {
      return jsonResponse({ error: "feedbackId and decision are required" }, 400);
    }
    if (decision !== "approved" && decision !== "rejected") {
      return jsonResponse({ error: "decision must be 'approved' or 'rejected'" }, 400);
    }

    const { data: updated, error } = await supabaseAdmin
      .from("feedback")
      .update({ review_status: decision, reviewed_by: employeeId, reviewed_at: new Date().toISOString() })
      .eq("id", feedbackId)
      .eq("review_status", "pending")
      .select("id, review_status")
      .maybeSingle();

    if (error) {
      return jsonResponse({ error: error.message }, 500);
    }
    if (!updated) {
      return jsonResponse({ error: "feedback not found, or not pending" }, 404);
    }

    return jsonResponse({ id: updated.id, reviewStatus: updated.review_status });
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
