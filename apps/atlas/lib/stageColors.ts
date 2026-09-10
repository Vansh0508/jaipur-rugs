// Stage -> color mapping, kept here (not in packages/ui-kit — see StageTimeline.tsx's
// comment) because the actual stage list is Atlas's business data, still provisional
// pending the TAT meeting (build prompt Section 2). Adding a new stage code later means
// adding one line here, not touching the shared package.
//
// "Consistent color per stage across every view" (build prompt Section 1.1) — this is
// the one place that mapping is defined, imported by StageChip and every StageTimeline
// usage rather than re-picked per screen.
export const STAGE_COLORS: Record<string, string> = {
  pre_loom: "bg-neutral-400",
  loom: "bg-blue-500",
  purchase: "bg-purple-500",
  finish: "bg-amber-500",
  consignee: "bg-cyan-600",
  delivered: "bg-success",
  rejected: "bg-danger",
  other: "bg-neutral-300",
};

export const STAGE_FALLBACK_COLOR = "bg-neutral-300";

export function stageColorClassName(stageCode: string | null | undefined): string {
  if (!stageCode) return STAGE_FALLBACK_COLOR;
  return STAGE_COLORS[stageCode] ?? STAGE_FALLBACK_COLOR;
}
