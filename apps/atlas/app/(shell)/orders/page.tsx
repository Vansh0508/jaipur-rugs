import {
  listOrders,
  listOrderFacets,
  listStages,
  listFollowUpPersonEmails,
  getMyOrdersViewPreferences,
  getOrdersSummary,
  DEFAULT_PAGE_SIZE,
  type OrderFilters,
  type AgingBucket,
  type DelayStatusFilter,
  type ConstructionType,
  type SortableColumn,
} from "@/lib/queries/orders";
import { getServerSupabaseClient } from "@/lib/supabaseClient.server";
import { requireAtlasStaffAccess } from "@/lib/auth/requireAtlasStaffAccess";
import { OrdersTable } from "@/components/OrdersTable";
import { OrdersSummaryPanel } from "@/components/OrdersSummaryPanel";
import { ExportOrdersButton } from "@/components/ExportOrdersButton";
import { StageChip } from "@/components/StageChip";

// Plain GET-based filters (?stageId=&q=&...) rather than client-side state — a
// shareable URL for "show me Loom stage" is worth more here than avoiding a full-page
// navigation, and RLS is already doing the real, security-relevant filtering server-side
// regardless. The filter bar itself lives inside OrdersTable now (moved off a separate
// OrdersFilterPanel and into the table's own controls row, 2026-09-14 — that component
// is retired, deleted the same day it became unused) — this page only computes the
// values it needs (facets, current selections, results, pagination, sort links).
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
  const [stages, facets, followUpPersonEmails, viewPreferences, access] = await Promise.all([
    listStages(supabase),
    listOrderFacets(supabase),
    listFollowUpPersonEmails(supabase),
    getMyOrdersViewPreferences(supabase),
    requireAtlasStaffAccess(supabase),
  ]);
  // The summary panel is strictly production-only — direct request when it was approved
  // for the live DB (2026-09-17): "this view should be visible only to production team,"
  // and, asked explicitly, NOT admins either. Everyone else skips the aggregate query
  // entirely, not just the rendering.
  const showSummary = access.departmentCodes.includes("production");
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
    onTimeStatus: toSingle(params.onTimeStatus) as OrderFilters["onTimeStatus"],
    terminalStageIds,
    dueFrom: toSingle(params.dueFrom),
    dueTo: toSingle(params.dueTo),
    ctype: toSingle(params.ctype) as ConstructionType | undefined,
    page,
    pageSize,
    sortBy,
    sortDir,
  };

  // The summary is a separate aggregate over the same filters (not a sum of this page's
  // rows — see getOrdersSummary), so the two run side by side rather than back to back.
  const [{ rows: orders, totalCount }, summary] = await Promise.all([
    listOrders(supabase, filters),
    showSummary ? getOrdersSummary(supabase, filters) : Promise.resolve(null),
  ]);
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
    <div className="flex h-full flex-col gap-3.5 overflow-hidden">
      <div className="flex shrink-0 items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Orders</h1>
          {toArray(params.stageId).length === 1 ? (
            (() => {
              const stage = stages.find((s) => s.id === toArray(params.stageId)[0]);
              return stage ? <StageChip code={stage.code} label={`Filtered: ${stage.display_name}`} /> : null;
            })()
          ) : null}
        </div>
        <ExportOrdersButton rows={orders} stages={stages} />
      </div>

      {summary ? <OrdersSummaryPanel summary={summary} stages={stages} /> : null}

      <div className="min-h-0 flex-1">
        <OrdersTable
          rows={orders}
          stages={stages}
          facets={facets}
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
            onTimeStatus: toSingle(params.onTimeStatus),
            ctype: toSingle(params.ctype),
            dueFrom: toSingle(params.dueFrom),
            dueTo: toSingle(params.dueTo),
          }}
          hasAnyFilter={hasAnyFilter}
          followUpPersonEmails={followUpPersonEmails}
          initialViewPreferences={viewPreferences}
          totalCount={totalCount}
          page={page}
          pageSize={pageSize}
          totalPages={totalPages}
        />
      </div>
    </div>
  );
}
