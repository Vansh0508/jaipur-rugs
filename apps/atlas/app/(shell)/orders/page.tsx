import {
  listOrders,
  listOrderFacets,
  listStages,
  PAGE_SIZE_OPTIONS,
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
import { ExportOrdersButton } from "@/components/ExportOrdersButton";
import { StageChip } from "@/components/StageChip";
import Link from "next/link";

// Plain GET-based filters (?stageId=&q=&...) rather than client-side state — a
// shareable URL for "show me Loom stage" is worth more here than avoiding a full-page
// navigation, and RLS is already doing the real, security-relevant filtering server-side
// regardless. The actual filter FORM lives in OrdersFilterPanel, which portals itself
// into the sidebar (see that component's comment) — this page only computes the values
// it needs (facets, current selections, results, pagination, sort links).
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
  const [stages, facets] = await Promise.all([listStages(supabase), listOrderFacets(supabase)]);
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

  // Every current param, minus whichever one a given link is about to change — so
  // paging/sorting links carry the rest of the current filters forward instead of
  // clobbering them.
  function buildLink(overrides: Record<string, string | undefined>) {
    const p = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (key in overrides) continue;
      for (const v of toArray(value)) p.append(key, v);
    }
    for (const [key, value] of Object.entries(overrides)) {
      if (value !== undefined) p.set(key, value);
    }
    return `/orders?${p.toString()}`;
  }
  const pageLink = (newPage: number) => buildLink({ page: String(newPage) });
  const sortLinkFor = (column: SortableColumn, dir: "asc" | "desc") =>
    buildLink({ sortBy: column, sortDir: dir, page: undefined });

  const from = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);

  return (
    <div className="flex flex-col gap-6">
      <OrdersFilterPanel
        stages={stages}
        facets={facets}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
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
          pageSize,
        }}
      />

      {/* Sticky at the top of `main`'s own scroll region (not the page — see the shell
          layout's comment) so the title/count/export bar stays visible while scrolling
          through a long results list. Direct feedback, 2026-09-05: "the main orders
          list top panel" wasn't freezing (the sidebar fix alone didn't cover this — it's
          a separate sticky region). bg-background is required on anything sticky here,
          otherwise scrolled-past rows show through underneath it. */}
      <div className="sticky top-0 z-20 -mx-8 -mt-8 flex items-center justify-between bg-background px-8 pb-4 pt-8">
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
        <div>
          {(() => {
            const stage = stages.find((s) => s.id === toArray(params.stageId)[0]);
            return stage ? <StageChip code={stage.code} label={`Filtered: ${stage.display_name}`} /> : null;
          })()}
        </div>
      ) : null}

      <OrdersTable rows={orders} stages={stages} currentSort={sortBy} currentDir={sortDir} sortLinkFor={sortLinkFor} />

      <div className="flex items-center justify-between text-sm text-muted">
        <span>
          Page {page} of {totalPages}
        </span>
        <div className="flex gap-2">
          <Link
            href={pageLink(Math.max(1, page - 1))}
            aria-disabled={page <= 1}
            className={
              "rounded-lg border-2 border-border px-3 py-1.5 " +
              (page <= 1 ? "pointer-events-none opacity-40" : "hover:bg-surface-secondary")
            }
          >
            ← Prev
          </Link>
          <Link
            href={pageLink(Math.min(totalPages, page + 1))}
            aria-disabled={page >= totalPages}
            className={
              "rounded-lg border-2 border-border px-3 py-1.5 " +
              (page >= totalPages ? "pointer-events-none opacity-40" : "hover:bg-surface-secondary")
            }
          >
            Next →
          </Link>
        </div>
      </div>
    </div>
  );
}
