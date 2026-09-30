import { FIELD_LABELS, type ChallanChangeRequest, type ChallanDetailsPatch, type HandoverRequest, type SketchChallan } from "./types";
import { transferTask } from "./assignments";
import { newId } from "../newId";

// What an allotted-challan change request may touch: every form field except the sketcher's own remark.
const DETAIL_FIELDS = new Set(Object.keys(FIELD_LABELS).filter((key) => key !== "sketcherRemark"));

export function pendingChange(row: SketchChallan): ChallanChangeRequest | undefined {
  return row.changeRequests?.find((request) => request.status === "pending");
}

export function requestDetailChange(
  row: SketchChallan,
  changes: ChallanDetailsPatch,
  reason: string,
  now: string,
  id: string,
  handover?: HandoverRequest,
): SketchChallan {
  if (row.tasks.length === 0) throw new Error("This challan has not been allotted.");
  if (pendingChange(row)) throw new Error("An admin review is already pending.");
  if (!reason.trim()) throw new Error("Enter a reason for the requested change.");
  // Validate the handover now so admin never gets an impossible one; the result is discarded until approval.
  if (handover) applyHandover(row, handover, now);
  const changed = Object.fromEntries(Object.entries(changes).filter(([key, value]) =>
    DETAIL_FIELDS.has(key) && value !== row[key as keyof SketchChallan],
  )) as ChallanDetailsPatch;
  // A reason-only request is allowed: it asks the admin for an extra part they apply themselves.
  return {
    ...row,
    changeRequests: [{ id, requestedAt: now, changes: changed, reason: reason.trim(), status: "pending", handover }, ...(row.changeRequests ?? [])],
    activity: [{ id: newId(), at: now, message: handover
      ? `Sketching Manager requested admin approval to hand over to ${handover.sketcherName}.`
      : "Sketching Manager requested admin approval for a challan detail change." }, ...row.activity],
  };
}

function applyHandover(row: SketchChallan, handover: HandoverRequest, now: string) {
  return transferTask(row, handover.taskId, handover.sketcherName, handover.effectiveOn, handover.reason, handover.excludedDates, newId(), now);
}

export function reviewDetailChange(
  row: SketchChallan,
  requestId: string,
  approved: boolean,
  now: string,
  note = "",
): SketchChallan {
  const request = row.changeRequests?.find((item) => item.id === requestId && item.status === "pending");
  if (!request) throw new Error("The pending request was not found.");
  if (!approved && !note.trim()) throw new Error("Enter a reason for rejecting this request.");
  const base = approved && request.handover ? applyHandover(row, request.handover, now) : row;
  return {
    ...base,
    ...(approved ? request.changes : {}),
    changeRequests: row.changeRequests?.map((item) => item.id === requestId
      ? { ...item, status: approved ? "approved" as const : "rejected" as const, reviewedAt: now, reviewNote: note.trim() }
      : item),
    activity: [{ id: newId(), at: now, message: `Admin ${approved ? "approved and applied" : "rejected"} the challan detail request${note.trim() ? `: ${note.trim()}` : "."}` }, ...base.activity],
  };
}
