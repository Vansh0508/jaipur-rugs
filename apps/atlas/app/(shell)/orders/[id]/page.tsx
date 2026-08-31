import { notFound } from "next/navigation";
import { StageTimeline } from "@jaipur-rugs/ui-kit";
import { getServerSupabaseClient } from "@/lib/supabaseClient.server";
import { getOrder, getOrderStageEvents, getShippingDetail, listStages } from "@/lib/queries/orders";
import { computeStageDurations, formatDuration, onTimeStatus } from "@/lib/tat";
import { stageColorClassName } from "@/lib/stageColors";
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
  const status = onTimeStatus(order.promised_delivery_date, order.revised_ex_factory_date, currentStage?.is_terminal ?? false);
  const durations = computeStageDurations(events.map((e) => ({ stageId: e.stage_id, enteredAt: e.entered_at })));

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
          <DetailRow label="Salesperson" value={order.salesperson_code} />
          <DetailRow label="Follow Up Person" value={order.follow_up_person} />
          <DetailRow label="Sales Order Date" value={order.sales_order_date} />
          <DetailRow label="Promised Delivery" value={order.promised_delivery_date} />
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
                  <th className="py-1 font-medium">Duration</th>
                </tr>
              </thead>
              <tbody>
                {durations.map((d) => {
                  const stage = stageById.get(d.stageId);
                  return (
                    <tr key={`${d.stageId}-${d.enteredAt}`} className="border-t border-border">
                      <td className="py-1.5">
                        <StageChip code={stage?.code ?? null} label={stage?.display_name ?? "Unknown"} />
                      </td>
                      <td className="py-1.5 text-muted">{new Date(d.enteredAt).toLocaleDateString()}</td>
                      <td className="py-1.5">
                        {formatDuration(d.durationMs)}
                        {d.isCurrent ? <span className="ml-1 text-xs text-muted">(current)</span> : null}
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
