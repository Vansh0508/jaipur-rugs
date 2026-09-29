import { FIELD_LABELS, type ChallanDetailsPatch, type HandoverRequest, type SketchChallan, type SketchTask } from "./types";
import { requestDetailChange, reviewDetailChange } from "./approval";
import { reviewTask, taskAssignments, transferTask } from "./assignments";
import { nextDate, todayInIndia } from "./workdays";
import { SKETCHER_ROSTER } from "../sketcherRoster";
import { newId } from "../newId";

export type ActionUser = { role: "manager" | "sketcher" | "admin"; sketcherName?: string };
type Part = { sketcherName: string; assignedPart: string };

// Every write in the app is one of these. The browser applies it for instant feedback; the server
// re-applies it to the stored copy with the same role rules, and the server's row wins.
export type ChallanAction =
  | { type: "patch"; id: string; patch: ChallanDetailsPatch; message: string }
  | { type: "assign"; id: string; parts: Part[] }
  | { type: "status"; id: string; taskId: string; status: "in_progress" | "submitted" }
  | { type: "requestChange"; id: string; changes: ChallanDetailsPatch; reason: string; handover?: HandoverRequest }
  | { type: "reviewChange"; id: string; requestId: string; approved: boolean; note: string }
  | { type: "reviewTask"; id: string; taskId: string; approved: boolean; note: string }
  | { type: "handover"; id: string; taskId: string; sketcherName: string; effectiveOn: string; reason: string; excludedDates: string[] };

const ASSIGNABLE = new Set<string>(SKETCHER_ROSTER.map((person) => person.name));
const NUMBER_FIELDS = new Set(["orderCount", "mapWidthFt", "mapLengthFt", "areaSqFt", "quantity"]);
const PRIORITIES = new Set(["urgent", "high", "normal", "low"]);

function deny(): never {
  throw new Error("You are not allowed to do that on this challan.");
}

function log(row: SketchChallan, message: string, now: string): SketchChallan["activity"] {
  return [{ id: newId(), message, at: now }, ...row.activity];
}

// Requests arrive as JSON from the browser, so check them: only form fields, each with the right type.
// Without this a crafted "patch" could add tasks or change the status (audit #4).
function checkedPatch(patch: unknown): ChallanDetailsPatch {
  if (!patch || typeof patch !== "object") throw new Error("Nothing to save.");
  for (const [key, value] of Object.entries(patch)) {
    if (!Object.hasOwn(FIELD_LABELS, key)) throw new Error(`"${key}" can't be edited.`);
    const valid = NUMBER_FIELDS.has(key)
      ? typeof value === "number" && Number.isFinite(value)
      : typeof value === "string" && (key !== "priority" || PRIORITIES.has(value));
    if (!valid) throw new Error(`${FIELD_LABELS[key as keyof ChallanDetailsPatch]} has an invalid value.`);
  }
  return patch as ChallanDetailsPatch;
}

function checkedSketcher(name: unknown): string {
  if (typeof name !== "string" || !ASSIGNABLE.has(name)) throw new Error("Choose a sketcher from the list.");
  return name;
}

export function applyAction(row: SketchChallan, action: ChallanAction, user: ActionUser, now: string): SketchChallan {
  const { role } = user;
  const allotted = row.tasks.length > 0;
  // Only whoever holds a part now may write the sketcher remark; after a handover it passes to the new sketcher.
  const holder = role === "sketcher" && row.tasks.some((task) => task.sketcherName === user.sketcherName);
  switch (action.type) {
    case "patch": {
      const patch = checkedPatch(action.patch);
      const onlyRemark = Object.keys(patch).every((key) => key === "sketcherRemark");
      // Manager edits only unallotted challans directly; sketchers only their own remark.
      if (!(role === "manager" && !allotted && !("sketcherRemark" in patch)) && !(holder && onlyRemark)) deny();
      return { ...row, ...patch, activity: log(row, String(action.message).slice(0, 200), now) };
    }
    case "assign": {
      if (!(role === "manager" && !allotted) && !(role === "admin" && allotted)) deny();
      if (!Array.isArray(action.parts) || action.parts.length === 0) throw new Error("Add at least one part.");
      // The same sketcher and part twice is a mistake; a finished part may be given again as rework.
      const open = new Set(row.tasks.filter((task) => task.status !== "completed").map((task) => `${task.sketcherName}|${task.assignedPart}`));
      for (const part of action.parts) {
        checkedSketcher(part.sketcherName);
        if (typeof part.assignedPart !== "string" || !part.assignedPart.trim()) throw new Error("Choose a part.");
        const key = `${part.sketcherName}|${part.assignedPart}`;
        if (open.has(key)) throw new Error(`${part.sketcherName} already has ${part.assignedPart} on this challan.`);
        open.add(key);
      }
      return {
        ...row,
        tasks: [...row.tasks, ...action.parts.map(({ sketcherName, assignedPart }): SketchTask => ({
          id: newId(), title: assignedPart, assignedPart, sketcherName, status: "assigned",
          assignments: [{ id: newId(), sketcherName, assignedOn: todayInIndia() }],
        }))],
        activity: [...action.parts.map((part) => ({ id: newId(), at: now, message: `Assigned ${part.assignedPart} to ${part.sketcherName}.` })), ...row.activity],
      };
    }
    case "status": {
      const task = row.tasks.find((item) => item.id === action.taskId);
      // Whoever holds the part: a sketcher, or the manager on a part he took himself.
      if (role === "admin" || !task || task.sketcherName !== user.sketcherName) deny();
      // The holder only starts or submits; "completed" is the manager's approval (reviewTask).
      if (action.status !== "in_progress" && action.status !== "submitted") deny();
      if (task.status === "completed" || task.status === "submitted") throw new Error("This part is already done.");
      if (action.status === "in_progress" && task.status === "in_progress") throw new Error("You already started this part.");
      const assignments = taskAssignments(task, row);
      const active = assignments.at(-1)!;
      return {
        ...row,
        tasks: row.tasks.map((item) => item.id !== task.id ? item : {
          ...item, status: action.status,
          assignments: [...assignments.slice(0, -1), {
            ...active,
            startedOn: active.startedOn ?? todayInIndia(),
            // Credit pauses at submission; a send-back clears endedOn so it resumes.
            endedOn: action.status === "submitted" ? nextDate(todayInIndia()) : active.endedOn,
          }],
        }),
        activity: log(row, action.status === "submitted"
          ? `${task.sketcherName} submitted ${task.assignedPart} for checking.`
          : `${task.sketcherName} started ${task.assignedPart}.`, now),
      };
    }
    case "requestChange":
      if (role !== "manager") deny();
      if (action.handover) checkedSketcher(action.handover.sketcherName);
      return requestDetailChange(row, checkedPatch(action.changes ?? {}), action.reason, now, newId(), action.handover);
    case "reviewChange":
      if (role !== "admin") deny();
      return reviewDetailChange(row, action.requestId, action.approved, now, action.note);
    case "reviewTask":
      if (role !== "manager") deny();
      return reviewTask(row, action.taskId, action.approved, action.note, now);
    case "handover":
      if (role !== "admin") deny();
      return transferTask(row, action.taskId, checkedSketcher(action.sketcherName), action.effectiveOn, action.reason, action.excludedDates, newId(), now);
  }
}
