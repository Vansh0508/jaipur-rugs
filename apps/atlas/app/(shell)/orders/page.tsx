import {
  listOrders,
  listOrderFacets,
  listStages,
  listFollowUpPersonEmails,
  DEFAULT_PAGE_SIZE,
  type OrderFilters,
  type AgingBucket,
  type DelayStatusFilter,
  type ConstructionType,
  type SortableColumn,
} from "@/lib/queries/orders";
import { getServerSupabaseClient } from "@/lib/supabaseClient.server";
import { OrdersTable } from "@/components/OrdersTable";
import { OrdersFilterPanel } from "@/components/OrdersFilterPanel";
import { OrdersPagination } from "@/components/OrdersPagination";
import { ExportOrdersButton } from "@/components/ExportOrdersButton";
import { StageChip } from "@/components/StageChip";

// Plain GET-based filters (?stageId=&q=&...) rather than client-side state — a
// shareable URL for "show me Loom stage" is worth more here than avoiding a full-page
// navigation, and RLS is already doing the real, security-relevant filtering server-side
// regardless. The actual filter bar lives in OrdersFilterPanel, rendered directly above
// the table (moved off the sidebar, 2026-09-10 — see that component's comment) — this
// page only computes the values it needs (facets, current selections, results,
// pagination, sort links).
//
// Full filter set ported from the pre-Atlas tool (ai.jaipurrugs.com/track-jr-order/) and
// its live-preview successor, confirmed 2026-09-05 via a feature-by-feature comparison —
// that tool was refined directly against real sales/ops feedback, so every field here is
// deliberate, not decorative. Real pagination (page/pageSize) replaces the old flat
// "rows to show" cap — see OrderListResult.totalCount.
type SearchParams = Record<string, string | string[] | undefined>;

function toSingle(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function toArray(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

export default async function OrdersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const supabase = await getServerSupabaseClient();
  const [stages, facets, followUpPersonEmails] = await Promise.all([
    listStages(supabase),
    listOrderFacets(supabase),
    listFollowUpPersonEmails(supabase),
  ]);
  const terminalStageIds = stages.filter((s) => s.is_terminal).map((s) => s.id);

  const pageSize = Number(toSingle(params.pageSize)) || DEFAULT_PAGE_SIZE;
  const page = Math.max(1, Number(toSingle(params.page)) || 1);
  const sortBy = toSingle(params.sortBy) as SortableColumn | undefined;
  const sortDir = (toSingle(params.sortDir) as "asc" | "desc" | undefined) ?? "desc";

  const filters: OrderFilters = {
    search: toSingle(params.q),
    stageId: toArray(params.stageId),
    customerNo: toArray(params.customerNo),
    merchantName: toArray(params.merchantName),
    orderWiseMerchant: toArray(params.orderWiseMerchant),
    followUpPerson: toArray(params.followUpPerson),
    customerPoNo: toArray(params.customerPoNo),
    quality: toArray(params.quality),
    design: toArray(params.design),
    size: toArray(params.size),
    productionOrderStatus: toArray(params.productionOrderStatus),
    priority: toArray(params.priority),
    aging: toSingle(params.aging) as AgingBucket | undefined,
    onHold: toSingle(params.onHold) as "yes" | "no" | undefined,
    quickShip: toSingle(params.quickShip) as "yes" | "no" | undefined,
    delayStatus: toSingle(params.delayStatus) as DelayStatusFilter | undefined,
    terminalStageIds,
    dueFrom: toSingle(params.dueFrom),
    dueTo: toSingle(params.dueTo),
    ctype: toSingle(params.ctype) as ConstructionType | undefined,
    page,
    pageSize,
    sortBy,
    sortDir,
  };

  const { rows: orders, totalCount } = await listOrders(supabase, filters);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const hasAnyFilter = Object.entries(params).some(
    ([k, v]) => !["page", "pageSize", "sortBy", "sortDir"].includes(k) && v,
  );

  const from = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);

  return (
    // h-full + overflow-hidden, scoped to just this page — main itself still keeps its
    // own overflow-y-auto as a fallback for every other page, but this page manages its
    // own scrolling internally (only the table body scrolls; title bar and pagination
    // stay put) via Table.ScrollContainer below, not this outer div.
    <div className="flex h-full flex-col gap-4 overflow-hidden">
      <OrdersFilterPanel
        stages={stages}
        facets={facets}
        hasAnyFilter={hasAnyFilter}
        values={{
          q: (params.q as string | undefined) ?? "",
          stageId: toArray(params.stageId),
          customerNo: toArray(params.customerNo),
          merchantName: toArray(params.merchantName),
          orderWiseMerchant: toArray(params.orderWiseMerchant),
          followUpPerson: toArray(params.followUpPerson),
          customerPoNo: toArray(params.customerPoNo),
          quality: toArray(params.quality),
          design: toArray(params.design),
          size: toArray(params.size),
          productionOrderStatus: toArray(params.productionOrderStatus),
          priority: toArray(params.priority),
          aging: toSingle(params.aging),
          onHold: toSingle(params.onHold),
          quickShip: toSingle(params.quickShip),
          delayStatus: toSingle(params.delayStatus),
          ctype: toSingle(params.ctype),
          dueFrom: toSingle(params.dueFrom),
          dueTo: toSingle(params.dueTo),
        }}
      />

      {/* Plain, non-scrolling content — no sticky/offset tricks needed here at all.
          Direct feedback, 2026-09-05: a manual sticky-offset hack on this block plus a
          second one on the table's header "messed the table" (they can't self-stack —
          each computes its own stuck position with no idea the other exists). Real fix:
          this bar and the pagination footer below just sit in normal flow, fixed in
          place, because ONLY the table's own Table.ScrollContainer scrolls — see
          OrdersTable, which now uses this app's real Table component (Hero UI, via
          @jaipur-rugs/ui-kit) instead of a hand-rolled <table>. */}
      <div className="flex shrink-0 items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Orders</h1>
          <p className="text-sm text-muted">
            Showing {from}-{to} of {totalCount}
            {hasAnyFilter ? " (filtered)" : ""}
          </p>
        </div>
        <ExportOrdersButton rows={orders} stages={stages} />
      </div>

      {toArray(params.stageId).length === 1 ? (
        <div className="shrink-0">
          {(() => {
            const stage = stages.find((s) => s.id === toArray(params.stageId)[0]);
            return stage ? <StageChip code={stage.code} label={`Filtered: ${stage.display_name}`} /> : null;
          })()}
        </div>
      ) : null}

      <div className="min-h-0 flex-1">
        <OrdersTable rows={orders} stages={stages} followUpPersonEmails={followUpPersonEmails} />
      </div>

      <OrdersPagination page={page} totalPages={totalPages} pageSize={pageSize} />
    </div>
  );
}
