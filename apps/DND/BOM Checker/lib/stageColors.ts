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
