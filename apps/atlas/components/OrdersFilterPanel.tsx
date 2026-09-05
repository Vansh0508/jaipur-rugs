"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import type { StageRow, OrderFacets } from "@/lib/queries/orders";

// The whole Orders filter form, portaled into SidebarNav's #page-sidebar-extra slot so
// it reads as one continuous sidebar (nav links, then filters) rather than a separate
// floating panel next to the table. Direct feedback, 2026-09-05: "keep the filters in
// the same side bar below My access."
//
// Real checkboxes, not a native <select multiple> — a checked/unchecked box is
// unambiguous; the native multi-select's highlight-on-select was "confusing if it got
// selected or not" (same feedback round). Each option list gets its own small search box
// that filters the visible rows client-side (React state, not a form field) — the same
// role the old tool's searchable combo-dropdown played for long lists like Design/Size.
// Checkboxes still carry a plain `name`/`value` so the surrounding <form method="get">
// submits exactly the way a <select multiple> would — no submit handler needed.
type Option = { value: string; label: string };

function FacetCheckboxList({ name, label, options, selected }: {
  name: string;
  label: string;
  options: Option[];
  selected: string[];
}) {
  const [query, setQuery] = useState("");
  const visible = query
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase text-muted">
        {label}
        {selected.length ? ` (${selected.length})` : ""}
      </span>
      {options.length > 6 ? (
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${label.toLowerCase()}…`}
          className="rounded-lg border-2 border-border bg-transparent px-2 py-1 text-xs outline-none focus:border-accent"
        />
      ) : null}
      <div className="flex max-h-36 flex-col gap-0.5 overflow-y-auto rounded-lg border-2 border-border p-1">
        {visible.length ? (
          visible.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-surface-secondary">
              <input type="checkbox" name={name} value={opt.value} defaultChecked={selected.includes(opt.value)} />
              <span className="truncate">{opt.label}</span>
            </label>
          ))
        ) : (
          <p className="px-1.5 py-1 text-xs text-muted">No matches</p>
        )}
      </div>
    </div>
  );
}

function SingleSelect({ name, label, options, selected }: {
  name: string;
  label: string;
  options: Option[];
  selected?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="font-medium uppercase text-muted">{label}</span>
      <select
        name={name}
        defaultValue={selected ?? ""}
        className="rounded-lg border-2 border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:border-accent"
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
    pageSize: number;
  };
  pageSizeOptions: readonly number[];
  hasAnyFilter: boolean;
}

export function OrdersFilterPanel({ stages, facets, values, pageSizeOptions, hasAnyFilter }: OrdersFilterPanelProps) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setSlot(document.getElementById("page-sidebar-extra"));
  }, []);

  const content = (
    <form method="get" className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold uppercase text-muted">Filters</h2>

      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium uppercase text-muted">Search</span>
        <input
          type="search"
          name="q"
          defaultValue={values.q}
          placeholder="OTN, item, customer, quality…"
          className="rounded-lg border-2 border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:border-accent"
        />
      </label>

      <FacetCheckboxList
        name="stageId"
        label="Stage"
        options={stages.map((s) => ({ value: s.id, label: s.display_name }))}
        selected={values.stageId}
      />
      <FacetCheckboxList name="customerNo" label="Customer No." options={facets.customerNo.map((v) => ({ value: v, label: v }))} selected={values.customerNo} />
      <FacetCheckboxList name="merchantName" label="Merchant" options={facets.merchantName.map((v) => ({ value: v, label: v }))} selected={values.merchantName} />
      <FacetCheckboxList name="orderWiseMerchant" label="Order-wise Merchant" options={facets.orderWiseMerchant.map((v) => ({ value: v, label: v }))} selected={values.orderWiseMerchant} />
      <FacetCheckboxList name="followUpPerson" label="Follow-up Person" options={facets.followUpPerson.map((v) => ({ value: v, label: v }))} selected={values.followUpPerson} />
      <FacetCheckboxList name="customerPoNo" label="Customer PO No." options={facets.customerPoNo.map((v) => ({ value: v, label: v }))} selected={values.customerPoNo} />
      <FacetCheckboxList name="quality" label="Quality" options={facets.quality.map((v) => ({ value: v, label: v }))} selected={values.quality} />
      <FacetCheckboxList name="design" label="Design" options={facets.design.map((v) => ({ value: v, label: v }))} selected={values.design} />
      <FacetCheckboxList name="size" label="Size" options={facets.size.map((v) => ({ value: v, label: v }))} selected={values.size} />
      <FacetCheckboxList name="productionOrderStatus" label="Prod. Status" options={facets.productionOrderStatus.map((v) => ({ value: v, label: v }))} selected={values.productionOrderStatus} />
      <FacetCheckboxList name="priority" label="Priority" options={facets.priority.map((v) => ({ value: v, label: v }))} selected={values.priority} />

      <SingleSelect
        name="aging"
        label="Aging"
        selected={values.aging}
        options={[
          { value: "0-7", label: "0-7 days" },
          { value: "8-15", label: "8-15 days" },
          { value: "16-30", label: "16-30 days" },
          { value: "30+", label: "30+ days" },
        ]}
      />
      <SingleSelect name="onHold" label="On Hold" selected={values.onHold} options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]} />
      <SingleSelect name="quickShip" label="Quick Ship" selected={values.quickShip} options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]} />
      <SingleSelect
        name="delayStatus"
        label="Delay Status"
        selected={values.delayStatus}
        options={[
          { value: "late", label: "⚠ Late" },
          { value: "soon", label: "⏰ Due in 7 days" },
          { value: "late_or_soon", label: "Late + due in 7 days" },
        ]}
      />
      <SingleSelect
        name="ctype"
        label="Construction"
        selected={values.ctype}
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
          defaultValue={values.dueFrom ?? ""}
          className="rounded-lg border-2 border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:border-accent"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium uppercase text-muted">Rev. Ex-Factory to</span>
        <input
          type="date"
          name="dueTo"
          defaultValue={values.dueTo ?? ""}
          className="rounded-lg border-2 border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:border-accent"
        />
      </label>

      <div className="flex flex-col gap-2 border-t-2 border-border pt-3">
        <SingleSelect
          name="pageSize"
          label="Rows per page"
          selected={String(values.pageSize)}
          options={pageSizeOptions.map((n) => ({ value: String(n), label: String(n) }))}
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
  );

  if (!slot) return null;
  return createPortal(content, slot);
}
