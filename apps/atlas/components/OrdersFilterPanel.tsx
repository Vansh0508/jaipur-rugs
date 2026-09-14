"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { FacetDropdown, SingleSelect, HeroDateRangePicker, HeroSearchBar } from "@/components/FilterPrimitives";
import { useLocalPreference } from "@/lib/useLocalPreference";
import type { StageRow, OrderFacets } from "@/lib/queries/orders";

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

  const activeFilterCount =
    (values.stageId?.length || 0) +
    (values.customerNo?.length || 0) +
    (values.merchantName?.length || 0) +
    (values.orderWiseMerchant?.length || 0) +
    (values.followUpPerson?.length || 0) +
    (values.customerPoNo?.length || 0) +
    (values.quality?.length || 0) +
    (values.design?.length || 0) +
    (values.size?.length || 0) +
    (values.productionOrderStatus?.length || 0) +
    (values.priority?.length || 0) +
    (values.aging ? 1 : 0) +
    (values.onHold ? 1 : 0) +
    (values.quickShip ? 1 : 0) +
    (values.delayStatus ? 1 : 0) +
    (values.ctype ? 1 : 0) +
    (values.dueFrom || values.dueTo ? 1 : 0);

  return (
    <div className="flex shrink-0 flex-col gap-2.5">
      {/* Top toolbar directly above the table */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900 px-3.5 py-1 text-xs font-semibold shadow-xs">
            <span>Orders View</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Hero UI Search Bar */}
          <HeroSearchBar
            value={searchInput}
            onChange={setSearchInput}
            onSubmit={applySearch}
            onClear={() => {
              setSearchInput("");
              apply({ q: undefined });
            }}
          />

          {/* Hero UI Date Range Picker for Rev. Ex-Factory */}
          <HeroDateRangePicker
            startValue={values.dueFrom}
            endValue={values.dueTo}
            onChange={(start, end) => apply({ dueFrom: start, dueTo: end })}
          />

          {/* Filters Toggle Pill */}
          <button
            type="button"
            onClick={() => setFiltersVisible((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
              filtersVisible
                ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900 shadow-xs"
                : "border-border bg-surface text-muted hover:border-border-hover hover:text-foreground"
            }`}
          >
            <span>Filters</span>
            {activeFilterCount > 0 ? (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-white/25 dark:bg-black/25 px-1 text-[10px] font-bold">
                {activeFilterCount}
              </span>
            ) : null}
          </button>

          {hasAnyFilter ? (
            <Link
              href="/orders"
              className="text-xs font-medium text-accent hover:underline px-1.5 py-1"
            >
              Clear all
            </Link>
          ) : null}
        </div>
      </div>

      {/* Checkbox-style Pills in Dropdown Row */}
      {filtersVisible ? (
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
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
              { value: "late", label: "Late" },
              { value: "soon", label: "Due in 7 days" },
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
        </div>
      ) : null}
    </div>
  );
}
