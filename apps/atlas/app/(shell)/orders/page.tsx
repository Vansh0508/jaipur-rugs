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
} from "@/lib/queries/orders";
import { getServerSupabaseClient } from "@/lib/supabaseClient.server";
import { OrdersTable } from "@/components/OrdersTable";
import { ExportOrdersButton } from "@/components/ExportOrdersButton";
import { StageChip } from "@/components/StageChip";
import Link from "next/link";

// Plain GET-based filters (?stageId=&q=&...) rather than client-side state — a
// shareable URL for "show me Loom stage" is worth more here than avoiding a full-page
// navigation, and RLS is already doing the real, security-relevant filtering server-side
// regardless. Every multi-select field submits as repeated same-name query params via a
// plain native <select multiple> — no client JS needed for that part.
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

/** A plain multi-select — native browser multi-pick (ctrl/cmd+click, or shift-click a
 * range), submits every selected option as a repeated `name` query param on a GET form.
 * Deliberately not a fancier searchable-checkbox widget (that's real UI work of its own,
 * tracked separately) — this is the same exact-multi-match filtering the old tool had,
 * just with a simpler control for now. */
function MultiSelect({ name, label, options, selected, size = 5 }: {
  name: string;
  label: string;
  options: string[];
  selected: string[];
  size?: number;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="font-medium uppercase text-muted">{label}</span>
      <select
        name={name}
        multiple
        size={Math.min(size, Math.max(3, options.length))}
        defaultValue={selected}
        className="rounded-lg border-2 border-border bg-transparent px-2 py-1 text-sm outline-none focus:border-accent"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </label>
  );
}

