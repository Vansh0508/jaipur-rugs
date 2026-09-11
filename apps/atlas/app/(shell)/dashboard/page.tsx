import { getServerSupabaseClient } from "@/lib/supabaseClient.server";
import { getDashboardStats, listStages } from "@/lib/queries/orders";
import { DashboardStat } from "@/components/DashboardStat";
import { StageChip } from "@/components/StageChip";
import Link from "next/link";

// The one shared page the director asked for (build prompt Section 2) — a top-level
// summary, not a re-implementation of the Orders list. Deliberately thin: total, a
// delayed count (the on-time signal the build prompt calls the whole point of this
// rebuild), and a per-stage breakdown. Resist adding more here than that.
//
// Uses getDashboardStats(), not listOrders() with a limit — a "total" that's silently
// capped at some arbitrary row count isn't a total. See that function's comment
// (confirmed live 2026-09-02: this page showed "1000" against a real 14,214-row table
// before that was first fixed). getDashboardStats() also excludes the 5 internal
// stock/inventory customer codes (STOCK_CUSTOMER_CODES) — confirmed live 2026-09-03 that
// 24.5% of the previous 14,214 total were stock rows, not real orders.
//
// Two separate counts are shown, not one — "rug lines" (one row per item, the level
// stage-tracking actually happens at) and "sales orders" (one Sales Order can contain
// several rugs). Confirmed live 2026-09-03: those 14,214 rows resolved to only 3,757
// distinct Sales Order Nos, so a single "Orders in view" number was quietly answering
// two different questions depending on who read it.
//
// getDashboardStats() itself now aggregates in Postgres in one round trip (see
// db/orders/018_perf_facets_and_stats_rpcs.sql and that function's own comment) instead
// of this page pulling every real order into Node to filter/reduce by hand — confirmed
// live via EXPLAIN ANALYZE that the old per-row JS approach was the single biggest
// reason this page felt slow (~14 sequential round trips at today's ~13.6k-row scale).
export default async function DashboardPage() {
  const supabase = await getServerSupabaseClient();
  const [stats, stages] = await Promise.all([getDashboardStats(supabase), listStages(supabase)]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted">Everything you have visibility into, in one place.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardStat label="Rug lines in view" value={stats.total} />
        <DashboardStat label="Distinct sales orders" value={stats.distinctSalesOrders} />
        <DashboardStat label="Delayed" value={stats.delayedCount} />
        <DashboardStat label="On track" value={stats.total - stats.delayedCount} />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase text-muted">By stage</h2>
        <div className="flex flex-wrap gap-3">
          {stages.map((stage) => (
            <Link
              key={stage.id}
              href={`/orders?stageId=${stage.id}`}
              className="flex items-center gap-2 rounded-xl border-2 border-border px-4 py-3 hover:bg-surface-secondary"
            >
              <StageChip code={stage.code} label={stage.display_name} />
              <span className="text-sm font-medium text-foreground">{stats.countsByStage[stage.id] ?? 0}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
