"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { FacetDropdown, SingleSelect } from "@/components/FilterPrimitives";
import { useLocalPreference } from "@/lib/useLocalPreference";
import type { StageRow, OrderFacets } from "@/lib/queries/orders";

// Used to portal itself into the sidebar (direct feedback, 2026-09-05: "keep the
// filters in the same side bar below My access") — reversed 2026-09-10: filters now
// render directly above the Orders table as a bar of dropdowns instead, and every
// multi-value facet moved from a plain checkbox list onto Hero UI's real Dropdown (see
// FilterPrimitives.tsx's FacetDropdown). Each control applies itself the moment it's
// set (a dropdown closing, a `<select>` changing, Enter/blur on the search box) rather
// than needing one shared "Apply filters" submit button — same end result (a fresh
// `/orders?...` navigation carrying every filter), just field-by-field now.
//
// pageSize/PAGE_SIZE_OPTIONS moved out of this panel entirely, 2026-09-10 — the
// row-count control now lives next to pagination in OrdersTable.tsx, not buried in the
// filter form.
export interface OrdersFilterPanelProps {
  stages: StageRow[];
  facets: OrderFacets;
  values: {
    q: string;
    stageId: string[];
    customerNo: string[];
    merchantName: string[];
    orderWiseMerchant: string[];
    followUpPerson: string[];
    customerPoNo: string[];
    quality: string[];
    design: string[];
    size: string[];
    productionOrderStatus: string[];
    priority: string[];
    aging?: string;
    onHold?: string;
    quickShip?: string;
    delayStatus?: string;
    ctype?: string;
    dueFrom?: string;
    dueTo?: string;
  };
  hasAnyFilter: boolean;
}

/** Every param this panel does NOT model itself (sortBy/sortDir from OrdersTable's own
 * sort links, page from pagination) — everything else in `values`' keys, listed here so
 * apply() can tell "a filter this panel controls" apart from "something else entirely,
 * just passing through." */
const OWN_KEYS = new Set([
  "q", "stageId", "customerNo", "merchantName", "orderWiseMerchant", "followUpPerson",
  "customerPoNo", "quality", "design", "size", "productionOrderStatus", "priority",
  "aging", "onHold", "quickShip", "delayStatus", "ctype", "dueFrom", "dueTo",
]);

/** Every URL param this panel does NOT itself model (sortBy, sortDir, pageSize, ...),
 * as a plain multi-value record — passed through untouched by apply() below. */
function otherParamsFrom(searchParams: URLSearchParams): Record<string, string[]> {
  const record: Record<string, string[]> = {};
  for (const [key, value] of searchParams.entries()) {
    if (OWN_KEYS.has(key) || key === "page") continue;
    (record[key] ??= []).push(value);
  }
  return record;
}

