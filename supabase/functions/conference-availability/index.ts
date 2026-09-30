// Public (verify_jwt = false) — what the employee portal's conference calendar shows: the
// active rooms, and when each is taken. Busy time ranges only (room, start, end) for
// confirmed bookings overlapping [from, to) — no event names, no who booked, no details. The
// portal has no login, so it gets exactly enough to see what's free and nothing about other
// people's meetings. Pending requests aren't shown: they don't hold a slot until approved.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/conference.ts";

const MAX_RANGE_DAYS = 62;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const { from, to } = (await req.json().catch(() => ({}))) as { from?: unknown; to?: unknown };
    const start = typeof from === "string" ? new Date(from) : null;
    const end = typeof to === "string" ? new Date(to) : null;
    if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      return jsonResponse({ error: "from and to must be timestamps, from before to" }, 400);
    }
    if (end.getTime() - start.getTime() > MAX_RANGE_DAYS * 24 * 60 * 60 * 1000) {
      return jsonResponse({ error: `The range can be at most ${MAX_RANGE_DAYS} days.` }, 400);
    }

    const [{ data: rooms, error: roomsError }, { data: bookings, error: bookingsError }] = await Promise.all([
      supabaseAdmin.from("conference_rooms").select("id, name, capacity").eq("status", "active").order("name"),
      supabaseAdmin
        .from("conference_bookings")
        .select("room_id, starts_at, ends_at, conference_rooms!inner(status)")
        .eq("status", "confirmed")
        .eq("conference_rooms.status", "active")
        .lt("starts_at", end.toISOString())
        .gt("ends_at", start.toISOString())
        .order("starts_at"),
    ]);
    if (roomsError) return jsonResponse({ error: roomsError.message }, 500);
    if (bookingsError) return jsonResponse({ error: bookingsError.message }, 500);

    return jsonResponse({
      rooms: rooms ?? [],
      busy: (bookings ?? []).map((b) => ({ roomId: b.room_id, startsAt: b.starts_at, endsAt: b.ends_at })),
    });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "availability failed" }, 500);
  }
});
