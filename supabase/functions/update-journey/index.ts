// db-management write endpoint: edit an existing journey. Same validation and payload
// shape as create-journey; delegates to public.update_journey via .rpc(), which replaces
// the journey's guests/stops wholesale (delete + reinsert) inside one transaction and
// re-validates the same car/driver double-booking EXCLUDE constraints on the update.
// Internal Portal admin only, see ../_shared/authz.ts.

import { createClient } from "npm:@supabase/supabase-js@2";
import { requireInternalPortalAdmin, authzErrorResponse } from "../_shared/authz.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface JourneyGuestInput {
  guestId?: string;
  fullName?: string;
  phone: string;
}

interface JourneyStopInput {
  sequenceNo: number;
  role: "origin" | "stop" | "destination";
  locationName: string;
  arrivalAt: string;
  pickups: string[];
  drops: string[];
}

interface UpdateJourneyBody {
  journeyId: string;
  vehicleId: string;
  driverId: string;
  notes?: string;
  guests: JourneyGuestInput[];
  stops: JourneyStopInput[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    await requireInternalPortalAdmin(supabaseAdmin, supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, req);

    const body = (await req.json()) as Partial<UpdateJourneyBody>;
    if (!body.journeyId) {
      return jsonResponse({ error: "journeyId is required" }, 400);
    }
    const validationError = validateJourneyBody(body);
    if (validationError) {
      return jsonResponse({ error: validationError }, 400);
    }

    const { error } = await supabaseAdmin.rpc("update_journey", {
      p_journey_id: body.journeyId,
      payload: {
        vehicleId: body.vehicleId,
        driverId: body.driverId,
        notes: body.notes ?? null,
        guests: body.guests,
        stops: body.stops,
      },
    });

    if (error) {
      const conflict = parseJourneyConflict(error.message);
      if (conflict) {
        return jsonResponse({ error: "journey conflict", conflict }, 409);
      }
      return jsonResponse({ error: error.message }, 400);
    }

    return jsonResponse({ id: body.journeyId });
  } catch (err) {
    return authzErrorResponse(err, corsHeaders);
  }
});

function validateJourneyBody(body: Partial<UpdateJourneyBody>): string | null {
  if (!body.vehicleId || !body.driverId) {
    return "vehicleId and driverId are required";
  }
  if (!Array.isArray(body.guests) || body.guests.length === 0) {
    return "guests must be a non-empty array";
  }
  if (!Array.isArray(body.stops) || body.stops.length < 2) {
    return "stops must include at least an origin and a destination";
  }
  for (const guest of body.guests) {
    if (!guest.phone) {
      return "every guest requires a phone";
    }
  }

  const sorted = [...body.stops].sort((a, b) => a.sequenceNo - b.sequenceNo);
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].sequenceNo !== i) {
      return "stop sequenceNo values must be contiguous starting at 0";
    }
  }
  const origins = sorted.filter((s) => s.role === "origin");
  const destinations = sorted.filter((s) => s.role === "destination");
  if (origins.length !== 1 || sorted[0].role !== "origin") {
    return "exactly one stop with role 'origin' is required, at sequenceNo 0";
  }
  if (destinations.length !== 1 || sorted[sorted.length - 1].role !== "destination") {
    return "exactly one stop with role 'destination' is required, as the last stop";
  }
  if (origins[0].drops?.length) {
    return "the origin stop cannot have drops";
  }
  if (destinations[0].pickups?.length) {
    return "the destination stop cannot have pickups";
  }

  const guestPhones = new Set(body.guests.map((g) => g.phone));
  for (const stop of sorted) {
    for (const phone of [...(stop.pickups ?? []), ...(stop.drops ?? [])]) {
      if (!guestPhones.has(phone)) {
        return `stop "${stop.locationName}" references a phone not present in guests: ${phone}`;
      }
    }
  }

  return null;
}

function parseJourneyConflict(
  message: string,
): { resource: "vehicle" | "driver"; journeyId: string; dateFrom: string; dateTo: string } | null {
  const match = message.match(/journey_conflict:(vehicle|driver):([0-9a-f-]+):([0-9-]+):([0-9-]+)/);
  if (!match) {
    return null;
  }
  const [, resource, journeyId, dateFrom, dateTo] = match;
  return { resource: resource as "vehicle" | "driver", journeyId, dateFrom, dateTo };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
