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
 * today against revised_ex_factory_date (falling back to promised_delivery_date only
 * when Rev Ex Factory itself is missing). Terminal stages (delivered) are never
 * "delayed".
 *
 * Precedence flipped 2026-09-07: this originally preferred promised_delivery_date, which
 * was harmless only because that field was always blank under the old public API feed —
 * see OrdersTable.tsx's own comment, written at the time, calling revised_ex_factory_date
 * "the actual delay/expectancy signal". Now that orders-sync.mjs reads real
 * Promised Delivery Date values directly from NAV, that old precedence produced visibly
 * wrong results: confirmed live, real orders sitting 500+ days past their Rev Ex Factory
 * date were showing "On track" because Promised Delivery Date happened to be a real but
 * much later (sometimes years later) date — not a data error, just a different field
 * that was never meant to override this signal.
 *
 * "late" added 2026-09-07, confirmed with production during a live walkthrough: an order
 * can still be "on track" by the plain today-vs-Rev-Ex-Factory check while already
 * unable to make that date — e.g. an order at Loom with an 18-day stage standard, where
 * today + 18 days would already land past Rev Ex Factory, even though today itself
 * hasn't. Production's own words, live-translated: "if stage standard is 18 [days]...
 * today plus 18 days, if that's more than your expected [Rev Ex Factory], show them
 * that" — and explicitly, when asked to confirm before this went to the sales team: "flag
 * it as Late not delayed" (a real request from a later message, not this same call) —
 * kept as its own third state rather than folded into "delayed", since it's a
 * projection, not a fact yet. */
export function onTimeStatus(
  promisedDeliveryDate: string | null,
  revisedExFactoryDate: string | null,
  isTerminalStage: boolean,
  stageStandardDays: number | null,
): "on_track" | "late" | "delayed" | "unknown" {
  if (isTerminalStage) return "on_track";
  const target = revisedExFactoryDate ?? promisedDeliveryDate;
  if (!target) return "unknown";
  // Confirmed live 2026-09-07: 1,600+ real rows carry "1753-01-01" in Rev Ex Factory —
  // SQL Server's DateTime.MinValue, the ERP's "no date set" placeholder, not a real
  // date. orders-sync.mjs now converts this to null at the source going forward, but
  // guard here too so rows not yet re-synced don't show as wildly "delayed" in the
  // meantime — same as if there were no date at all.
  if (Number(target.slice(0, 4)) < 1900) return "unknown";
  const targetMs = new Date(target).getTime();
  if (Number.isNaN(targetMs)) return "unknown";
  const now = Date.now();
  if (now > targetMs) return "delayed";
  if (stageStandardDays !== null) {
    const predictedMs = now + stageStandardDays * 24 * 60 * 60 * 1000;
    if (predictedMs > targetMs) return "late";
  }
  return "on_track";
}
