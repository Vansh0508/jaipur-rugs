import { applySketchAction, requireSketchPermission, sketchCorsHeaders, sketchError, sketchJson } from "../_shared/sketchChallan.ts";

// Hold and resume need hold.manage; complete, cancel and reopen need complete.manage. "active" means resume or
// reopen depending on the current status, so the RPC makes the final call; this is only the first gate.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: sketchCorsHeaders });
  try {
    const payload = await req.json();
    if (!payload.challanId || !payload.status) return sketchJson({ error: "challanId and status are required" }, 400);
    if (["on_hold", "cancelled"].includes(payload.status) && !payload.reason) return sketchJson({ error: "a reason is required" }, 400);
    // "active" is a resume (hold.manage) or a reopen (complete.manage): accept either here, the RPC decides.
    const { admin, actor } = payload.status === "on_hold"
      ? await requireSketchPermission(req, "sketch_challan.hold.manage")
      : payload.status === "active"
        ? await requireSketchPermission(req, "sketch_challan.hold.manage").catch(() => requireSketchPermission(req, "sketch_challan.complete.manage"))
        : await requireSketchPermission(req, "sketch_challan.complete.manage");
    return sketchJson(await applySketchAction(admin, actor, "status", payload));
  } catch (error) { return sketchError(error); }
});
