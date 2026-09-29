"use client";

import { useState } from "react";
import { Button } from "@jaipur-rugs/ui-kit";
import type { SketchChallan, SketchTask } from "@/lib/domain/types";
import { taskAssignments } from "@/lib/domain/assignments";
import { assignmentWorkdays, todayInIndia } from "@/lib/domain/workdays";
import { DEMO_SKETCHERS } from "@/lib/demoData";
import { employeeIdFor } from "@/lib/sketcherRoster";

type Transfer = (taskId: string, sketcher: string, date: string, reason: string, excludedDates: string[]) => void;

function TransferControls({ task, onTransfer, label }: { task: SketchTask; onTransfer: Transfer; label: string }) {
  const [sketcher, setSketcher] = useState("");
  const [date, setDate] = useState(todayInIndia);
  const [reason, setReason] = useState("");
  const [leave, setLeave] = useState("");
  const [error, setError] = useState("");
  if (task.status === "completed") return null;
  return (
    <div className="mt-3 grid gap-2 rounded-xl bg-surface-secondary p-3 sm:grid-cols-2">
      <label className="text-xs">Hand over to
        <select className="mt-1 w-full rounded-lg border border-border bg-surface p-2 text-sm" value={sketcher} onChange={(event) => setSketcher(event.target.value)}>
          <option value="">Choose sketcher</option>
          {DEMO_SKETCHERS.filter((name) => name !== task.sketcherName).map((name) => <option key={name}>{name}</option>)}
        </select>
      </label>
      <label className="text-xs">Effective work date
        <input className="mt-1 w-full rounded-lg border border-border bg-surface p-2 text-sm" type="date" max={todayInIndia()} value={date} onChange={(event) => setDate(event.target.value)} />
      </label>
      <label className="text-xs sm:col-span-2">Handover reason
        <input className="mt-1 w-full rounded-lg border border-border bg-surface p-2 text-sm" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="For example, leave" />
      </label>
      <label className="text-xs sm:col-span-2">Leave or other non-work dates for outgoing sketcher (optional)
        <input className="mt-1 w-full rounded-lg border border-border bg-surface p-2 text-sm" value={leave} onChange={(event) => setLeave(event.target.value)} placeholder="YYYY-MM-DD, YYYY-MM-DD" />
      </label>
      {error ? <p className="text-sm text-danger sm:col-span-2">{error}</p> : null}
      <div className="sm:col-span-2">
        <Button size="sm" variant="secondary" onPress={() => {
          try {
            const dates = leave.split(",").map((item) => item.trim()).filter(Boolean);
            if (dates.some((item) => !/^\d{4}-\d{2}-\d{2}$/.test(item))) throw new Error("Enter leave dates as YYYY-MM-DD, separated by commas.");
            onTransfer(task.id, sketcher, date, reason, dates);
            setError(""); setReason(""); setLeave(""); setSketcher("");
          } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not hand over task."); }
        }}>{label}</Button>
      </div>
    </div>
  );
}

// Full timeline of a challan (assignments, approvals, send-backs, edits) for the manager and admin.
export function ChallanActivity({ row }: { row: SketchChallan }) {
  return (
    <section className="no-print rounded-2xl border border-border bg-surface p-4">
      <h2 className="text-base font-semibold">Challan history</h2>
      {row.activity.length === 0 ? <p className="mt-2 text-sm text-muted">No history yet.</p> : (
        <ol className="mt-3 space-y-2">
          {row.activity.map((item) => (
            <li key={item.id} className="flex flex-wrap justify-between gap-2 rounded-lg bg-surface-secondary px-3 py-2 text-sm">
              <span>{item.message}</span>
              <span className="text-xs text-muted">{new Date(item.at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function AssignmentHistory({ row, onTransfer, transferLabel = "Hand over task" }: { row: SketchChallan; onTransfer?: Transfer; transferLabel?: string }) {
  // Credit only matters when the challan is split or handed between people; otherwise just offer the admin a handover.
  const people = new Set(row.tasks.flatMap((task) => taskAssignments(task, row).map((item) => item.sketcherName)));
  const shared = people.size > 1;
  if (row.tasks.length === 0 || (!shared && !onTransfer)) return null;
  return (
    <section className="no-print rounded-2xl border border-border bg-surface p-4">
      <h2 className="text-base font-semibold">{shared ? "Sketcher workday credit and handovers" : "Hand over"}</h2>
      {shared ? <p className="mt-1 text-xs text-muted">Credit begins when a sketcher starts a task. Sundays and recorded leave dates are excluded.</p> : null}
      <div className="mt-4 space-y-4">
        {row.tasks.map((task) => (
          <div key={task.id} className="rounded-xl border border-border p-3">
            <p className="font-medium">{task.assignedPart} <span className="text-sm font-normal text-muted">· {task.status.replaceAll("_", " ")}{task.status === "blocked" && task.blockedReason ? `: ${task.blockedReason}` : ""}</span></p>
            {shared ? <div className="mt-2 space-y-1">
              {taskAssignments(task, row).map((assignment) => (
                <div key={assignment.id} className="flex flex-wrap justify-between gap-2 rounded-lg bg-surface-secondary px-3 py-2 text-sm">
                  <span>{assignment.sketcherName}{employeeIdFor(assignment.sketcherName) ? ` (${employeeIdFor(assignment.sketcherName)})` : ""} · {assignment.startedOn ?? "Not started"} {assignment.endedOn ? `to ${assignment.endedOn} (handover)` : "to present"}</span>
                  <strong>{assignmentWorkdays(assignment)} workday{assignmentWorkdays(assignment) === 1 ? "" : "s"}</strong>
                  {assignment.transferReason ? <span className="w-full text-xs text-muted">Handover: {assignment.transferReason}</span> : null}
                </div>
              ))}
            </div> : null}
            {onTransfer ? <TransferControls task={task} onTransfer={onTransfer} label={transferLabel} /> : null}
          </div>
        ))}
      </div>
    </section>
  );
}
