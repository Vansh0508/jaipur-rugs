"use client";

import { useState } from "react";
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

export function OrdersFilterPanel({ stages, facets, values, hasAnyFilter }: OrdersFilterPanelProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filtersVisible, setFiltersVisible] = useLocalPreference("atlas:orders:filtersVisible", true);
  const [searchInput, setSearchInput] = useState(values.q);

  /** Pushes `/orders?...` with the given fields changed, everything else carried
   * forward from the current URL (sort, page size, every other filter) — except `page`
   * itself, which always resets to 1 since the result set just changed. Same
   * merge-current-params-minus-overrides shape as OrdersTable.tsx's own useLinkBuilder. */
  function apply(overrides: Record<string, string | string[] | undefined>) {
    const p = new URLSearchParams();
    for (const [key, value] of searchParams.entries()) {
      if (key in overrides || key === "page") continue;
      p.append(key, value);
    }
    for (const [key, value] of Object.entries(overrides)) {
      if (value === undefined) continue;
      for (const v of Array.isArray(value) ? value : [value]) {
        if (v) p.append(key, v);
      }
    }
    router.push(`/orders?${p.toString()}`);
  }

  function applySearch() {
    if (searchInput === values.q) return;
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
            selected={values.stageId}
            onApply={(v) => apply({ stageId: v })}
          />
          <FacetDropdown label="Customer No." options={facets.customerNo.map((v) => ({ value: v, label: v }))} selected={values.customerNo} onApply={(v) => apply({ customerNo: v })} />
          <FacetDropdown label="Merchant" options={facets.merchantName.map((v) => ({ value: v, label: v }))} selected={values.merchantName} onApply={(v) => apply({ merchantName: v })} />
          <FacetDropdown label="Order-wise Merchant" options={facets.orderWiseMerchant.map((v) => ({ value: v, label: v }))} selected={values.orderWiseMerchant} onApply={(v) => apply({ orderWiseMerchant: v })} />
          <FacetDropdown label="Follow-up Person" options={facets.followUpPerson.map((v) => ({ value: v, label: v }))} selected={values.followUpPerson} onApply={(v) => apply({ followUpPerson: v })} />
          <FacetDropdown label="Customer PO No." options={facets.customerPoNo.map((v) => ({ value: v, label: v }))} selected={values.customerPoNo} onApply={(v) => apply({ customerPoNo: v })} />
          <FacetDropdown label="Quality" options={facets.quality.map((v) => ({ value: v, label: v }))} selected={values.quality} onApply={(v) => apply({ quality: v })} />
          <FacetDropdown label="Design" options={facets.design.map((v) => ({ value: v, label: v }))} selected={values.design} onApply={(v) => apply({ design: v })} />
          <FacetDropdown label="Size" options={facets.size.map((v) => ({ value: v, label: v }))} selected={values.size} onApply={(v) => apply({ size: v })} />
          <FacetDropdown label="Prod. Status" options={facets.productionOrderStatus.map((v) => ({ value: v, label: v }))} selected={values.productionOrderStatus} onApply={(v) => apply({ productionOrderStatus: v })} />
          <FacetDropdown label="Priority" options={facets.priority.map((v) => ({ value: v, label: v }))} selected={values.priority} onApply={(v) => apply({ priority: v })} />

          <SingleSelect
            label="Aging"
            selected={values.aging}
            onApply={(v) => apply({ aging: v })}
            options={[
              { value: "0-7", label: "0-7 days" },
              { value: "8-15", label: "8-15 days" },
              { value: "16-30", label: "16-30 days" },
              { value: "30+", label: "30+ days" },
            ]}
          />
          <SingleSelect label="On Hold" selected={values.onHold} onApply={(v) => apply({ onHold: v })} options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]} />
          <SingleSelect label="Quick Ship" selected={values.quickShip} onApply={(v) => apply({ quickShip: v })} options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]} />
          <SingleSelect
            label="Delay Status"
            selected={values.delayStatus}
            onApply={(v) => apply({ delayStatus: v })}
            options={[
              { value: "late", label: "⚠ Late" },
              { value: "soon", label: "⏰ Due in 7 days" },
              { value: "late_or_soon", label: "Late + due in 7 days" },
            ]}
          />
          <SingleSelect
            label="Construction"
            selected={values.ctype}
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
              defaultValue={values.dueFrom ?? ""}
              onChange={(e) => apply({ dueFrom: e.target.value || undefined })}
              className="rounded-lg border-2 border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:border-accent"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium uppercase text-muted whitespace-nowrap">Rev. Ex-Factory to</span>
            <input
              type="date"
              defaultValue={values.dueTo ?? ""}
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
