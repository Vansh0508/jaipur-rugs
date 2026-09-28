// db-management write endpoint: edit a car's details (name, make, model, fuel type,
// number plate) — the same fields create-car takes, all required, so the edit form is
// the create form prefilled. Status is NOT editable here; that's update-car-status, which
// carries the mid-trip/upcoming-journey guards. Internal Portal admin only. The plate is
// normalized (trim + uppercase) by a DB trigger (db/journeys/010), so a duplicate that
// differs only in case/whitespace still hits vehicles_registration_number_key → 409.

import { createClient } from "npm:@supabase/supabase-js@2";
import { requireInternalPortalAdmin, authzErrorResponse } from "../_shared/authz.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Must match the fuel_type enum (db/feedback/004 + db/journeys/009).
const FUEL_TYPES = ["petrol", "diesel", "ev", "cng", "hybrid", "lpg", "biodiesel", "hydrogen", "petrol_cng", "petrol_lpg", "ev_petrol"];

interface UpdateCarBody {
  vehicleId: string;
  name: string;
  make: string;
  model: string;
  fuelType: string;
  registrationNumber: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    await requireInternalPortalAdmin(supabaseAdmin, supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, req);

    const body = (await req.json()) as Partial<UpdateCarBody>;
    const vehicleId = body.vehicleId;
    const name = body.name?.trim();
    const make = body.make?.trim();
    const model = body.model?.trim();
    const fuelType = body.fuelType;
    const registrationNumber = body.registrationNumber?.trim();

    if (!vehicleId || !name || !make || !model || !fuelType || !registrationNumber) {
      return jsonResponse(
        { error: "vehicleId, name, make, model, fuelType, and registrationNumber are required" },
        400,
      );
    }
    if (!FUEL_TYPES.includes(fuelType)) {
      return jsonResponse({ error: `fuelType must be one of ${FUEL_TYPES.join(", ")}` }, 400);
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("vehicles")
      .update({ name, make, model, fuel_type: fuelType, registration_number: registrationNumber })
      .eq("id", vehicleId)
      .select("id")
      .maybeSingle();

    if (updateError) {
      if (updateError.code === "23505") {
        return jsonResponse({ error: "Another car already has this number plate." }, 409);
      }
      return jsonResponse({ error: updateError.message }, 500);
    }
    if (!updated) {
      return jsonResponse({ error: "car not found" }, 404);
    }

    return jsonResponse({ id: updated.id });
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
