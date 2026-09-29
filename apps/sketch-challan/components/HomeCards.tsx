"use client";

import { CircleCheck, Clock, FileText, Hourglass, ListCheck, Person } from "@gravity-ui/icons";
import type { SketchChallan } from "@/lib/domain/types";
import { todayInIndia } from "@/lib/domain/workdays";
import { SKETCHER_ROSTER } from "@/lib/sketcherRoster";
import { StatCard } from "@/components/StatCard";
import type { MapOrder } from "@/lib/maps/types";

export type Section = "new" | "allotted" | "review" | "approved" | "requests" | "sketchers" | "maps" | "mine";

const INFO: Record<Exclude<Section, "sketchers" | "maps" | "mine">, { title: string; bar: string; about: string; icon: React.ReactNode }> = {
  new: { title: "New challan", bar: "bg-accent", about: "Waiting to be allotted", icon: <FileText /> },
  allotted: { title: "Allotted", bar: "bg-foreground", about: "With sketchers now", icon: <ListCheck /> },
  review: { title: "Sketch approval", bar: "bg-warning", about: "Done by sketcher, waiting for the Sketching Manager", icon: <Hourglass /> },
  approved: { title: "Approved", bar: "bg-success", about: "Checked and finalised", icon: <CircleCheck /> },
  requests: { title: "Admin approvals", bar: "bg-danger", about: "Changes to allotted challans, waiting for admin", icon: <Clock /> },
};

function latest(rows: SketchChallan[]) {
  const at = rows.flatMap((row) => row.activity.map((item) => item.at)).sort().at(-1);
  return at ? new Date(at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : undefined;
}

export function HomeCards({ sections, maps, mine, onOpen }: {
  sections: Record<Exclude<Section, "sketchers" | "maps" | "mine">, SketchChallan[]>;
  maps: MapOrder[];
  mine?: SketchChallan[]; // The manager's own parts, when he takes sketch work himself
  onOpen: (section: Section) => void;
}) {
  const today = todayInIndia();
  const all = [...sections.new, ...sections.allotted, ...sections.review];
  const busy = new Set(all.flatMap((row) => row.tasks.filter((task) => task.status !== "completed").map((task) => task.sketcherName)));
  const waiting = new Set(sections.review.flatMap((row) => row.tasks.filter((task) => task.status === "submitted").map((task) => task.sketcherName)));
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {(Object.keys(INFO) as (keyof typeof INFO)[]).map((id) => {
        const rows = sections[id];
        const urgent = rows.filter((row) => row.priority === "urgent").length;
        const overdue = id === "approved" ? 0 : rows.filter((row) => row.dueDate && row.dueDate < today).length;
        return (
          <StatCard
            key={id}
            // Grey the bar when a section is empty so the busy ones stand out.
            bar={rows.length ? INFO[id].bar : "bg-border"}
            pill={`${rows.length} challan${rows.length === 1 ? "" : "s"}`}
            title={INFO[id].title}
            lines={[<>{INFO[id].icon} {INFO[id].about}</>, <><Clock /> {urgent} urgent · {overdue} overdue</>]}
            corner={latest(rows)}
            onView={() => onOpen(id)}
          />
        );
      })}
      <StatCard
        bar="bg-accent"
        pill={`${SKETCHER_ROSTER.length} sketchers`}
        title="Sketchers"
        lines={[<><Person /> {busy.size} with work · {SKETCHER_ROSTER.length - busy.size} free</>, <><Hourglass /> {waiting.size} waiting for approval</>]}
        onView={() => onOpen("sketchers")}
      />
      <StatCard
        bar={maps.length ? "bg-success" : "bg-border"}
        pill={`${maps.length} order${maps.length === 1 ? "" : "s"}`}
        title="Maps"
        lines={[
          <><FileText /> Map is in the MAP Library</>,
          <><Person /> {maps.filter((order) => !order.assignedTo).length} to assign · {maps.filter((order) => order.assignedTo && !order.pickedUpAt).length} with sketchers · {maps.filter((order) => order.pickedUpAt).length} picked up</>,
        ]}
        onView={() => onOpen("maps")}
      />
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
