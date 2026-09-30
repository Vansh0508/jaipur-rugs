// db-management write endpoint: add a conference room (a venue). Internal Portal admin only,
// see ../_shared/authz.ts. Names are unique case-insensitively (conference_rooms_name_key) —
// a duplicate is a 409 with a message, not a 500.

import { createClient } from "npm:@supabase/supabase-js@2";
import { requireInternalPortalAdmin, authzErrorResponse } from "../_shared/authz.ts";
import { corsHeaders, jsonResponse, UNIQUE_VIOLATION } from "../_shared/conference.ts";

interface CreateRoomBody {
  name: string;
  /** Optional seating limit; omit or null for "not recorded". */
  capacity?: number | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    await requireInternalPortalAdmin(supabaseAdmin, supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, req);

    const body = (await req.json()) as Partial<CreateRoomBody>;
    const name = body.name?.trim();
    const capacity = body.capacity ?? null;

    if (!name) {
      return jsonResponse({ error: "name is required" }, 400);
    }
    if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1)) {
      return jsonResponse({ error: "capacity must be a whole number of at least 1" }, 400);
    }

    const { data: created, error: insertError } = await supabaseAdmin
      .from("conference_rooms")
      .insert({ name, capacity })
      .select("id")
      .single();

    if (insertError || !created) {
      if (insertError?.code === UNIQUE_VIOLATION) {
        return jsonResponse({ error: "A conference room with this name already exists." }, 409);
      }
      return jsonResponse({ error: insertError?.message ?? "insert failed" }, 500);
    }

    return jsonResponse({ id: created.id }, 201);
  } catch (err) {
    return authzErrorResponse(err, corsHeaders);
  }
});
