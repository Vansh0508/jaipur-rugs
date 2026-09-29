import { applySketchAction, requireSketchPermission, sketchCorsHeaders, sketchError, sketchJson } from "../_shared/sketchChallan.ts";

// update: manager edits before allotment. request_update: manager asks Admin after allotment (may carry a handover).
// review_update: Admin approves or rejects (never their own request). remark: the current part holder's remark.
// The RPC re-checks each rule; this only gates on the permission the action needs.
const PERMISSION: Record<string, string> = {
  update: "sketch_challan.edit",
  request_update: "sketch_challan.edit",
  review_update: "sketch_challan.change.approve",
  remark: "sketch_challan.task.act",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: sketchCorsHeaders });
  try {
    const payload = await req.json();
    if (!payload.challanId) return sketchJson({ error: "challanId is required" }, 400);
    const action = String(payload.action ?? "update");
    const permission = PERMISSION[action];
    if (!permission) return sketchJson({ error: "unsupported update action" }, 400);
    const { admin, actor } = await requireSketchPermission(req, permission);
    return sketchJson(await applySketchAction(admin, actor, action, payload));
  } catch (error) { return sketchError(error); }
});
