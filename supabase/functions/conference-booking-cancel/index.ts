// db-management write endpoint: cancel a conference booking. Internal Portal admin only.
// Cancelling frees the slot (the exclusion constraint only covers confirmed bookings) but
// keeps the row, so the history stays. A booking that has already finished can't be
// cancelled (409) — it happened.

import { createClient } from "npm:@supabase/supabase-js@2";
import { requireInternalPortalAdmin, authzErrorResponse } from "../_shared/authz.ts";
import { corsHeaders, jsonResponse } from "../_shared/conference.ts";

interface CancelBookingBody {
  bookingId: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    await requireInternalPortalAdmin(supabaseAdmin, supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, req);

    const { bookingId } = (await req.json()) as Partial<CancelBookingBody>;
    if (!bookingId) {
      return jsonResponse({ error: "bookingId is required" }, 400);
    }

    const { data: booking, error: bookingError } = await supabaseAdmin
      .from("conference_bookings")
      .select("id, status, ends_at")
      .eq("id", bookingId)
      .maybeSingle();
    if (bookingError) return jsonResponse({ error: bookingError.message }, 500);
    if (!booking) return jsonResponse({ error: "booking not found" }, 404);
    if (booking.status === "cancelled") {
      return jsonResponse({ error: "This booking is already cancelled." }, 409);
    }
    if (new Date(booking.ends_at) <= new Date()) {
      return jsonResponse({ error: "This booking has already finished and can't be cancelled." }, 409);
    }

    const nowIso = new Date().toISOString();
    const { data: updated, error: updateError } = await supabaseAdmin
      .from("conference_bookings")
      .update({ status: "cancelled", cancelled_at: nowIso, updated_at: nowIso })
      .eq("id", bookingId)
      .select("id, status")
      .single();
    if (updateError || !updated) {
      return jsonResponse({ error: updateError?.message ?? "cancel failed" }, 500);
    }

    return jsonResponse(updated);
  } catch (err) {
    return authzErrorResponse(err, corsHeaders);
  }
});
