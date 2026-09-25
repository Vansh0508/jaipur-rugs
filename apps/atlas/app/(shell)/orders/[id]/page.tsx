import { notFound } from "next/navigation";
import { StageTimeline } from "@jaipur-rugs/ui-kit";
import { getServerSupabaseClient } from "@/lib/supabaseClient.server";
import { getOrder, getOrderStageEvents, getShippingDetail, listStages } from "@/lib/queries/orders";
import { buildFullStageHistory, formatDuration, onTimeStatus, daysLateFromOriginalExFactory } from "@/lib/tat";
import { stageStandard } from "@/lib/stageTat";
import { stageColorClassName } from "@/lib/stageColors";
import { displayDate } from "@/lib/displayDate";
import { knownCourierTrackingUrl } from "@/lib/dispatchTracking";
import { StageChip, OnTimeBadge } from "@/components/StageChip";
import { ShippingDetailForm } from "@/components/ShippingDetailForm";
import { StageCorrectionControl } from "@/components/StageCorrectionControl";

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getServerSupabaseClient();

  const [order, stages, events, shipping] = await Promise.all([
    getOrder(supabase, id),
    listStages(supabase),
    getOrderStageEvents(supabase, id),
    getShippingDetail(supabase, id),
  ]);

  // RLS returning null here means either the order doesn't exist or this account isn't
  // authorized to see it — indistinguishable by design (a 404, not a 403, doesn't leak
  // which orders exist to someone who can't see them).
  if (!order) notFound();

  const stageById = new Map(stages.map((s) => [s.id, s]));
  const currentStage = order.stage_id ? stageById.get(order.stage_id) : undefined;
  const standard = stageStandard({
    rawCurrentStatus: order.raw_current_status,
    quality: order.quality,
    size: order.size,
    stdCubage: order.std_cubage,
    orderPriority: order.order_priority,
    onHold: order.on_hold,
    currentStatusPendingDays: order.current_status_pending_days,
  });
  const status = onTimeStatus(
    order.promised_delivery_date,
    order.revised_ex_factory_date,
    currentStage?.is_terminal ?? false,
    standard.standardDays,
    order.ever_late,
  );
  const durations = buildFullStageHistory(
    stages.map((s) => ({ id: s.id, displayOrder: s.display_order })),
    events.map((e) => ({ stageId: e.stage_id, enteredAt: e.entered_at })),
    order.stage_id,
  );
  const origExFactoryDelay = daysLateFromOriginalExFactory(order.original_ex_factory_date, currentStage?.is_terminal ?? false);

  const timelineSteps = stages.map((stage) => ({
    key: stage.id,
    label: stage.display_name,
    colorClassName: stageColorClassName(stage.code),
  }));

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{order.otn_no}</h1>
          <p className="text-sm text-muted">
            {order.item_no} · {order.design ?? "—"} · {order.quality ?? "—"} · {order.size ?? "—"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StageChip code={currentStage?.code ?? null} label={currentStage?.display_name ?? "Unresolved"} />
          <OnTimeBadge status={status} />
        </div>
      </div>

      <div className="rounded-xl border-2 border-border p-5">
        <StageTimeline steps={timelineSteps} currentKey={order.stage_id} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="flex flex-col gap-3 rounded-xl border-2 border-border p-5">
          <h2 className="text-sm font-semibold uppercase text-muted">Order</h2>
          <DetailRow label="Merchant" value={order.merchant_name} />
          <DetailRow label="Customer No." value={order.customer_no} />
          <DetailRow label="Sales Order No." value={order.sales_order_no} />
          <DetailRow label="Customer PO No." value={order.customer_po_no} />
          <DetailRow label="Size" value={order.size} />
          {/* Direct fix, 2026-09-11: this used to be labeled "Salesperson" and show
              salesperson_code (a raw code, e.g. "JR-S001") — order_wise_merchant is the
              actual salesperson's name, same field the Orders table's own "Sales
              Person" column already uses. Kept to just Sales Order No. (above) + Sales
              Person (name) per direct follow-up, 2026-09-12 — no separate Sales Code
              row here (the Orders table still offers it as an optional column for
              anyone who wants it, see its Columns submenu). */}
          <DetailRow label="Sales Person" value={order.order_wise_merchant} />
          <DetailRow label="Follow Up Person" value={order.follow_up_person} />
          <DetailRow label="Sales Order Date" value={order.sales_order_date} />
          <DetailRow label="Original Ex Factory" value={displayDate(order.original_ex_factory_date)} />
          {/* Delay against the ORIGINAL Ex Factory date specifically, not Revised —
              direct request, 2026-09-11: Revised Ex Factory gets pushed by production on
              their own schedule, so "how late against what was first promised" needs the
              original date to stay meaningful. See daysLateFromOriginalExFactory's own
              comment for why this goes blank once the order reaches a terminal stage. */}
          <div className="flex items-center justify-between gap-4 text-sm">
            <span className="text-muted">Delay (Orig. Ex-Factory)</span>
            <span className={`font-medium ${origExFactoryDelay !== null && origExFactoryDelay > 0 ? "text-danger" : "text-foreground"}`}>
              {origExFactoryDelay === null ? "—" : origExFactoryDelay <= 0 ? "On time" : `${origExFactoryDelay}d late`}
            </span>
          </div>
          <DetailRow label="Revised Ex Factory" value={displayDate(order.revised_ex_factory_date)} />
          <DetailRow label="Revised Ex India" value={displayDate(order.revised_ex_india_date)} />
          {/* Promised Delivery deliberately removed, 2026-09-11 — stale field, not the
              real delay signal; see lib/tat.ts onTimeStatus's own comment on why Revised
              Ex Factory replaced it there back on 2026-09-07. */}
          <DetailRow label="Current Status (ERP)" value={order.raw_current_status} />
          {/* From NAV-011 (a different NAV report than the one that fills everything
              else on this page) — a dispatched rug just silently disappears from the
              usual Rug List view, with no "Dispatched" status text anywhere in it, so
              this is the only real source for these two facts. See
              ERP_AND_EXTERNAL_REQUESTS.md request #9. */}
          {order.dispatched_at ? (
            <>
              {/* dispatched_at is a timestamptz (set from a plain date, but Postgres/
                  Supabase round-trips it with a time component) — sliced to just the
                  date, same as every other date field on this page. */}
              <DetailRow label="Dispatched" value={displayDate(order.dispatched_at?.slice(0, 10) ?? null)} />
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="text-muted">Tracking</span>
                {order.tracking_no ? (
                  knownCourierTrackingUrl(order.shipping_agent_name) ? (
                    <a
                      href={knownCourierTrackingUrl(order.shipping_agent_name)!}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-accent hover:underline"
                    >
                      {order.tracking_no} via {order.shipping_agent_name}
                    </a>
                  ) : (
                    <span className="font-medium text-foreground">
                      {order.tracking_no} — via {order.shipping_agent_name ?? "unknown transporter"} (no online tracking)
                    </span>
                  )
                ) : (
                  <span className="font-medium text-muted">Tracking Not Updated in NAV</span>
                )}
              </div>
            </>
          ) : null}
          <div className="flex items-center justify-between pt-2">
            <span className="text-sm text-muted">Stage doesn't look right?</span>
            <StageCorrectionControl orderId={order.id} stages={stages} currentStageId={order.stage_id} />
          </div>
        </section>

        <section className="flex flex-col gap-3 rounded-xl border-2 border-border p-5">
          <h2 className="text-sm font-semibold uppercase text-muted">Stage history / TAT</h2>
          {durations.length === 0 ? (
            <p className="text-sm text-muted">No stage history recorded yet.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase text-muted">
                  <th className="py-1 font-medium">Stage</th>
                  <th className="py-1 font-medium">Entered</th>
                  <th className="py-1 font-medium">Exited</th>
                  <th className="py-1 font-medium">Days Spent</th>
                  <th className="py-1 font-medium">Standard</th>
                </tr>
              </thead>
              <tbody>
                {durations.map((d) => {
                  const stage = stageById.get(d.stageId);
                  // The expected/standard days is only knowable for the CURRENT stage —
                  // history only records which coarse stage (Pre-Loom/Loom/...) an order
                  // was in, not the exact ERP sub-status stageStandard() actually needs
                  // (e.g. "At Design" vs "At PPC" both land in the same coarse "Pre-Loom"
                  // bucket but have very different standards, 15d vs 1d). Showing a
                  // guessed number for a past stage would be actively misleading on a
                  // real production tool, so past rows get "—", not a guess.
                  const standardDays = d.isCurrent ? standard.standardDays : null;
                  // Placeholder row (buildFullStageHistory): this order's timeline shows
                  // it reached this stage, but Atlas has no recorded event for it —
                  // tracking started after the order was already past this point. Shown
                  // plainly as "Not tracked" rather than a blank/guessed date, per direct
                  // feedback that the history table should visually match the timeline
                  // above it instead of silently omitting stages.
                  if (d.isPlaceholder) {
                    return (
                      <tr key={`placeholder-${d.stageId}`} className="border-t border-border text-muted">
                        <td className="py-1.5">
                          <StageChip code={stage?.code ?? null} label={stage?.display_name ?? "Unknown"} />
                        </td>
                        <td className="py-1.5" colSpan={3} title="Atlas started tracking this order after it had already passed this stage — no exact dates available.">
                          Not tracked (before Atlas began recording this order's history)
                        </td>
                        <td className="py-1.5">—</td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={`${d.stageId}-${d.enteredAt}`} className="border-t border-border">
                      <td className="py-1.5">
                        <StageChip code={stage?.code ?? null} label={stage?.display_name ?? "Unknown"} />
                      </td>
                      <td className="py-1.5 text-muted">{displayDate(d.enteredAt)}</td>
                      <td className="py-1.5 text-muted">{displayDate(d.exitedAt)}</td>
                      <td className="py-1.5">
                        {formatDuration(d.durationMs)}
                        {d.isCurrent ? <span className="ml-1 text-xs text-muted">(current)</span> : null}
                      </td>
                      <td
                        className="py-1.5 text-muted"
                        title={!d.isCurrent ? "Not tracked for past stages — only the current stage's exact ERP status is known" : undefined}
                      >
                        {standardDays !== null ? `${standardDays}d` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <ShippingDetailForm orderId={order.id} existing={shipping} />
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-muted">{label}</span>
      <span className="font-medium text-foreground">{value ?? "—"}</span>
    </div>
  );
}
