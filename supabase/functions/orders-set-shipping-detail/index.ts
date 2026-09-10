// db-management write endpoint: create/update an order's shipping_details — weight,
// dimensions, foldability, carrier quote status. Meant to be populated as early as
// production/shipping can estimate, independent of whether the item is physically ready
// (build prompt Section 2's specific pain point: courier quotes today only get
// requested once the item is already sitting there, costing days). Production or
// shipping department access, or orders.write.all (admin).

import { createClient } from "npm:@supabase/supabase-js@2";
import { requireAtlasAccess, authzErrorResponse } from "../_shared/authz.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const QUOTE_STATUSES = ["not_requested", "requested", "quoted", "booked"] as const;
type QuoteStatus = (typeof QUOTE_STATUSES)[number];

interface SetShippingDetailBody {
  orderId: string;
  weightKg?: number | null;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  foldable?: boolean | null;
  carrier?: string | null;
  quoteStatus?: QuoteStatus;
  notes?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const { employeeId } = await requireAtlasAccess(
      supabaseAdmin,
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      req,
      { permissionKey: "orders.write.all", departmentCodes: ["production", "shipping"] },
    );

    const body = (await req.json()) as Partial<SetShippingDetailBody>;
    const { orderId } = body;
    if (!orderId) {
      return jsonResponse({ error: "orderId is required" }, 400);
    }
    if (body.quoteStatus && !QUOTE_STATUSES.includes(body.quoteStatus)) {
      return jsonResponse({ error: `quoteStatus must be one of ${QUOTE_STATUSES.join(", ")}` }, 400);
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id")
      .eq("id", orderId)
      .maybeSingle();
    if (orderError) return jsonResponse({ error: orderError.message }, 500);
    if (!order) return jsonResponse({ error: "order not found" }, 404);

    // Merge onto whatever's already there — this is called with a handful of fields
    // filled in at a time as production/shipping learns them, not the full row every
    // time. Reading the existing row first (rather than upserting `?? null` for every
    // unset field) stops an update that's only setting e.g. weight from clobbering a
    // quote_status a later call already set.
    const { data: existing } = await supabaseAdmin
      .from("shipping_details")
      .select("weight_kg, length_cm, width_cm, height_cm, foldable, carrier, quote_status, notes")
      .eq("order_id", orderId)
      .maybeSingle();

    const nowIso = new Date().toISOString();
    const { data, error: upsertError } = await supabaseAdmin
      .from("shipping_details")
      .upsert(
        {
          order_id: orderId,
          weight_kg: body.weightKg !== undefined ? body.weightKg : existing?.weight_kg ?? null,
          length_cm: body.lengthCm !== undefined ? body.lengthCm : existing?.length_cm ?? null,
          width_cm: body.widthCm !== undefined ? body.widthCm : existing?.width_cm ?? null,
          height_cm: body.heightCm !== undefined ? body.heightCm : existing?.height_cm ?? null,
          foldable: body.foldable !== undefined ? body.foldable : existing?.foldable ?? null,
          carrier: body.carrier !== undefined ? body.carrier : existing?.carrier ?? null,
          quote_status: body.quoteStatus ?? existing?.quote_status ?? "not_requested",
          notes: body.notes !== undefined ? body.notes : existing?.notes ?? null,
          updated_by: employeeId,
          updated_at: nowIso,
        },
        { onConflict: "order_id" },
      )
      .select("id")
      .single();
    if (upsertError) return jsonResponse({ error: upsertError.message }, 500);

    return jsonResponse({ id: data.id, orderId }, 200);
  } catch (err) {
    return authzErrorResponse(err, corsHeaders);
  }
});

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