function SingleSelect({ name, label, options, selected }: {
  name: string;
  label: string;
  options: { value: string; label: string }[];
  selected?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="font-medium uppercase text-muted">{label}</span>
      <select
        name={name}
        defaultValue={selected ?? ""}
        className="rounded-lg border-2 border-border bg-transparent px-2 py-1 text-sm outline-none focus:border-accent"
      >
        <option value="">Any</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default async function OrdersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const supabase = await getServerSupabaseClient();
  const [stages, facets] = await Promise.all([listStages(supabase), listOrderFacets(supabase)]);
  const terminalStageIds = stages.filter((s) => s.is_terminal).map((s) => s.id);

  const pageSize = Number(toSingle(params.pageSize)) || DEFAULT_PAGE_SIZE;
  const page = Math.max(1, Number(toSingle(params.page)) || 1);

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
  };

  const { rows: orders, totalCount } = await listOrders(supabase, filters);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const hasAnyFilter = Object.entries(params).some(([k, v]) => k !== "page" && k !== "pageSize" && v);

  // Every current filter, minus `page` — used to build Prev/Next/page-size links that
  // don't clobber whatever's currently filtered.
  const filterParamsForPaging = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "page") continue;
    for (const v of toArray(value)) filterParamsForPaging.append(key, v);
  }
  function pageLink(newPage: number, newPageSize?: number) {
    const p = new URLSearchParams(filterParamsForPaging);
    p.set("page", String(newPage));
    if (newPageSize) p.set("pageSize", String(newPageSize));
    return `/orders?${p.toString()}`;
  }

  const from = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);

  return (
    <div className="flex items-start gap-6">
      {/* Enterprise-style docked left filter panel (2026-09-05, per direct feedback —
          the original horizontal filter block "looked messy") — sticky so it stays
          in view while the results table scrolls, same as the old tool's own sticky
          sidebar filter panel. */}
      <form
        method="get"
        className="sticky top-4 flex w-72 shrink-0 flex-col gap-4 rounded-xl border-2 border-border p-4"
      >
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase text-muted">Filters</h2>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium uppercase text-muted">Search</span>
            <input
              type="search"
              name="q"
              defaultValue={(params.q as string | undefined) ?? ""}
              placeholder="OTN, item, customer, quality…"
              className="rounded-lg border-2 border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </label>
        </div>

        <div className="flex flex-col gap-3">
          <MultiSelect name="stageId" label="Stage" options={stages.map((s) => s.id)} selected={toArray(params.stageId)} />
          <MultiSelect name="customerNo" label="Customer No." options={facets.customerNo} selected={toArray(params.customerNo)} />
          <MultiSelect name="merchantName" label="Merchant" options={facets.merchantName} selected={toArray(params.merchantName)} />
          <MultiSelect name="orderWiseMerchant" label="Order-wise Merchant" options={facets.orderWiseMerchant} selected={toArray(params.orderWiseMerchant)} />
          <MultiSelect name="followUpPerson" label="Follow-up Person" options={facets.followUpPerson} selected={toArray(params.followUpPerson)} />
          <MultiSelect name="customerPoNo" label="Customer PO No." options={facets.customerPoNo} selected={toArray(params.customerPoNo)} />
          <MultiSelect name="quality" label="Quality" options={facets.quality} selected={toArray(params.quality)} />
          <MultiSelect name="design" label="Design" options={facets.design} selected={toArray(params.design)} />
          <MultiSelect name="size" label="Size" options={facets.size} selected={toArray(params.size)} />
          <MultiSelect name="productionOrderStatus" label="Prod. Status" options={facets.productionOrderStatus} selected={toArray(params.productionOrderStatus)} />
          <MultiSelect name="priority" label="Priority" options={facets.priority} selected={toArray(params.priority)} />
          <SingleSelect
            name="aging"
            label="Aging"
            selected={toSingle(params.aging)}
            options={[
              { value: "0-7", label: "0-7 days" },
              { value: "8-15", label: "8-15 days" },
              { value: "16-30", label: "16-30 days" },
              { value: "30+", label: "30+ days" },
            ]}
          />
          <SingleSelect
            name="onHold"
            label="On Hold"
            selected={toSingle(params.onHold)}
            options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]}
          />
          <SingleSelect
            name="quickShip"
            label="Quick Ship"
            selected={toSingle(params.quickShip)}
            options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]}
          />
          <SingleSelect
            name="delayStatus"
            label="Delay Status"
            selected={toSingle(params.delayStatus)}
            options={[
              { value: "late", label: "⚠ Late" },
              { value: "soon", label: "⏰ Due in 7 days" },
              { value: "late_or_soon", label: "Late + due in 7 days" },
            ]}
          />
          <SingleSelect
            name="ctype"
            label="Construction"
            selected={toSingle(params.ctype)}
            options={[
              { value: "knotted", label: "Knotted" },
              { value: "tufted", label: "Tufted" },
              { value: "handloom", label: "Handloom" },
              { value: "swatch", label: "Swatch/sample (<4 sqft)" },
              { value: "other", label: "Other" },
            ]}
          />
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium uppercase text-muted">Rev. Ex-Factory from</span>
            <input
              type="date"
              name="dueFrom"
              defaultValue={toSingle(params.dueFrom) ?? ""}
              className="rounded-lg border-2 border-border bg-transparent px-2 py-1 text-sm outline-none focus:border-accent"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium uppercase text-muted">Rev. Ex-Factory to</span>
            <input
              type="date"
              name="dueTo"
              defaultValue={toSingle(params.dueTo) ?? ""}
              className="rounded-lg border-2 border-border bg-transparent px-2 py-1 text-sm outline-none focus:border-accent"
            />
          </label>
        </div>

        <div className="flex flex-col gap-2 border-t-2 border-border pt-3">
          <SingleSelect
            name="pageSize"
            label="Rows per page"
            selected={String(pageSize)}
            options={PAGE_SIZE_OPTIONS.map((n) => ({ value: String(n), label: String(n) }))}
          />
          <button type="submit" className="rounded-lg border-2 border-border px-3 py-2 text-sm hover:bg-surface-secondary">
            Apply filters
          </button>
          {hasAnyFilter ? (
            <Link href="/orders" className="text-center text-sm text-accent hover:underline">
              Clear all
            </Link>
          ) : null}
        </div>
      </form>

      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <div className="flex items-center justify-between">
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

        <OrdersTable rows={orders} stages={stages} />

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
    </div>
  );
}
