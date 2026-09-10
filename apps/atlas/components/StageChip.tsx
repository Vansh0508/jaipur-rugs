import { stageColorClassName } from "@/lib/stageColors";

export function StageChip({ code, label }: { code: string | null; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-border px-2.5 py-0.5 text-xs font-medium">
      <span className={`h-2 w-2 rounded-full ${stageColorClassName(code)}`} />
      {label}
    </span>
  );
}

// "late" added 2026-09-07 — a projection, not yet a fact: today hasn't passed Rev Ex
// Factory, but at this stage's current pace it won't make that date either. Kept
// visually distinct (warning/amber) from "delayed" (danger/red, already actually late)
// rather than folded into it — see lib/tat.ts's onTimeStatus doc for the full rule.
export function OnTimeBadge({ status }: { status: "on_track" | "late" | "delayed" | "unknown" }) {
  if (status === "unknown") {
    return <span className="text-xs text-muted">No target date</span>;
  }
  const styles = {
    on_track: "bg-success/10 text-success",
    late: "bg-warning/10 text-warning",
    delayed: "bg-danger/10 text-danger",
  }[status];
  const label = { on_track: "On track", late: "Late", delayed: "Delayed" }[status];
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${styles}`}>{label}</span>;
}
