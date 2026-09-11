import { notFound } from "next/navigation";
import { StageTimeline } from "@jaipur-rugs/ui-kit";
import { getServerSupabaseClient } from "@/lib/supabaseClient.server";
import { getOrder, getOrderStageEvents, getShippingDetail, listStages } from "@/lib/queries/orders";
import { computeStageDurations, formatDuration, onTimeStatus, daysLateFromOriginalExFactory } from "@/lib/tat";
import { stageStandard } from "@/lib/stageTat";
import { stageColorClassName } from "@/lib/stageColors";
import { displayDate } from "@/lib/displayDate";
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
  );
  const durations = computeStageDurations(events.map((e) => ({ stageId: e.stage_id, enteredAt: e.entered_at })));
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
          <DetailRow label="Sales Code" value={order.salesperson_code} />
          {/* Direct fix, 2026-09-11: this used to be labeled "Salesperson" and show
              salesperson_code (a raw code, e.g. "JR-S001") — order_wise_merchant is the
              actual salesperson's name, same field the Orders table's own "Sales
              Person" column already uses. */}
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
                  return (
                    <tr key={`${d.stageId}-${d.enteredAt}`} className="border-t border-border">
                      <td className="py-1.5">
                        <StageChip code={stage?.code ?? null} label={stage?.display_name ?? "Unknown"} />
                      </td>
                      <td className="py-1.5 text-muted">{new Date(d.enteredAt).toLocaleDateString()}</td>
                      <td className="py-1.5 text-muted">
                        {d.exitedAt ? new Date(d.exitedAt).toLocaleDateString() : "—"}
                      </td>
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
