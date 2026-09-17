"use client";

import { ChevronDown } from "@gravity-ui/icons";
import { useLocalPreference } from "@/lib/useLocalPreference";
import { stageColorClassName } from "@/lib/stageColors";
import type { OrdersSummary, OrdersSummaryStage, OnTimeStatus, StageRow } from "@/lib/queries/orders";

// Fixed locale on purpose: this renders on the server first, and a bare toLocaleString()
// would format with the server's locale and then re-format with the browser's on
// hydration — a guaranteed mismatch warning the moment those two differ.
const countFormat = new Intl.NumberFormat("en-IN");
const sqftFormat = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

function fmtCount(n: number): string {
  return countFormat.format(n);
}

function fmtSqft(n: number): string {
  return sqftFormat.format(Math.round(n));
}

// Same status vocabulary, same colours as OnTimeBadge — the split shown here is over the
// exact same computed_on_time_status each row's badge shows, so the two can't disagree.
// The tooltips restate the Late-vs-Delayed distinction because it needed explaining twice
// in the same room during the 2026-09-17 production UAT.
const STATUS_META: { key: OnTimeStatus; label: string; dot: string; text: string; hint: string }[] = [
  {
    key: "delayed",
    label: "Delayed",
    dot: "bg-danger",
    text: "text-danger",
    hint: "Already past the revised ex-factory date",
  },
  {
    key: "late",
    label: "Late",
    dot: "bg-warning",
    text: "text-warning",
    hint: "Not yet due, but at the current stage's standard pace it will miss the revised ex-factory date",
  },
  {
    key: "on_track",
    label: "On track",
    dot: "bg-success",
    text: "text-success",
    hint: "On pace for the revised ex-factory date",
  },
  {
    key: "unknown",
    label: "No target date",
    dot: "bg-neutral-400",
    text: "text-muted",
    hint: "No revised ex-factory or promised delivery date to compare against",
  },
];

function PiecesAndSqft({ count, sqft, emphasis = false }: { count: number; sqft: number; emphasis?: boolean }) {
  const num = emphasis ? "text-sm font-semibold text-foreground" : "font-semibold text-foreground";
  return (
    <>
      <span className={num}>{fmtCount(count)}</span>
      <span className="text-muted">pcs</span>
      <span className="text-muted">·</span>
      <span className={num}>{fmtSqft(sqft)}</span>
      <span className="text-muted">sq ft</span>
    </>
  );
}

/** Filter-following totals above the Orders table — pieces and square feet in view,
 * split by on-time status, with an optional per-stage breakdown. Every number covers
 * the whole filtered set across all pages (see getOrdersSummary), not just the rows
 * currently on screen. */
export function OrdersSummaryPanel({ summary, stages }: { summary: OrdersSummary; stages: StageRow[] }) {
  const [showStages, setShowStages] = useLocalPreference("atlas:orders-summary-stages", false);

  const stageRows = stages
    .map((stage) => ({ stage, totals: summary.byStage[stage.id] }))
    .filter((entry): entry is { stage: StageRow; totals: OrdersSummaryStage } => Boolean(entry.totals && entry.totals.count > 0));

  return (
    <section
      aria-label="Summary of orders matching the current filters"
      className="shrink-0 rounded-2xl border border-border bg-surface px-3 py-2 shadow-xs"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
        <div
          className="flex items-center gap-1.5"
          title="Totals for every order matching the current filters, across all pages — not just the rows on this page"
        >
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">In view</span>
          <PiecesAndSqft count={summary.totalCount} sqft={summary.totalSqft} emphasis />
        </div>

        <div className="hidden h-4 w-px bg-border/80 sm:block" aria-hidden="true" />

        {STATUS_META.map((meta) => {
          const bucket = summary.byStatus[meta.key];
          if (meta.key === "unknown" && bucket.count === 0) return null;
          return (
            <div key={meta.key} className="flex items-center gap-1.5" title={meta.hint}>
              <span className={`inline-block h-2 w-2 rounded-full ${meta.dot}`} aria-hidden="true" />
              <span className={`font-medium ${meta.text}`}>{meta.label}</span>
              <PiecesAndSqft count={bucket.count} sqft={bucket.sqft} />
            </div>
          );
        })}

        <button
          type="button"
          onClick={() => setShowStages((prev) => !prev)}
          aria-expanded={showStages}
          className="ml-auto inline-flex cursor-pointer items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-muted transition-colors hover:bg-neutral-100 hover:text-foreground dark:hover:bg-neutral-800"
        >
          By stage
          <ChevronDown
            width={13}
            height={13}
            className={`transition-transform duration-200 ${showStages ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {showStages ? (
        <div className="mt-2 flex flex-wrap gap-2 border-t border-border/60 pt-2">
          {stageRows.length === 0 ? (
            <p className="text-xs text-muted">No orders match the current filters.</p>
          ) : (
            stageRows.map(({ stage, totals }) => (
              <div
                key={stage.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs"
              >
                <span className={`h-2 w-2 rounded-full ${stageColorClassName(stage.code)}`} aria-hidden="true" />
                <span className="font-medium text-foreground">{stage.display_name}</span>
                <span className="text-muted">
                  {fmtCount(totals.count)} pcs · {fmtSqft(totals.sqft)} sq ft
                </span>
                {totals.delayedCount > 0 ? (
                  <span className="text-danger">· {fmtSqft(totals.delayedSqft)} sq ft delayed</span>
                ) : null}
                {totals.lateCount > 0 ? (
                  <span className="text-warning">· {fmtSqft(totals.lateSqft)} sq ft late</span>
                ) : null}
              </div>
            ))
          )}
        </div>
      ) : null}
    </section>
  );
}
