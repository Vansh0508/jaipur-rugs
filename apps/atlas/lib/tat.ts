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
  /** ISO timestamp this stage was left (= the next event's enteredAt), or null for the
   * current stage — it hasn't been left yet. Added 2026-09-11 per direct request: the
   * Stage History table used to show only "Entered," not when an order moved on from
   * that stage. */
  exitedAt: string | null;
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
      exitedAt: next ? next.enteredAt : null,
      durationMs: Math.max(0, endMs - startMs),
      isCurrent: !next,
    };
  });
}

export interface StageWithOrder {
  id: string;
  displayOrder: number;
}

/** Direct feedback, Back Ops walkthrough (transcript reviewed 2026-09-22): "all the stage
 * history should be visible here" — the Stage History table only ever shows real
 * `order_stage_events` rows, but for most orders (confirmed live: ~80% of orders sitting
 * in Finishing have exactly ONE recorded event) that's just the single stage Atlas
 * happened to first observe the order in, not its real path — Atlas started tracking
 * after most existing orders were already mid-pipeline, so earlier transitions were never
 * seen and genuinely can't be recovered. Meanwhile the stage timeline widget at the top of
 * this same page already draws every stage before the current one as "reached," so a
 * table showing only 1 row while the timeline implies 4 looked like a bug even though the
 * underlying UI code was already correct for the data it had.
 *
 * This closes that visual gap honestly: for every stage between the sequence start and
 * the current stage that has NO real event, insert a placeholder row (no dates, no
 * duration) instead of a guess — so the table visually matches the timeline without
 * pretending to know something it doesn't. Real rows (from computeStageDurations) are
 * untouched and always take precedence over a placeholder for the same stage. */
export interface StageHistoryRow extends StageDuration {
  isPlaceholder: boolean;
}

export function buildFullStageHistory(
  stages: StageWithOrder[],
  events: StageEvent[],
  currentStageId: string | null,
): StageHistoryRow[] {
  const real = computeStageDurations(events);
  const realRows: StageHistoryRow[] = real.map((d) => ({ ...d, isPlaceholder: false }));
  if (!currentStageId) return realRows;

  const sortedStages = [...stages].sort((a, b) => a.displayOrder - b.displayOrder);
  const currentStage = sortedStages.find((s) => s.id === currentStageId);
  if (!currentStage) return realRows;

  const stageIdsWithRealEvents = new Set(real.map((d) => d.stageId));
  // Only fill the gap for a stage whose place in the sequence is BEFORE the earliest
  // real event we actually have — a stage after that point but still missing an event
  // is a different situation (e.g. a genuinely skipped stage) this isn't trying to guess
  // at, only the "never observed because tracking started later" gap at the front.
  const earliestRealDisplayOrder = real.length
    ? Math.min(...real.map((d) => sortedStages.find((s) => s.id === d.stageId)?.displayOrder ?? Infinity))
    : currentStage.displayOrder + 1; // no real events at all — treat everything as a gap up to current

  const placeholders: StageHistoryRow[] = sortedStages
    .filter((s) => s.displayOrder < earliestRealDisplayOrder && s.displayOrder <= currentStage.displayOrder && !stageIdsWithRealEvents.has(s.id))
    .map((s) => ({
      stageId: s.id,
      enteredAt: "",
      exitedAt: null,
      durationMs: 0,
      isCurrent: false,
      isPlaceholder: true,
    }));

  return [...placeholders, ...realRows];
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
/** Days today is past ORIGINAL Ex Factory — deliberately the original date, not
 * Revised, per direct request 2026-09-11: production revises Rev Ex Factory on their
 * own schedule, so it "moves" and stops answering "how late did this end up being
 * against what was first promised" — original_ex_factory_date never changes, so this is
 * the one number that keeps that question honest. Positive = late, zero-or-negative =
 * not due yet (not "late" in either sense, so callers should treat <= 0 as on-time
 * rather than a countdown).
 *
 * null once an order reaches a terminal stage (delivered/rejected) — same reasoning as
 * onTimeStatus's own terminal short-circuit just above: "today minus a fixed date" keeps
 * growing forever after the order is actually done, so it stops being a meaningful
 * number the moment there's no live order left to be late on. Also null for a missing or
 * placeholder (pre-1900 / SQL Server DateTime.MinValue) date — see displayDate.ts. */
export function daysLateFromOriginalExFactory(
  originalExFactoryDate: string | null,
  isTerminalStage: boolean,
): number | null {
  if (isTerminalStage) return null;
  if (!originalExFactoryDate || Number(originalExFactoryDate.slice(0, 4)) < 1900) return null;
  const startMs = new Date(`${originalExFactoryDate}T00:00:00Z`).getTime();
  if (Number.isNaN(startMs)) return null;
  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((todayUtc - startMs) / (24 * 60 * 60 * 1000));
}

/** `everLate` — sticky "has this order EVER been Late or Delayed" flag (`orders.ever_late`,
 * db/orders/040_sticky_late_status.sql), the SQL port's own ratchet, kept in this TS copy too.
 * Direct feedback, Back Ops walkthrough (2026-09-22): once a stage has ever run over its own
 * standard, "Late" should stay true even if a later stage recovers pace — their own analogy,
 * a train delayed at one station is presumed late at the destination even if it makes up
 * time in between. Explicitly still named "Late", not "Probable Delay" — matches this app's
 * already-established naming (2026-09-07: "flag it as Late not delayed"). "Delayed" is
 * unaffected — it already always takes precedence over "Late" below. */
export function onTimeStatus(
  promisedDeliveryDate: string | null,
  revisedExFactoryDate: string | null,
  isTerminalStage: boolean,
  stageStandardDays: number | null,
  everLate: boolean,
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
  return everLate ? "late" : "on_track";
}
