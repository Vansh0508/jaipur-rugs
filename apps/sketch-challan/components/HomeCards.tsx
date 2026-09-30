"use client";

import { CircleCheck, Clock, FileText, Hourglass, ListCheck, Person } from "@gravity-ui/icons";
import type { SketchChallan } from "@/lib/domain/types";
import { todayInIndia } from "@/lib/domain/workdays";
import { SKETCHER_ROSTER } from "@/lib/sketcherRoster";
import { StatCard } from "@/components/StatCard";
import type { MapOrder } from "@/lib/maps/types";

export type Section = "new" | "allotted" | "review" | "approved" | "requests" | "sketchers" | "maps" | "mine";

function latest(rows: SketchChallan[]) {
  const at = rows.flatMap((row) => row.activity.map((item) => item.at)).sort().at(-1);
  return at ? new Date(at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : undefined;
}

export function HomeCards({ sections, maps, mine, onOpen }: {
  sections: Record<Exclude<Section, "sketchers" | "maps" | "mine">, SketchChallan[]>;
  maps?: MapOrder[]; // Admin only
  mine?: SketchChallan[]; // The manager's own parts, when he takes sketch work himself
  onOpen: (section: Section) => void;
}) {
  const today = todayInIndia();
  const open = [...sections.new, ...sections.allotted, ...sections.review];
  const urgent = open.filter((row) => row.priority === "urgent").length;
  const overdue = open.filter((row) => row.dueDate && row.dueDate < today).length;
  const busy = new Set(open.flatMap((row) => row.tasks.filter((task) => task.status !== "completed").map((task) => task.sketcherName)));
  const waiting = new Set(sections.review.flatMap((row) => row.tasks.filter((task) => task.status === "submitted").map((task) => task.sketcherName)));
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {/* One card per group (29 Sep meeting); the stages are tabs inside Sketch Challan. */}
      <StatCard
        bar={open.length ? "bg-accent" : "bg-border"}
        pill={`${open.length} open challan${open.length === 1 ? "" : "s"}`}
        title="Sketch Challan"
        lines={[
          <><FileText /> {sections.new.length} new · {sections.allotted.length} allotted</>,
          <><Hourglass /> {sections.review.length} sketch approval · <CircleCheck /> {sections.approved.length} approved</>,
          <><Clock /> {urgent} urgent · {overdue} overdue</>,
        ]}
        corner={latest([...open, ...sections.approved])}
        onView={() => onOpen("new")}
      />
      <StatCard
        bar={sections.requests.length ? "bg-danger" : "bg-border"}
        pill={`${sections.requests.length} waiting`}
        title="Admin approvals"
        lines={[<><Clock /> Changes to allotted challans, waiting for admin</>, <><ListCheck /> Approve or reject from the list</>]}
        corner={latest(sections.requests)}
        onView={() => onOpen("requests")}
      />
      <StatCard
        bar="bg-accent"
        pill={`${SKETCHER_ROSTER.length} sketchers`}
        title="Sketchers"
        lines={[<><Person /> {busy.size} with work · {SKETCHER_ROSTER.length - busy.size} free</>, <><Hourglass /> {waiting.size} waiting for approval</>]}
        onView={() => onOpen("sketchers")}
      />
      {maps ? <StatCard
        bar={maps.length ? "bg-success" : "bg-border"}
        pill={`${maps.length} order${maps.length === 1 ? "" : "s"}`}
        title="Maps"
        lines={[
          <><FileText /> Print and Available orders</>,
          <><Person /> {maps.filter((order) => order.copies.length).length} in the MAP Library · {maps.filter((order) => !order.copies.length).length} not in library</>,
        ]}
        onView={() => onOpen("maps")}
      /> : null}
      {mine ? (
        <StatCard
          bar={mine.length ? "bg-accent" : "bg-border"}
          pill={`${mine.length} challan${mine.length === 1 ? "" : "s"}`}
          title="My work"
          lines={[<><Person /> Parts you took yourself</>, <><Hourglass /> {mine.filter((row) => row.tasks.some((task) => task.status !== "completed")).length} still open</>]}
          onView={() => onOpen("mine")}
        />
      ) : null}
    </div>
  );
}
