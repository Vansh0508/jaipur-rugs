import { notFound } from "next/navigation";
import { StageTimeline } from "@jaipur-rugs/ui-kit";
import { getServerMerchantSupabaseClient } from "@/lib/merchant/supabaseClient.server";
import { getOrder, getOrderStageEvents, listStages } from "@/lib/queries/orders";
import { onTimeStatus } from "@/lib/tat";
import { stageColorClassName } from "@/lib/stageColors";
import { StageChip, OnTimeBadge } from "@/components/StageChip";

// Restrained on purpose — no internal fields (salesperson, raw ERP status text,
// production order numbers), no editing controls. Just "where is my order."
export default async function MerchantOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getServerMerchantSupabaseClient();

  const [order, stages, events] = await Promise.all([
    getOrder(supabase, id),
    listStages(supabase),
    getOrderStageEvents(supabase, id),
  ]);

  if (!order) notFound();

  const stageById = new Map(stages.map((s) => [s.id, s]));
  const currentStage = order.stage_id ? stageById.get(order.stage_id) : undefined;
  const status = onTimeStatus(order.promised_delivery_date, order.revised_ex_factory_date, currentStage?.is_terminal ?? false);
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
            {order.design ?? "—"} · {order.quality ?? "—"} · {order.size ?? "—"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StageChip code={currentStage?.code ?? null} label={currentStage?.display_name ?? "In progress"} />
          <OnTimeBadge status={status} />
        </div>
      </div>

      <div className="rounded-xl border-2 border-border p-5">
        <StageTimeline steps={timelineSteps} currentKey={order.stage_id} orientation="vertical" />
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
        <DetailRow label="Sales Order No." value={order.sales_order_no} />
        <DetailRow label="Sales Order Date" value={order.sales_order_date} />
        <DetailRow label="Promised Delivery" value={order.promised_delivery_date} />
      </div>

      {events.length === 0 ? <p className="text-sm text-muted">No history recorded yet.</p> : null}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-xs uppercase text-muted">{label}</div>
      <div className="font-medium text-foreground">{value ?? "—"}</div>
    </div>
  );
}