export function OrdersFilterPanel({ stages, facets, values, hasAnyFilter }: OrdersFilterPanelProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filtersVisible, setFiltersVisible] = useLocalPreference("atlas:orders:filtersVisible", true);
  const [searchInput, setSearchInput] = useState(values.q);

  // Tracks the full intended filter state locally rather than reconstructing "every
  // other current filter" from useSearchParams() inside apply(). Needed because this
  // page runs a real Supabase query server-side on every filter change, so a
  // router.push() navigation takes real time to land — useSearchParams() only reflects
  // the new URL once that round trip actually completes. The old version read
  // searchParams.entries() fresh on every apply() call; firing a second filter change
  // before the first one's navigation had landed read a stale snapshot missing that
  // first change, and silently dropped it from the merged URL. Confirmed live on
  // RugLens, 2026-09-11 (same apply() pattern as this file) — applying one filter right
  // after another deselected the first.
  //
  // `current` only tracks the fields THIS panel controls (mirrors `values`' shape) —
  // updated synchronously on every apply(), so the next apply() (even one fired before
  // the previous navigation resolves) always merges against the true latest intent, not
  // a lagging snapshot. Re-synced from `values` (the server's authoritative state)
  // whenever it changes. `otherParams` below separately carries anything this panel
  // doesn't model (sortBy/sortDir/pageSize) through untouched.
  const [current, setCurrent] = useState(values);
  useEffect(() => {
    setCurrent(values);
  }, [values]);

  const [otherParams, setOtherParams] = useState(() => otherParamsFrom(searchParams));
  useEffect(() => {
    setOtherParams(otherParamsFrom(searchParams));
    // Keyed on the stable string form, not the ReadonlyURLSearchParams object identity
    // (which can change reference across renders with no actual content change).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString()]);

  function apply(overrides: Partial<typeof values>) {
    const next = { ...current, ...overrides };
    setCurrent(next);
    const p = new URLSearchParams();
    for (const [key, list] of Object.entries(otherParams)) {
      for (const v of list) p.append(key, v);
    }
    for (const [key, value] of Object.entries(next)) {
      if (value === undefined) continue;
      for (const v of Array.isArray(value) ? value : [value]) {
        if (v) p.append(key, v);
      }
    }
    router.push(`/orders?${p.toString()}`);
  }

  function applySearch() {
    if (searchInput === current.q) return;
    apply({ q: searchInput || undefined });
  }

  return (
    <div className="flex shrink-0 flex-col gap-2">
      <button
        type="button"
        onClick={() => setFiltersVisible((v) => !v)}
        className="self-start text-xs text-muted hover:text-foreground hover:underline"
      >
        {filtersVisible ? "Hide filters" : "Show filters"}
      </button>

      {filtersVisible ? (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border-2 border-border p-3">
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium uppercase text-muted">Search</span>
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onBlur={applySearch}
              onKeyDown={(e) => e.key === "Enter" && applySearch()}
              placeholder="OTN, item, customer, quality…"
              className="w-48 rounded-lg border-2 border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:border-accent"
            />
          </label>

          <FacetDropdown
            label="Stage"
            options={stages.map((s) => ({ value: s.id, label: s.display_name }))}
            selected={current.stageId}
            onApply={(v) => apply({ stageId: v })}
          />
          <FacetDropdown label="Customer No." options={facets.customerNo.map((v) => ({ value: v, label: v }))} selected={current.customerNo} onApply={(v) => apply({ customerNo: v })} />
          <FacetDropdown label="Merchant" options={facets.merchantName.map((v) => ({ value: v, label: v }))} selected={current.merchantName} onApply={(v) => apply({ merchantName: v })} />
          <FacetDropdown label="Order-wise Merchant" options={facets.orderWiseMerchant.map((v) => ({ value: v, label: v }))} selected={current.orderWiseMerchant} onApply={(v) => apply({ orderWiseMerchant: v })} />
          <FacetDropdown label="Follow-up Person" options={facets.followUpPerson.map((v) => ({ value: v, label: v }))} selected={current.followUpPerson} onApply={(v) => apply({ followUpPerson: v })} />
          <FacetDropdown label="Customer PO No." options={facets.customerPoNo.map((v) => ({ value: v, label: v }))} selected={current.customerPoNo} onApply={(v) => apply({ customerPoNo: v })} />
          <FacetDropdown label="Quality" options={facets.quality.map((v) => ({ value: v, label: v }))} selected={current.quality} onApply={(v) => apply({ quality: v })} />
          <FacetDropdown label="Design" options={facets.design.map((v) => ({ value: v, label: v }))} selected={current.design} onApply={(v) => apply({ design: v })} />
          <FacetDropdown label="Size" options={facets.size.map((v) => ({ value: v, label: v }))} selected={current.size} onApply={(v) => apply({ size: v })} />
          <FacetDropdown label="Prod. Status" options={facets.productionOrderStatus.map((v) => ({ value: v, label: v }))} selected={current.productionOrderStatus} onApply={(v) => apply({ productionOrderStatus: v })} />
          <FacetDropdown label="Priority" options={facets.priority.map((v) => ({ value: v, label: v }))} selected={current.priority} onApply={(v) => apply({ priority: v })} />

          <SingleSelect
            label="Aging"
            selected={current.aging}
            onApply={(v) => apply({ aging: v })}
            options={[
              { value: "0-7", label: "0-7 days" },
              { value: "8-15", label: "8-15 days" },
              { value: "16-30", label: "16-30 days" },
              { value: "30+", label: "30+ days" },
            ]}
          />
          <SingleSelect label="On Hold" selected={current.onHold} onApply={(v) => apply({ onHold: v })} options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]} />
          <SingleSelect label="Quick Ship" selected={current.quickShip} onApply={(v) => apply({ quickShip: v })} options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]} />
          <SingleSelect
            label="Delay Status"
            selected={current.delayStatus}
            onApply={(v) => apply({ delayStatus: v })}
            options={[
              { value: "late", label: "⚠ Late" },
              { value: "soon", label: "⏰ Due in 7 days" },
              { value: "late_or_soon", label: "Late + due in 7 days" },
            ]}
          />
          <SingleSelect
            label="Construction"
            selected={current.ctype}
            onApply={(v) => apply({ ctype: v })}
            options={[
              { value: "knotted", label: "Knotted" },
              { value: "tufted", label: "Tufted" },
              { value: "handloom", label: "Handloom" },
              { value: "swatch", label: "Swatch/sample (<4 sqft)" },
              { value: "other", label: "Other" },
            ]}
          />

          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium uppercase text-muted whitespace-nowrap">Rev. Ex-Factory from</span>
            <input
              type="date"
              defaultValue={current.dueFrom ?? ""}
              onChange={(e) => apply({ dueFrom: e.target.value || undefined })}
              className="rounded-lg border-2 border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:border-accent"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium uppercase text-muted whitespace-nowrap">Rev. Ex-Factory to</span>
            <input
              type="date"
              defaultValue={current.dueTo ?? ""}
              onChange={(e) => apply({ dueTo: e.target.value || undefined })}
              className="rounded-lg border-2 border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:border-accent"
            />
          </label>

          {hasAnyFilter ? (
            <Link href="/orders" className="self-center text-sm text-accent hover:underline">
              Clear all
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
