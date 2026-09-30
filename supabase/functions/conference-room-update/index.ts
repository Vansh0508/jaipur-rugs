// db-management write endpoint: edit a conference room — rename it, change its capacity,
// and "remove" or restore it (status inactive / active; a soft-delete, since bookings keep
// a foreign key to the room). Internal Portal admin only. Every field but roomId is
// optional; `capacity: null` clears the limit, while omitting it leaves it alone.
//
// Removing (status → inactive) is blocked (409) while the room still has confirmed bookings
// that haven't finished — removing a room out from under a booked meeting is always a
// mistake; cancel those bookings first. (Finished bookings are history and don't block.)

import { createClient } from "npm:@supabase/supabase-js@2";
import { requireInternalPortalAdmin, authzErrorResponse } from "../_shared/authz.ts";
import { corsHeaders, jsonResponse, UNIQUE_VIOLATION } from "../_shared/conference.ts";

const STATUSES = ["active", "inactive"] as const;

interface UpdateRoomBody {
  roomId: string;
  name?: string;
  capacity?: number | null;
  status?: (typeof STATUSES)[number];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    await requireInternalPortalAdmin(supabaseAdmin, supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, req);

    const body = (await req.json()) as Partial<UpdateRoomBody>;
    const { roomId } = body;
    if (!roomId) {
      return jsonResponse({ error: "roomId is required" }, 400);
    }

    const changes: Record<string, unknown> = {};
    if (body.name !== undefined) {
      const name = body.name.trim();
      if (!name) return jsonResponse({ error: "name can't be empty" }, 400);
      changes.name = name;
    }
    if (body.capacity !== undefined) {
      if (body.capacity !== null && (!Number.isInteger(body.capacity) || body.capacity < 1)) {
        return jsonResponse({ error: "capacity must be a whole number of at least 1, or null" }, 400);
      }
      changes.capacity = body.capacity;
    }
    if (body.status !== undefined) {
      if (!STATUSES.includes(body.status)) {
        return jsonResponse({ error: `status must be one of ${STATUSES.join(", ")}` }, 400);
      }
      changes.status = body.status;
    }
    if (Object.keys(changes).length === 0) {
      return jsonResponse({ error: "nothing to update" }, 400);
    }

    if (body.status === "inactive") {
      const { count, error: upcomingError } = await supabaseAdmin
        .from("conference_bookings")
        .select("id", { count: "exact", head: true })
        .eq("room_id", roomId)
        .eq("status", "confirmed")
        .gt("ends_at", new Date().toISOString());
      if (upcomingError) {
        return jsonResponse({ error: upcomingError.message }, 500);
      }
      if (count && count > 0) {
        return jsonResponse(
          {
            error: `This room has ${count} upcoming ${count === 1 ? "booking" : "bookings"} — cancel ${count === 1 ? "it" : "them"} before removing the room.`,
          },
          409,
        );
      }
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("conference_rooms")
      .update({ ...changes, updated_at: new Date().toISOString() })
      .eq("id", roomId)
      .select("id, name, capacity, status")
      .maybeSingle();

    if (updateError) {
      if (updateError.code === UNIQUE_VIOLATION) {
        return jsonResponse({ error: "A conference room with this name already exists." }, 409);
      }
      return jsonResponse({ error: updateError.message }, 500);
    }
    if (!updated) {
      return jsonResponse({ error: "conference room not found" }, 404);
    }

    return jsonResponse(updated);
  } catch (err) {
    return authzErrorResponse(err, corsHeaders);
  }
});
