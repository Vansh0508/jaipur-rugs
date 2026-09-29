import { applySketchAction, requireSketchPermission, sketchCorsHeaders, sketchError, sketchJson } from "../_shared/sketchChallan.ts";

// task_create: allot parts (manager before allotment, Admin after). task_status: the holder starts or submits.
// task_review: the Sketching Manager approves or sends back. task_transfer: Admin hands a part over.
// The RPC re-checks roles, the holder and the challan state; this only gates on the permission the action needs.
const PERMISSION: Record<string, string> = {
  task_create: "sketch_challan.tasks.manage",
  task_transfer: "sketch_challan.tasks.manage",
  task_review: "sketch_challan.tasks.manage",
  task_status: "sketch_challan.task.act",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: sketchCorsHeaders });
  try {
    const payload = await req.json();
    const action = String(payload.action ?? "");
    const permission = PERMISSION[action];
    if (!payload.challanId || !permission) return sketchJson({ error: "valid action and challanId are required" }, 400);
    const { admin, actor } = await requireSketchPermission(req, permission);
    return sketchJson(await applySketchAction(admin, actor, action, payload));
  } catch (error) { return sketchError(error); }
});
