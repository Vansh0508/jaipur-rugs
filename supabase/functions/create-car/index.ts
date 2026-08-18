// db-management write endpoint: create a new car (a `vehicles` row — "Cars" is that
// table plus the columns db/journeys/001 added, not a separate entity). Internal Portal
// admin only, see ../_shared/authz.ts.

import { createClient } from "npm:@supabase/supabase-js@2";
import { requireInternalPortalAdmin, authzErrorResponse } from "../_shared/authz.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateCarBody {
  name: string;
  make: string;
  model: string;
  fuelType: "diesel" | "ev" | "petrol";
  registrationNumber: string;
}

const FUEL_TYPES = ["diesel", "ev", "petrol"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    await requireInternalPortalAdmin(supabaseAdmin, supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, req);

    const body = (await req.json()) as Partial<CreateCarBody>;
    const name = body.name?.trim();
    const make = body.make?.trim();
    const model = body.model?.trim();
    const fuelType = body.fuelType;
    const registrationNumber = body.registrationNumber?.trim();

    if (!name || !make || !model || !fuelType || !registrationNumber) {
      return jsonResponse(
        { error: "name, make, model, fuelType, and registrationNumber are required" },
        400,
      );
    }
    if (!FUEL_TYPES.includes(fuelType)) {
      return jsonResponse({ error: "fuelType must be one of diesel, ev, petrol" }, 400);
    }

    const { data: created, error: insertError } = await supabaseAdmin
      .from("vehicles")
      .insert({ name, make, model, fuel_type: fuelType, registration_number: registrationNumber })
      .select("id")
      .single();

    if (insertError || !created) {
      const status = insertError?.code === "23505" ? 409 : 500;
      return jsonResponse({ error: insertError?.message ?? "insert failed" }, status);
    }

    return jsonResponse({ id: created.id }, 201);
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
