import { applySketchAction, requireSketchPermission, sketchCorsHeaders, sketchError, sketchJson } from "../_shared/sketchChallan.ts";

// Live NAV Excel refresh (the Sketching Manager's Refresh Excel). The app merges the reports with the stored
// challans first (apps/sketch-challan/lib/importExcel.ts) and sends per challan only the fields to write.
const MAX_ROWS = 5000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: sketchCorsHeaders });
  try {
    const { admin, actor } = await requireSketchPermission(req, "sketch_challan.refresh");
    const payload = await req.json();
    if (!Array.isArray(payload.rows) || payload.rows.length === 0) return sketchJson({ error: "rows are required" }, 400);
    if (payload.rows.length > MAX_ROWS) return sketchJson({ error: `send at most ${MAX_ROWS} rows per call` }, 413);
    const droppedPos = Array.isArray(payload.droppedPos) ? payload.droppedPos.map(String) : [];
    return sketchJson(await applySketchAction(admin, actor, "excel_upsert", { rows: payload.rows, droppedPos }));
  } catch (error) { return sketchError(error); }
});
