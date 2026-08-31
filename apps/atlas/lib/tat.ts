// TAT is derived, never stored (build prompt Section 3 — order_stage_events has no
// duration column). Given an order's stage history sorted oldest-first, each entry's
// duration is the next entry's entered_at minus its own, or now() for the last (current)
// entry — exactly the definition in db/orders/README.md.

export interface StageEvent {
  stageId: string;
  enteredAt: string; // ISO timestamp
}

export interface StageDuration {
  stageId: string;
  enteredAt: string;
  /** null only if enteredAt is somehow in the future relative to the next event — shouldn't happen, guarded rather than left to produce a negative number. */
  durationMs: number;
  isCurrent: boolean;
}

export function computeStageDurations(events: StageEvent[]): StageDuration[] {
  const sorted = [...events].sort((a, b) => new Date(a.enteredAt).getTime() - new Date(b.enteredAt).getTime());
  const now = Date.now();

  return sorted.map((event, index) => {
    const next = sorted[index + 1];
    const startMs = new Date(event.enteredAt).getTime();
    const endMs = next ? new Date(next.enteredAt).getTime() : now;
    return {
      stageId: event.stageId,
      enteredAt: event.enteredAt,
      durationMs: Math.max(0, endMs - startMs),
      isCurrent: !next,
    };
  });
}

export function formatDuration(ms: number): string {
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (days >= 1) return `${days}d`;
  const hours = Math.floor(ms / (60 * 60 * 1000));
  if (hours >= 1) return `${hours}h`;
  const minutes = Math.max(0, Math.floor(ms / (60 * 1000)));
  return `${minutes}m`;
}

/** On-time signal for the build prompt's "simple on-time/delayed signal" — compares
 * today against promised_delivery_date (falling back to revised_ex_factory_date when no
 * promised date is set yet). Terminal stages (delivered) are never "delayed". */
export function onTimeStatus(
  promisedDeliveryDate: string | null,
  revisedExFactoryDate: string | null,
  isTerminalStage: boolean,
): "on_track" | "delayed" | "unknown" {
  if (isTerminalStage) return "on_track";
  const target = promisedDeliveryDate ?? revisedExFactoryDate;
  if (!target) return "unknown";
  const targetMs = new Date(target).getTime();
  if (Number.isNaN(targetMs)) return "unknown";
  return Date.now() > targetMs ? "delayed" : "on_track";
}
