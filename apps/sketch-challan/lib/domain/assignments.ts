import type { SketchChallan, SketchTask } from "./types";
import { assignmentWorkdays, countWorkdays, todayInIndia } from "./workdays";
import { newId } from "../newId";

export function taskAssignments(task: SketchTask, row: SketchChallan) {
  return task.assignments?.length ? task.assignments : [{
    id: `${task.id}-original`,
    sketcherName: task.sketcherName,
    assignedOn: row.createdAt.slice(0, 10),
    startedOn: task.status === "assigned" ? undefined : row.createdAt.slice(0, 10),
  }];
}

export type ChallanStage = "new" | "allotted" | "review" | "approved";

// Which manager tab a challan sits in. Any submitted part puts it in review, so the manager never misses one.
export function challanStage(row: SketchChallan): ChallanStage {
  if (row.tasks.length === 0) return "new";
  if (row.tasks.some((task) => task.status === "submitted")) return "review";
  if (row.tasks.every((task) => task.status === "completed")) return "approved";
  return "allotted";
}

// Challan date = the day the challan goes out (29 Sep meeting): a new challan shows today unless Karam set a later
// day; once allotted it keeps the date it went out on.
export function shownChallanDate(row: SketchChallan, today = todayInIndia()): string {
  if (row.tasks.length > 0) return row.challanDate || today;
  return row.challanDate && row.challanDate > today ? row.challanDate : today;
}

// The one status word everyone sees, on the challan and in the tables (29 Sep meeting).
export function challanStatusLabel(row: SketchChallan): string {
  if (row.status === "on_hold") return "On hold";
  const stage = challanStage(row);
  if (stage === "new") return "New";
  if (stage === "review") return "Done (waiting for approval)";
  if (stage === "approved") return "Approved";
  return row.tasks.some((task) => task.status === "in_progress") ? "In progress" : "Allotted";
}

// Manager's check of submitted work: approve finalises it, send back returns it to the same sketcher as assigned.
export function reviewTask(row: SketchChallan, taskId: string, approved: boolean, note: string, now: string): SketchChallan {
  const task = row.tasks.find((item) => item.id === taskId);
  if (!task || task.status !== "submitted") throw new Error("This part is not waiting for approval.");
  if (!approved && !note.trim()) throw new Error("Say what needs fixing before sending it back.");
  const assignments = taskAssignments(task, row);
  const active = assignments.at(-1)!;
  return {
    ...row,
    tasks: row.tasks.map((item) => item.id !== taskId ? item : {
      ...item,
      status: approved ? "completed" : "assigned",
      // Sent back: credit keeps running from the original start until the next submission.
      assignments: approved ? assignments : [...assignments.slice(0, -1), { ...active, endedOn: undefined }],
    }),
    activity: [{
      id: newId(), at: now,
      message: approved
        ? `Sketching Manager approved ${task.assignedPart} by ${task.sketcherName}.`
        : `Sketching Manager sent ${task.assignedPart} back to ${task.sketcherName}: ${note.trim()}`,
    }, ...row.activity],
  };
}

// A sketcher sees only challans they hold (or held) a task on, and only those tasks.
export function rowsForSketcher(rows: SketchChallan[], sketcherName: string): SketchChallan[] {
  return rows.flatMap((row) => {
    const tasks = row.tasks.filter((task) =>
      task.sketcherName === sketcherName || taskAssignments(task, row).some((item) => item.sketcherName === sketcherName));
    return tasks.length ? [{ ...row, tasks }] : [];
  });
}

export function transferTask(
  row: SketchChallan,
  taskId: string,
  newSketcher: string,
  effectiveOn: string,
  reason: string,
  excludedDates: string[],
  newAssignmentId: string,
  now: string,
): SketchChallan {
  const task = row.tasks.find((item) => item.id === taskId);
  if (!task) throw new Error("Task not found.");
  if (task.status === "completed") throw new Error("A completed task cannot be handed over.");
  if (!newSketcher || newSketcher === task.sketcherName) throw new Error("Choose a different sketcher.");
  if (effectiveOn > todayInIndia()) throw new Error("The handover date cannot be in the future.");
  const assignments = taskAssignments(task, row);
  const current = assignments.at(-1)!;
  countWorkdays(current.assignedOn, effectiveOn);
  if (current.startedOn) countWorkdays(current.startedOn, effectiveOn, excludedDates);
  if (excludedDates.some((date) => !current.startedOn || date < current.startedOn || date >= effectiveOn)) {
    throw new Error("Leave dates must fall within the outgoing assignment.");
  }
  const updated = [
    ...assignments.slice(0, -1),
    { ...current, endedOn: effectiveOn, excludedDates, transferReason: reason.trim() || "Handed over" },
    { id: newAssignmentId, sketcherName: newSketcher, assignedOn: effectiveOn },
  ];
  const days = assignmentWorkdays(updated[updated.length - 2]!);
  return {
    ...row,
    tasks: row.tasks.map((item) => item.id === taskId
      ? { ...item, sketcherName: newSketcher, status: "assigned", assignments: updated }
      : item),
    activity: [{
      id: newId(), at: now,
      message: `${task.assignedPart} handed over from ${task.sketcherName} to ${newSketcher}. ${task.sketcherName}: ${days} workday${days === 1 ? "" : "s"}.${reason.trim() ? ` Reason: ${reason.trim()}` : ""}`,
    }, ...row.activity],
  };
}
