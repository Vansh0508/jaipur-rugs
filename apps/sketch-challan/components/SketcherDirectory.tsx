"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Briefcase, CircleCheck, Hourglass, Magnifier } from "@gravity-ui/icons";
import { StatCard } from "@/components/StatCard";
import { Button } from "@jaipur-rugs/ui-kit";
import type { SketchChallan, SketchTask } from "@/lib/domain/types";
import { taskAssignments } from "@/lib/domain/assignments";
import { assignmentWorkdays } from "@/lib/domain/workdays";
import { SKETCHER_ROSTER } from "@/lib/sketcherRoster";

type Entry = { row: SketchChallan; task: SketchTask; holder: boolean; workdays: number; from: string; to?: string; handedOver?: string };

const STATUS_LABEL: Record<SketchTask["status"], string> = {
  assigned: "Assigned", in_progress: "In progress", blocked: "Blocked",
  clarification_requested: "Clarification", submitted: "Awaiting approval", completed: "Approved",
};

// Every task a sketcher holds now or held before a handover, newest first.
function entriesFor(rows: SketchChallan[], name: string): Entry[] {
  return rows.flatMap((row) => row.tasks.flatMap((task) => taskAssignments(task, row)
    .filter((item) => item.sketcherName === name)
    .map((item) => ({
      row, task, holder: task.sketcherName === name && !item.transferReason,
      workdays: assignmentWorkdays(item), from: item.assignedOn, to: item.endedOn, handedOver: item.transferReason,
    }))))
    .sort((a, b) => b.from.localeCompare(a.from));
}

function stats(entries: Entry[]) {
  const held = entries.filter((entry) => entry.holder);
  return {
    current: held.filter((entry) => !["submitted", "completed"].includes(entry.task.status)).length,
    review: held.filter((entry) => entry.task.status === "submitted").length,
    done: held.filter((entry) => entry.task.status === "completed").length,
    workdays: entries.reduce((sum, entry) => sum + entry.workdays, 0),
    last: entries[0]?.from,
  };
}

function showDate(iso?: string) {
  if (!iso) return "—";
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function SketcherDirectory({ rows, onOpen, picked, onPick }: {
  rows: SketchChallan[];
  onOpen: (challanId: string) => void;
  picked: string | null;
  onPick: (name: string | null) => void;
}) {
  const [query, setQuery] = useState("");
  const people = useMemo(() => SKETCHER_ROSTER.map((person) => {
    const entries = entriesFor(rows, person.name);
    return { ...person, entries, ...stats(entries) };
  }), [rows]);

  const person = people.find((item) => item.name === picked);
  if (person) {
    return (
      <div className="flex flex-col gap-4">
        <div><Button size="sm" variant="secondary" onPress={() => onPick(null)}><ArrowLeft /> All sketchers</Button></div>
        <div>
          <span className="rounded-md bg-foreground px-2 py-0.5 text-xs font-semibold text-background">{person.machineCentreNo}</span>
          <h2 className="mt-2 text-xl font-semibold">{person.name}</h2>
          <p className="text-sm text-muted">{person.current} current · {person.review} awaiting approval · {person.done} approved · {person.workdays} workdays credited</p>
        </div>
        {person.entries.length === 0 ? <p className="text-sm text-muted">No challans yet.</p> : (
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-secondary text-xs text-muted">
                <tr>{["Prod. Order No", "Part", "Status", "Assigned", "Until", "Workdays", "Note"].map((head) => <th key={head} className="px-3 py-2 font-bold">{head}</th>)}</tr>
              </thead>
              <tbody>
                {person.entries.map((entry, index) => (
                  <tr key={`${entry.task.id}-${index}`} className="cursor-pointer border-t border-border hover:bg-surface-secondary" onClick={() => onOpen(entry.row.id)}>
                    <td className="px-3 py-2 font-medium">{entry.row.productionOrderNo}</td>
                    <td className="px-3 py-2">{entry.task.assignedPart}</td>
                    <td className="px-3 py-2">{entry.holder ? STATUS_LABEL[entry.task.status] : "Handed over"}</td>
                    <td className="px-3 py-2">{showDate(entry.from)}</td>
                    <td className="px-3 py-2">{entry.to ? showDate(entry.to) : "Present"}</td>
                    <td className="px-3 py-2">{entry.workdays}</td>
                    <td className="px-3 py-2 text-muted">{entry.handedOver ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  const needle = query.trim().toLowerCase();
  const shown = people.filter((item) => !needle || `${item.name} ${item.machineCentreNo}`.toLowerCase().includes(needle));
  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
        <Magnifier className="text-muted" />
        <input className="w-full bg-transparent text-sm outline-none" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search sketcher name or machine centre" />
      </label>
      <p className="text-sm text-muted">{shown.length} sketcher(s)</p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {shown.map((item) => (
          <StatCard
            key={item.name}
            bar={item.review ? "bg-warning" : item.current ? "bg-accent" : "bg-border"}
            pill={item.machineCentreNo}
            title={item.name}
            lines={[
              <><Briefcase /> {item.current} current challan{item.current === 1 ? "" : "s"}</>,
              <><Hourglass /> {item.review} awaiting approval</>,
            ]}
            badge={<><CircleCheck /> {item.done} approved · {item.workdays} workdays</>}
            corner={showDate(item.last)}
            onView={() => onPick(item.name)}
          />
        ))}
      </div>
    </div>
  );
}
