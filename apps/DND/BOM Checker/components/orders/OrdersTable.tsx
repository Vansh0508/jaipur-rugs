"use client";

import { useMemo, useState, useRef, useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { Key, Selection } from "@heroui/react";
import {
  Button,
  Checkbox,
  Label,
  ScrollShadow,
  SearchField,
  Spinner,
  Table,
} from "@heroui/react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  Funnel,
  Layers3Diagonal,
  LayoutColumns3,
  SlidersVertical,
} from "@gravity-ui/icons";
import { StageChip, OnTimeBadge } from "./StageChip";
import { SelectionActionBar } from "./SelectionActionBar";
import { FacetDropdown, SingleSelect, HeroDateRangePicker } from "./FilterPrimitives";
import { onTimeStatus } from "@/lib/tat";
import { stageStandard } from "@/lib/stageTat";
import { resolveFollowUpPerson } from "@/lib/followUpPerson";
import { displayDate } from "@/lib/displayDate";
import { copyToClipboard, buildClipboardText, buildClipboardHtml } from "@/lib/clipboardCopy";
import { exportRowsToExcel } from "@/lib/exportToExcel";
import { useLocalPreference } from "@/lib/useLocalPreference";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE, type OrderRow, type StageRow, type OrderFacets } from "@/lib/queries/orders";

function totalDaysSinceSalesOrder(salesOrderDate: string | null): number | null {
  if (!salesOrderDate || Number(salesOrderDate.slice(0, 4)) < 1900) return null;
  const startMs = new Date(`${salesOrderDate}T00:00:00Z`).getTime();
  if (Number.isNaN(startMs)) return null;
  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.max(0, Math.round((todayUtc - startMs) / (24 * 60 * 60 * 1000)));
}

function useLinkBuilder() {
  const searchParams = useSearchParams();
  return (overrides: Record<string, string | string[] | undefined>) => {
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
    return `/orders?${p.toString()}`;
  };
}

type ComputedSortKind = "tat" | "onTime";
type ComputedSort = { kind: ComputedSortKind; dir: "asc" | "desc" } | null;

function tatSortValue(order: OrderRow): number | null {
  const standard = stageStandard({
    rawCurrentStatus: order.raw_current_status,
    quality: order.quality,
    size: order.size,
    stdCubage: order.std_cubage,
    orderPriority: order.order_priority,
    onHold: order.on_hold,
    currentStatusPendingDays: order.current_status_pending_days,
  });
  if (standard.standardDays === null) return null;
  return (order.current_status_pending_days ?? 0) - standard.standardDays;
}

function onTimeSortValue(order: OrderRow, stageById: Map<string, StageRow>): number {
  const stage = order.stage_id ? stageById.get(order.stage_id) : undefined;
  const standard = stageStandard({
    rawCurrentStatus: order.raw_current_status,
    quality: order.quality,
    size: order.size,
    stdCubage: order.std_cubage,
    orderPriority: order.order_priority,
    onHold: order.on_hold,
    currentStatusPendingDays: order.current_status_pending_days,
  });
  const status = onTimeStatus(
    order.promised_delivery_date,
    order.revised_ex_factory_date,
    stage?.is_terminal ?? false,
    standard.standardDays,
  );
  return status === "delayed" ? 3 : status === "late" ? 2 : status === "unknown" ? 1 : 0;
}

const RUG_TRACKING_HEADERS = [
  "OTN No_", "Item No_", "Sales Order No_", "Customer No_", "Quality", "Design",
  "GR Color Name", "BR Color Name", "Shape", "Size", "Construction", "Serial No_",
  "Std Cubage", "Current Status", "Stage", "Days in Stage", "Original Ex Factory",
  "Sales Order Date", "Rev Ex-Factory",
];

function clipboardCells(o: OrderRow, stageById: Map<string, StageRow>): (string | number | null)[] {
  const stage = o.stage_id ? stageById.get(o.stage_id) : undefined;
  return [
    o.otn_no, o.item_no, o.sales_order_no, o.customer_no, o.quality, o.design,
    o.gr_color_name, o.br_color_name, o.shape, o.size, o.construction, o.serial_no,
    o.std_cubage, o.raw_current_status, stage?.display_name ?? "",
    o.current_status_pending_days,
    displayDate(o.original_ex_factory_date), displayDate(o.sales_order_date), displayDate(o.revised_ex_factory_date),
  ];
}

function buildClipboardRows(selected: OrderRow[], stageById: Map<string, StageRow>): string {
  return buildClipboardText(RUG_TRACKING_HEADERS, selected.map((o) => clipboardCells(o, stageById)));
}

function buildOrdersClipboardHtml(selected: OrderRow[], stageById: Map<string, StageRow>): string {
  return buildClipboardHtml(RUG_TRACKING_HEADERS, selected.map((o) => clipboardCells(o, stageById)));
}

function exportCells(o: OrderRow, stageNameById: Map<string, string>) {
  return {
    "OTN No.": o.otn_no,
    "Item No.": o.item_no,
    "Sales Order No.": o.sales_order_no,
    "Customer No.": o.customer_no,
    "Merchant Name": o.merchant_name,
    Stage: o.stage_id ? stageNameById.get(o.stage_id) ?? "" : "",
    "Current Status (ERP)": o.raw_current_status,
    "Days in Current Status": o.current_status_pending_days,
    Quality: o.quality,
    Design: o.design,
    Size: o.size,
    "Sales Order Date": o.sales_order_date,
    "Promised Delivery Date": o.promised_delivery_date,
    "Follow Up Person": o.follow_up_person,
    "Salesperson Code": o.salesperson_code,
  };
}

export interface ColumnDef {
  id: string;
  label: string;
  sortable?: boolean;
}

const ALL_COLUMNS: ColumnDef[] = [
  { id: "otn", label: "OTN / Item", sortable: true },
  { id: "merchant", label: "Merchant", sortable: true },
  { id: "customerPo", label: "Customer PO", sortable: true },
  { id: "salesPerson", label: "Sales Person", sortable: true },
  { id: "quality", label: "Quality", sortable: true },
  { id: "design", label: "Design", sortable: true },
  { id: "size", label: "Size", sortable: true },
  { id: "construction", label: "Construction", sortable: true },
  { id: "stage", label: "Stage" },
  { id: "pendingDays", label: "Days in Stage", sortable: true },
  { id: "totalDays", label: "Total Days" },
  { id: "stageStandard", label: "Stage Standard (TAT)", sortable: true },
  { id: "originalExFactory", label: "Original Ex Factory", sortable: true },
  { id: "salesOrderDate", label: "Sales Order Date", sortable: true },
  { id: "revisedExFactory", label: "Rev. Ex-Factory", sortable: true },
  { id: "revisedExIndia", label: "Rev. Ex-India", sortable: true },
  { id: "currentLocation", label: "Current Location", sortable: true },
  { id: "followUpPerson", label: "Follow Up Person" },
  { id: "onTime", label: "On Time", sortable: true },
];

export const ALL_FILTERS = [
  { id: "stageId", label: "Stage" },
  { id: "customerNo", label: "Customer No." },
  { id: "merchantName", label: "Merchant" },
  { id: "orderWiseMerchant", label: "Order-wise Merchant" },
  { id: "followUpPerson", label: "Follow-up Person" },
  { id: "customerPoNo", label: "Customer PO No." },
  { id: "quality", label: "Quality" },
  { id: "design", label: "Design" },
  { id: "size", label: "Size" },
  { id: "productionOrderStatus", label: "Prod. Status" },
  { id: "priority", label: "Priority" },
  { id: "aging", label: "Aging" },
  { id: "onHold", label: "On Hold" },
  { id: "quickShip", label: "Quick Ship" },
  { id: "delayStatus", label: "Delay Status" },
  { id: "ctype", label: "Construction" },
  { id: "dateRange", label: "Rev. Ex-Factory Date" },
] as const;

export const ROW_HEIGHT_OPTIONS = [
  { id: "compact", label: "Compact", desc: "High density (32px)" },
  { id: "normal", label: "Normal", desc: "Default spacing (44px)" },
  { id: "comfortable", label: "Comfortable", desc: "Relaxed spacing (56px)" },
] as const;

function getPageNumbers(currentPage: number, totalPages: number): number[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, -1, totalPages];
  }
  if (currentPage >= totalPages - 3) {
    return [1, -1, totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }
  return [1, -1, currentPage - 1, currentPage, currentPage + 1, -1, totalPages];
}

export interface OrdersTableProps {
  rows: OrderRow[];
  stages: StageRow[];
  facets?: OrderFacets;
  values?: {
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
  hasAnyFilter?: boolean;
  followUpPersonEmails: Record<string, string>;
  totalCount?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
}

export function OrdersTable({
  rows,
  stages,
  facets,
  values = {
    q: "",
    stageId: [],
    customerNo: [],
    merchantName: [],
    orderWiseMerchant: [],
    followUpPerson: [],
    customerPoNo: [],
    quality: [],
    design: [],
    size: [],
    productionOrderStatus: [],
    priority: [],
  },
  hasAnyFilter = false,
  followUpPersonEmails,
  totalCount = 0,
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
  totalPages = 1,
}: OrdersTableProps) {
  const stageById = useMemo(() => new Map(stages.map((s) => [s.id, s])), [stages]);
  const stageNameById = useMemo(() => new Map(stages.map((s) => [s.id, s.display_name])), [stages]);
  const buildLink = useLinkBuilder();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function navigate(url: string) {
    startTransition(() => {
      router.push(url);
    });
  }

  const searchParams = useSearchParams();
  const currentSort = searchParams.get("sortBy") ?? undefined;
  const currentDir = (searchParams.get("sortDir") as "asc" | "desc" | null) ?? "desc";

  const [selectedKeys, setSelectedKeys] = useState<Selection>(new Set<Key>());
  const [computedSort, setComputedSort] = useState<ComputedSort>(null);
  const [hiddenColumns, setHiddenColumns] = useLocalPreference<string[]>("atlas:orders:columns", []);
  const [hiddenFilters, setHiddenFilters] = useLocalPreference<string[]>("atlas:orders:hiddenFilters", []);
  const hidden = useMemo(() => new Set(hiddenColumns), [hiddenColumns]);
  const hiddenFiltersSet = useMemo(() => new Set(hiddenFilters), [hiddenFilters]);
  const visibleColumns = useMemo(() => ALL_COLUMNS.filter((c) => !hidden.has(c.id)), [hidden]);

  const [copiedEmailOrderId, setCopiedEmailOrderId] = useState<string | null>(null);
  const [copiedOtnId, setCopiedOtnId] = useState<string | null>(null);

  const [rowHeight, setRowHeight] = useLocalPreference<"compact" | "normal" | "comfortable">("atlas:orders:rowHeight", "normal");

  // Search input & extended dropdown state
  const [searchInput, setSearchInput] = useState(values.q);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSubmenu, setActiveSubmenu] = useState<"columns" | "filters" | "rowHeight" | null>(null);
  const menuContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSearchInput(values.q);
  }, [values.q]);

  // Click outside to close the search settings dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuContainerRef.current && !menuContainerRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
        setActiveSubmenu(null);
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [menuOpen]);

  function applySearch() {
    if (searchInput === values.q) return;
    navigate(buildLink({ q: searchInput || undefined }));
  }

  function toggleColumn(colId: string) {
    setHiddenColumns((prev) => {
      const s = new Set(prev);
      if (s.has(colId)) {
        s.delete(colId);
      } else {
        s.add(colId);
      }
      return Array.from(s);
    });
  }

  function toggleFilter(filterId: string) {
    setHiddenFilters((prev) => {
      const s = new Set(prev);
      if (s.has(filterId)) {
        s.delete(filterId);
      } else {
        s.add(filterId);
      }
      return Array.from(s);
    });
  }

  const sortedRows = useMemo(() => {
    if (!computedSort) return rows;
    const valueFor = (order: OrderRow) =>
      computedSort.kind === "tat" ? tatSortValue(order) : onTimeSortValue(order, stageById);
    return [...rows].sort((a, b) => {
      const av = valueFor(a);
      const bv = valueFor(b);
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      return computedSort.dir === "desc" ? bv - av : av - bv;
    });
  }, [rows, computedSort, stageById]);

  const activeSortColumn = computedSort ? (computedSort.kind === "tat" ? "stageStandard" : "onTime") : currentSort;
  const activeSortDir = computedSort ? computedSort.dir : currentDir;
  function sortDirFor(columnId: string): "ascending" | "descending" | undefined {
    if (activeSortColumn !== columnId) return undefined;
    return activeSortDir === "desc" ? "descending" : "ascending";
  }

  function handleSortChange(descriptor: { column: Key; direction: "ascending" | "descending" }) {
    const columnId = String(descriptor.column);
    const isSameColumn = activeSortColumn === columnId;
    const dir: "asc" | "desc" = isSameColumn ? (descriptor.direction === "descending" ? "desc" : "asc") : "desc";

    if (columnId === "stageStandard") {
      setComputedSort({ kind: "tat", dir });
      return;
    }
    if (columnId === "onTime") {
      setComputedSort({ kind: "onTime", dir });
      return;
    }
    setComputedSort(null);
    navigate(buildLink({ sortBy: columnId, sortDir: dir }));
  }

  const selectedCount = selectedKeys === "all" ? rows.length : selectedKeys.size;
  function selectedRows(): OrderRow[] {
    if (selectedKeys === "all") return rows;
    return rows.filter((o) => (selectedKeys as Set<Key>).has(o.id));
  }

  async function handleCopySelected(): Promise<boolean> {
    const selected = selectedRows();
    if (!selected.length) return false;
    return copyToClipboard(buildClipboardRows(selected, stageById), buildOrdersClipboardHtml(selected, stageById));
  }

  function handleExportSelected() {
    const selected = selectedRows();
    if (!selected.length) return;
    exportRowsToExcel(
      selected.map((o) => exportCells(o, stageNameById)),
      "Orders",
      `atlas-orders-selected-${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  }

  async function copyFollowUpPersonEmail(orderId: string, email: string) {
    const ok = await copyToClipboard(email, email);
    if (ok) {
      setCopiedEmailOrderId(orderId);
      setTimeout(() => setCopiedEmailOrderId((current) => (current === orderId ? null : current)), 1500);
    }
  }

  async function copyOtn(orderId: string, otn: string) {
    const ok = await copyToClipboard(otn, otn);
    if (ok) {
      setCopiedOtnId(orderId);
      setTimeout(() => setCopiedOtnId((current) => (current === orderId ? null : current)), 1500);
    }
  }

  function goToPage(newPage: number) {
    if (newPage < 1 || newPage > totalPages || newPage === page) return;
    navigate(buildLink({ page: String(newPage) }));
  }

  function changePageSize(newSize: number) {
    if (newSize === pageSize) return;
    navigate(buildLink({ pageSize: String(newSize) }));
  }

  const from = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);
  const pageNumbers = useMemo(() => getPageNumbers(page, totalPages), [page, totalPages]);

  return (
    <div className="flex h-full flex-col gap-3">
      {/* 1. Top Area: View Tabs on the left, Search Bar Button Group on the right */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-0.5">
        {/* Left Side: View Tabs + Selection */}
        <div className="flex flex-wrap items-center gap-2">
          {/* View Tabs */}
          <div className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-surface p-0.5 shadow-xs text-xs">
            <button
              type="button"
              onClick={() => navigate(buildLink({ delayStatus: undefined, onHold: undefined, quickShip: undefined }))}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-medium transition-colors cursor-pointer ${
                !values.delayStatus && !values.onHold && !values.quickShip
                  ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <span>All Orders</span>
              <span className="rounded-full bg-neutral-700/50 dark:bg-neutral-200/50 px-1.5 py-0.2 text-[10px]">
                {totalCount}
              </span>
            </button>
            <button
              type="button"
              onClick={() => navigate(buildLink({ delayStatus: values.delayStatus === "late" ? undefined : "late" }))}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-medium transition-colors cursor-pointer ${
                values.delayStatus === "late"
                  ? "bg-danger text-white shadow-xs"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <span>Delayed</span>
            </button>
            <button
              type="button"
              onClick={() => navigate(buildLink({ onHold: values.onHold === "yes" ? undefined : "yes" }))}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-medium transition-colors cursor-pointer ${
                values.onHold === "yes"
                  ? "bg-amber-600 text-white shadow-xs"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <span>On Hold</span>
            </button>
            <button
              type="button"
              onClick={() => navigate(buildLink({ quickShip: values.quickShip === "yes" ? undefined : "yes" }))}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-medium transition-colors cursor-pointer ${
                values.quickShip === "yes"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <span>Quick Ship</span>
            </button>
          </div>

          {selectedCount > 0 ? (
            <p className="text-xs text-muted pl-1">
              Selected: <span className="font-semibold text-foreground">{selectedCount}</span> order{selectedCount === 1 ? "" : "s"}
            </p>
          ) : null}
        </div>
      </div>

      {/* 2. Controls Row: Filters & Search Area side by side (just above the table) */}
      <div className="flex shrink-0 items-center justify-between gap-3 px-0.5 min-w-0">
        {/* Left: Filter list in horizontal hidden scroll (never wraps) */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <ScrollShadow
            orientation="horizontal"
            hideScrollBar
            className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden py-1 w-full"
          >
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted px-1 shrink-0">
              <Funnel width={13} height={13} className="text-muted" />
              <span>Filters:</span>
            </div>

            {facets && !hiddenFiltersSet.has("stageId") && (
              <div className="shrink-0">
                <FacetDropdown
                  label="Stage"
                  options={stages.map((s) => ({ value: s.id, label: s.display_name }))}
                  selected={values.stageId}
                  onApply={(v) => navigate(buildLink({ stageId: v }))}
                />
              </div>
            )}
            {facets && !hiddenFiltersSet.has("customerNo") && (
              <div className="shrink-0">
                <FacetDropdown
                  label="Customer No."
                  options={facets.customerNo.map((v) => ({ value: v, label: v }))}
                  selected={values.customerNo}
                  onApply={(v) => navigate(buildLink({ customerNo: v }))}
                />
              </div>
            )}
            {facets && !hiddenFiltersSet.has("merchantName") && (
              <div className="shrink-0">
                <FacetDropdown
                  label="Merchant"
                  options={facets.merchantName.map((v) => ({ value: v, label: v }))}
                  selected={values.merchantName}
                  onApply={(v) => navigate(buildLink({ merchantName: v }))}
                />
              </div>
            )}
            {facets && !hiddenFiltersSet.has("orderWiseMerchant") && (
              <div className="shrink-0">
                <FacetDropdown
                  label="Order-wise Merchant"
                  options={facets.orderWiseMerchant.map((v) => ({ value: v, label: v }))}
                  selected={values.orderWiseMerchant}
                  onApply={(v) => navigate(buildLink({ orderWiseMerchant: v }))}
                />
              </div>
            )}
            {facets && !hiddenFiltersSet.has("followUpPerson") && (
              <div className="shrink-0">
                <FacetDropdown
                  label="Follow-up Person"
                  options={facets.followUpPerson.map((v) => ({ value: v, label: v }))}
                  selected={values.followUpPerson}
                  onApply={(v) => navigate(buildLink({ followUpPerson: v }))}
                />
              </div>
            )}
            {facets && !hiddenFiltersSet.has("customerPoNo") && (
              <div className="shrink-0">
                <FacetDropdown
                  label="Customer PO No."
                  options={facets.customerPoNo.map((v) => ({ value: v, label: v }))}
                  selected={values.customerPoNo}
                  onApply={(v) => navigate(buildLink({ customerPoNo: v }))}
                />
              </div>
            )}
            {facets && !hiddenFiltersSet.has("quality") && (
              <div className="shrink-0">
                <FacetDropdown
                  label="Quality"
                  options={facets.quality.map((v) => ({ value: v, label: v }))}
                  selected={values.quality}
                  onApply={(v) => navigate(buildLink({ quality: v }))}
                />
              </div>
            )}
            {facets && !hiddenFiltersSet.has("design") && (
              <div className="shrink-0">
                <FacetDropdown
                  label="Design"
                  options={facets.design.map((v) => ({ value: v, label: v }))}
                  selected={values.design}
                  onApply={(v) => navigate(buildLink({ design: v }))}
                />
              </div>
            )}
            {facets && !hiddenFiltersSet.has("size") && (
              <div className="shrink-0">
                <FacetDropdown
                  label="Size"
                  options={facets.size.map((v) => ({ value: v, label: v }))}
                  selected={values.size}
                  onApply={(v) => navigate(buildLink({ size: v }))}
                />
              </div>
            )}
            {facets && !hiddenFiltersSet.has("productionOrderStatus") && (
              <div className="shrink-0">
                <FacetDropdown
                  label="Prod. Status"
                  options={facets.productionOrderStatus.map((v) => ({ value: v, label: v }))}
                  selected={values.productionOrderStatus}
                  onApply={(v) => navigate(buildLink({ productionOrderStatus: v }))}
                />
              </div>
            )}
            {facets && !hiddenFiltersSet.has("priority") && (
              <div className="shrink-0">
                <FacetDropdown
                  label="Priority"
                  options={facets.priority.map((v) => ({ value: v, label: v }))}
                  selected={values.priority}
                  onApply={(v) => navigate(buildLink({ priority: v }))}
                />
              </div>
            )}
            {!hiddenFiltersSet.has("aging") && (
              <div className="shrink-0">
                <SingleSelect
                  label="Aging"
                  selected={values.aging}
                  onApply={(v) => navigate(buildLink({ aging: v }))}
                  options={[
                    { value: "0-7", label: "0-7 days" },
                    { value: "8-15", label: "8-15 days" },
                    { value: "16-30", label: "16-30 days" },
                    { value: "30+", label: "30+ days" },
                  ]}
                />
              </div>
            )}
            {!hiddenFiltersSet.has("onHold") && (
              <div className="shrink-0">
                <SingleSelect
                  label="On Hold"
                  selected={values.onHold}
                  onApply={(v) => navigate(buildLink({ onHold: v }))}
                  options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]}
                />
              </div>
            )}
            {!hiddenFiltersSet.has("quickShip") && (
              <div className="shrink-0">
                <SingleSelect
                  label="Quick Ship"
                  selected={values.quickShip}
                  onApply={(v) => navigate(buildLink({ quickShip: v }))}
                  options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]}
                />
              </div>
            )}
            {!hiddenFiltersSet.has("delayStatus") && (
              <div className="shrink-0">
                <SingleSelect
                  label="Delay Status"
                  selected={values.delayStatus}
                  onApply={(v) => navigate(buildLink({ delayStatus: v }))}
                  options={[
                    { value: "late", label: "Late" },
                    { value: "soon", label: "Due in 7 days" },
                    { value: "late_or_soon", label: "Late + due in 7 days" },
                  ]}
                />
              </div>
            )}
            {!hiddenFiltersSet.has("ctype") && (
              <div className="shrink-0">
                <SingleSelect
                  label="Construction"
                  selected={values.ctype}
                  onApply={(v) => navigate(buildLink({ ctype: v }))}
                  options={[
                    { value: "knotted", label: "Knotted" },
                    { value: "tufted", label: "Tufted" },
                    { value: "handloom", label: "Handloom" },
                    { value: "swatch", label: "Swatch/sample (<4 sqft)" },
                    { value: "other", label: "Other" },
                  ]}
                />
              </div>
            )}
            {!hiddenFiltersSet.has("dateRange") && (
              <div className="shrink-0">
                <HeroDateRangePicker
                  startValue={values.dueFrom}
                  endValue={values.dueTo}
                  onChange={(start, end) => navigate(buildLink({ dueFrom: start, dueTo: end }))}
                />
              </div>
            )}
          </ScrollShadow>
        </div>

        {/* Right: Clear all & Search Area */}
        <div className="shrink-0 flex items-center gap-2.5">
          {hasAnyFilter ? (
            <button
              type="button"
              onClick={() => navigate("/orders")}
              className="text-xs font-medium text-accent hover:underline px-1.5 py-1 shrink-0 whitespace-nowrap cursor-pointer"
            >
              Clear all
            </button>
          ) : null}

          {/* Hero UI Search Bar & Dropdown Menu */}
          <div className="relative inline-flex items-center shrink-0" ref={menuContainerRef}>
            <div className="rounded-full border border-border bg-surface text-foreground shadow-xs overflow-visible flex items-center h-8.5 px-0.5 transition-all focus-within:border-accent">
              <SearchField
                name="search"
                value={searchInput}
                onChange={setSearchInput}
                onSubmit={applySearch}
                onClear={() => {
                  setSearchInput("");
                  navigate(buildLink({ q: undefined }));
                }}
                aria-label="Search orders"
                className="flex items-center"
              >
                <Label className="sr-only">Search</Label>
                <SearchField.Group className="flex items-center gap-1.5 pl-3 pr-1 py-1 h-8 text-xs bg-transparent">
                  <SearchField.SearchIcon className="w-3.5 h-3.5 text-muted shrink-0" />
                  <SearchField.Input
                    className="w-[150px] sm:w-[200px] bg-transparent text-xs text-foreground placeholder:text-muted outline-none"
                    placeholder="Search..."
                    onKeyDown={(e) => {
                      if (e.key === "Enter") applySearch();
                    }}
                  />
                  <SearchField.ClearButton className="text-muted hover:text-foreground text-xs" />
                </SearchField.Group>
              </SearchField>

              <div className="h-4 w-px bg-border/80 my-auto shrink-0" />

              <Button
                isIconOnly
                aria-label="More options"
                onClick={() => {
                  setMenuOpen((prev) => !prev);
                  if (menuOpen) setActiveSubmenu(null);
                }}
                className={`flex items-center justify-center h-8 w-8 text-muted hover:text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-r-full transition-colors cursor-pointer bg-transparent border-none ${
                  menuOpen ? "bg-neutral-100 dark:bg-neutral-800 text-foreground" : ""
                }`}
              >
                <ChevronDown
                  width={13}
                  height={13}
                  className={`transition-transform duration-200 ${menuOpen ? "rotate-180" : ""}`}
                />
              </Button>
            </div>

            {/* Extended Dropdown with Submenus on Hover */}
            {menuOpen && (
              <div className="absolute right-0 top-full mt-2 z-50 flex items-start">
                {/* Main Dropdown Menu with options */}
                <div className="w-52 rounded-2xl border border-border bg-surface p-1.5 shadow-2xl">
                  {/* Hide Columns Item with Hover Submenu */}
                  <div
                    className="relative"
                    onMouseEnter={() => setActiveSubmenu("columns")}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveSubmenu((curr) => (curr === "columns" ? null : "columns"))}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${
                        activeSubmenu === "columns"
                          ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                          : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <LayoutColumns3 width={14} height={14} className="text-muted" />
                        <span>Hide Columns</span>
                      </span>
                      <ChevronRight width={13} height={13} className="text-muted" />
                    </button>

                    {/* Dedicated Columns Submenu Popover on hover with ScrollShadow and hidden scrollbar */}
                    {activeSubmenu === "columns" && (
                      <div
                        onMouseEnter={() => setActiveSubmenu("columns")}
                        className="absolute right-full top-0 mr-1.5 w-64 rounded-2xl border border-border bg-surface p-2.5 shadow-2xl z-50 animate-in fade-in zoom-in-95"
                      >
                        <div className="flex items-center justify-between pb-2 mb-1.5 border-b border-border/70 px-1">
                          <span className="font-semibold text-xs text-foreground">Columns</span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setHiddenColumns([])}
                              className="text-[11px] text-accent hover:underline font-medium cursor-pointer"
                            >
                              Show all
                            </button>
                            <span className="text-muted text-[10px]">|</span>
                            <button
                              type="button"
                              onClick={() => setHiddenColumns(ALL_COLUMNS.map((c) => c.id))}
                              className="text-[11px] text-muted hover:text-foreground cursor-pointer"
                            >
                              Hide all
                            </button>
                          </div>
                        </div>
                        <ScrollShadow
                          hideScrollBar
                          className="max-h-80 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                        >
                          <div className="flex flex-col gap-0.5 pr-0.5">
                            {ALL_COLUMNS.map((col) => {
                              const isVisible = !hidden.has(col.id);
                              return (
                                <button
                                  key={col.id}
                                  type="button"
                                  onClick={() => toggleColumn(col.id)}
                                  className="flex w-full items-center gap-3 rounded-xl px-2.5 py-1.5 text-xs text-left hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                                >
                                  {isVisible ? (
                                    <span className="flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-[#0066FF] text-white shadow-xs">
                                      <svg className="w-2.5 h-2.5 stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                      </svg>
                                    </span>
                                  ) : (
                                    <span className="h-4.5 w-4.5 shrink-0 rounded-full border-2 border-neutral-300 dark:border-neutral-600 transition-colors" />
                                  )}
                                  <span className="truncate font-medium text-foreground">{col.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </ScrollShadow>
                      </div>
                    )}
                  </div>

                  {/* Hide Filters Item with Hover Submenu */}
                  <div
                    className="relative"
                    onMouseEnter={() => setActiveSubmenu("filters")}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveSubmenu((curr) => (curr === "filters" ? null : "filters"))}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${
                        activeSubmenu === "filters"
                          ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                          : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <Funnel width={14} height={14} className="text-muted" />
                        <span>Hide Filters</span>
                      </span>
                      <ChevronRight width={13} height={13} className="text-muted" />
                    </button>

                    {/* Dedicated Filters Submenu Popover on hover with ScrollShadow and hidden scrollbar */}
                    {activeSubmenu === "filters" && (
                      <div
                        onMouseEnter={() => setActiveSubmenu("filters")}
                        className="absolute right-full top-0 mr-1.5 w-64 rounded-2xl border border-border bg-surface p-2.5 shadow-2xl z-50 animate-in fade-in zoom-in-95"
                      >
                        <div className="flex items-center justify-between pb-2 mb-1.5 border-b border-border/70 px-1">
                          <span className="font-semibold text-xs text-foreground">Filters</span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setHiddenFilters([])}
                              className="text-[11px] text-accent hover:underline font-medium cursor-pointer"
                            >
                              Show all
                            </button>
                            <span className="text-muted text-[10px]">|</span>
                            <button
                              type="button"
                              onClick={() => setHiddenFilters(ALL_FILTERS.map((f) => f.id))}
                              className="text-[11px] text-muted hover:text-foreground cursor-pointer"
                            >
                              Hide all
                            </button>
                          </div>
                        </div>
                        <ScrollShadow
                          hideScrollBar
                          className="max-h-80 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                        >
                          <div className="flex flex-col gap-0.5 pr-0.5">
                            {ALL_FILTERS.map((filter) => {
                              const isVisible = !hiddenFiltersSet.has(filter.id);
                              return (
                                <button
                                  key={filter.id}
                                  type="button"
                                  onClick={() => toggleFilter(filter.id)}
                                  className="flex w-full items-center gap-3 rounded-xl px-2.5 py-1.5 text-xs text-left hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                                >
                                  {isVisible ? (
                                    <span className="flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-[#0066FF] text-white shadow-xs">
                                      <svg className="w-2.5 h-2.5 stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                      </svg>
                                    </span>
                                  ) : (
                                    <span className="h-4.5 w-4.5 shrink-0 rounded-full border-2 border-neutral-300 dark:border-neutral-600 transition-colors" />
                                  )}
                                  <span className="truncate font-medium text-foreground">{filter.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </ScrollShadow>
                      </div>
                    )}
                  </div>

                  {/* Row Height Item with Hover Submenu */}
                  <div
                    className="relative"
                    onMouseEnter={() => setActiveSubmenu("rowHeight")}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveSubmenu((curr) => (curr === "rowHeight" ? null : "rowHeight"))}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${
                        activeSubmenu === "rowHeight"
                          ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                          : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <SlidersVertical width={14} height={14} className="text-muted" />
                        <span>Row Height</span>
                      </span>
                      <ChevronRight width={13} height={13} className="text-muted" />
                    </button>

                    {/* Dedicated Row Height Submenu Popover on hover */}
                    {activeSubmenu === "rowHeight" && (
                      <div
                        onMouseEnter={() => setActiveSubmenu("rowHeight")}
                        className="absolute right-full top-0 mr-1.5 w-52 rounded-2xl border border-border bg-surface p-2 shadow-2xl z-50 animate-in fade-in zoom-in-95"
                      >
                        <div className="pb-1.5 mb-1 border-b border-border/70 px-1">
                          <span className="font-semibold text-xs text-foreground">Row Height</span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          {ROW_HEIGHT_OPTIONS.map((item) => {
                            const isSelected = rowHeight === item.id;
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => {
                                  setRowHeight(item.id);
                                  setMenuOpen(false);
                                  setActiveSubmenu(null);
                                }}
                                className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-xs text-left transition-colors cursor-pointer ${
                                  isSelected
                                    ? "bg-neutral-100 dark:bg-neutral-800 text-foreground font-semibold"
                                    : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/60"
                                }`}
                              >
                                <div>
                                  <div className="font-medium text-foreground">{item.label}</div>
                                  <div className="text-[10px] text-muted">{item.desc}</div>
                                </div>
                                {isSelected ? (
                                  <span className="flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-[#0066FF] text-white shadow-xs">
                                    <svg className="w-2.5 h-2.5 stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                    </svg>
                                  </span>
                                ) : (
                                  <span className="h-4.5 w-4.5 shrink-0 rounded-full border-2 border-neutral-300 dark:border-neutral-600 transition-colors" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Table Card (Enclosed inside rounded-2xl card matching reference screenshot) */}
      <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/80 bg-surface shadow-2xs">
        {/* Subtle loading indicator bar when transition is pending */}
        {isPending && (
          <div className="absolute top-0 left-0 right-0 z-30 h-0.5 bg-blue-600 animate-pulse" />
        )}

        {/* Floating loading badge */}
        {isPending && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 flex items-center gap-2 rounded-full border border-border/80 bg-surface/90 px-4 py-2 shadow-lg backdrop-blur-md">
            <Spinner size="sm" color="current" className="text-blue-600" />
            <span className="text-xs font-medium text-foreground">Updating orders…</span>
          </div>
        )}

        {/* Table Subheader Bar matching BOM batches header in reference screenshot */}
        <div className="flex shrink-0 items-center justify-between border-b border-border/80 bg-surface px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
              <Layers3Diagonal width={13} height={13} />
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-xs sm:text-sm font-semibold text-foreground">Production Orders</span>
              <span className="text-[11px] sm:text-xs text-muted font-normal">
                {totalCount} Orders ({rows.length} in view)
              </span>
            </div>
          </div>
        </div>

        <Table className="flex h-full min-h-0 flex-1 flex-col">
          <Table.ScrollContainer className={`h-full flex-1 overflow-auto transition-opacity duration-200 ${isPending ? "opacity-40 pointer-events-none" : ""}`}>
            <Table.Content
              aria-label="Orders table with selection"
              className="min-w-max w-full"
              selectionMode="multiple"
              selectionBehavior="toggle"
              selectedKeys={selectedKeys}
              onSelectionChange={setSelectedKeys}
              sortDescriptor={activeSortColumn ? { column: activeSortColumn, direction: activeSortDir === "desc" ? "descending" : "ascending" } : undefined}
              onSortChange={handleSortChange}
            >
              <Table.Header className="sticky top-0 z-10 bg-surface-secondary text-xs uppercase tracking-wider text-muted border-b border-border/80 whitespace-nowrap">
                <Table.Column className="pe-0 w-14 text-center whitespace-nowrap py-3.5" id="selection">
                  <Checkbox aria-label="Select all" slot="selection">
                    <Checkbox.Content>
                      <Checkbox.Control>
                        <Checkbox.Indicator />
                      </Checkbox.Control>
                    </Checkbox.Content>
                  </Checkbox>
                </Table.Column>
                {visibleColumns.map((col, i) => (
                  <Table.Column
                    key={col.id}
                    id={col.id}
                    isRowHeader={i === 0}
                    allowsSorting={col.sortable}
                    className={`py-3.5 px-5 text-xs font-semibold text-muted uppercase tracking-wider whitespace-nowrap ${
                      col.sortable ? "cursor-pointer hover:text-foreground transition-colors select-none" : ""
                    }`}
                  >
                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                      <span>{col.label}</span>
                      {col.sortable && sortDirFor(col.id) ? (
                        <span className="text-foreground">
                          {sortDirFor(col.id) === "ascending" ? (
                            <ChevronUp width={14} height={14} />
                          ) : (
                            <ChevronDown width={14} height={14} />
                          )}
                        </span>
                      ) : null}
                    </div>
                  </Table.Column>
                ))}
              </Table.Header>
              <Table.Body>
                {sortedRows.length === 0 ? (
                  <Table.Row key="empty-row" id="empty-row">
                    <Table.Cell className="py-12 text-center text-sm text-muted" colSpan={visibleColumns.length + 1}>
                      No orders match these filters.
                    </Table.Cell>
                  </Table.Row>
                ) : (
                  sortedRows.map((order) => {
                    const stage = order.stage_id ? stageById.get(order.stage_id) : undefined;
                    const standard = stageStandard({
                      rawCurrentStatus: order.raw_current_status,
                      quality: order.quality,
                      size: order.size,
                      stdCubage: order.std_cubage,
                      orderPriority: order.order_priority,
                      onHold: order.on_hold,
                      currentStatusPendingDays: order.current_status_pending_days,
                    });
                    const status = onTimeStatus(
                      order.promised_delivery_date,
                      order.revised_ex_factory_date,
                      stage?.is_terminal ?? false,
                      standard.standardDays,
                    );

                    const cellsById: Record<string, React.ReactNode> = {
                      otn: (
                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                          <div>
                            <div className="flex items-center gap-1">
                              <Link href={`/orders/${order.id}`} className="font-semibold text-accent hover:underline">
                                {order.otn_no}
                              </Link>
                              <button
                                type="button"
                                title={copiedOtnId === order.id ? "Copied!" : "Copy OTN"}
                                onClick={() => copyOtn(order.id, order.otn_no)}
                                className="text-muted hover:text-foreground transition-colors p-0.5"
                              >
                                <Copy width={12} height={12} />
                              </button>
                              {copiedOtnId === order.id ? (
                                <span className="text-[10px] text-accent font-medium">Copied!</span>
                              ) : null}
                            </div>
                            <div className="text-[11px] text-muted">{order.item_no}</div>
                          </div>
                        </div>
                      ),
                      merchant: (
                        <div className="whitespace-nowrap">
                          <div className="font-medium text-foreground">{order.merchant_name ?? "—"}</div>
                          <div className="text-[11px] text-muted">{order.customer_no ?? "—"}</div>
                        </div>
                      ),
                      customerPo: order.customer_po_no ?? "—",
                      salesPerson: order.order_wise_merchant ?? "—",
                      quality: order.quality ?? "—",
                      design: order.design ?? "—",
                      size: order.size ?? "—",
                      construction: order.construction ?? "—",
                      stage: <StageChip code={stage?.code ?? null} label={stage?.display_name ?? "Unresolved"} />,
                      pendingDays: order.current_status_pending_days ?? "—",
                      totalDays: totalDaysSinceSalesOrder(order.sales_order_date) ?? "—",
                      stageStandard:
                        standard.status === "on_hold" || standard.status === "no_standard" ? (
                          <span className="text-muted">—</span>
                        ) : (
                          <span className={standard.status === "breached" ? "font-semibold text-danger" : "text-foreground font-medium"}>
                            {standard.standardDays}d
                          </span>
                        ),
                      originalExFactory: displayDate(order.original_ex_factory_date),
                      salesOrderDate: displayDate(order.sales_order_date),
                      revisedExFactory: displayDate(order.revised_ex_factory_date),
                      revisedExIndia: displayDate(order.revised_ex_india_date),
                      currentLocation: order.current_location ?? "—",
                      followUpPerson: (() => {
                        const person = resolveFollowUpPerson({
                          rawCurrentStatus: order.raw_current_status,
                          quality: order.quality,
                          customerServiceZone: order.customer_service_zone,
                          orderPriority: order.order_priority,
                          customerNo: order.customer_no,
                        });
                        if (!person) return <span className="text-muted">—</span>;
                        const email = followUpPersonEmails[person];
                        if (!email) {
                          return (
                            <span title="No email on file for this name" className="text-muted">
                              {person}
                            </span>
                          );
                        }
                        const justCopied = copiedEmailOrderId === order.id;
                        return (
                          <button
                            type="button"
                            title={justCopied ? "Copied!" : `${email} — click to copy`}
                            onClick={() => copyFollowUpPersonEmail(order.id, email)}
                            className="text-left hover:underline"
                          >
                            {justCopied ? "Copied!" : person}
                          </button>
                        );
                      })(),
                      onTime: <OnTimeBadge status={status} />,
                    };

                    const cellPaddingClass =
                      rowHeight === "compact"
                        ? "py-2 px-5 text-[11px]"
                        : rowHeight === "comfortable"
                        ? "py-5 px-5 text-xs"
                        : "py-3.5 px-5 text-xs";
                    const checkboxPaddingClass =
                      rowHeight === "compact" ? "py-2" : rowHeight === "comfortable" ? "py-5" : "py-3.5";

                    return (
                      <Table.Row key={order.id} id={order.id} className="border-b border-border/40 hover:bg-neutral-50/60 dark:hover:bg-neutral-800/40 transition-colors whitespace-nowrap">
                        <Table.Cell className={`pe-0 w-14 text-center whitespace-nowrap ${checkboxPaddingClass}`}>
                          <Checkbox
                            aria-label={`Select order ${order.otn_no}`}
                            slot="selection"
                            variant="secondary"
                          >
                            <Checkbox.Content>
                              <Checkbox.Control>
                                <Checkbox.Indicator />
                              </Checkbox.Control>
                            </Checkbox.Content>
                          </Checkbox>
                        </Table.Cell>
                        {visibleColumns.map((col) => (
                          <Table.Cell key={col.id} className={`${cellPaddingClass} align-middle whitespace-nowrap`}>
                            {cellsById[col.id]}
                          </Table.Cell>
                        ))}
                      </Table.Row>
                    );
                  })
                )}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>

        {/* Footer with pagination and row count logic (generous padding) */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-t border-border/80 bg-surface px-6 py-3.5 text-xs text-muted">
          <div>
            Showing <span className="font-semibold text-foreground">{from}</span> to{" "}
            <span className="font-semibold text-foreground">{to}</span> of{" "}
            <span className="font-semibold text-foreground">{totalCount}</span> Orders
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-muted hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft width={14} height={14} />
                <span>Prev</span>
              </button>

              {pageNumbers.map((n, idx) => {
                if (n === -1) {
                  return (
                    <span key={`ellipsis-${idx}`} className="px-1 text-muted select-none">
                      …
                    </span>
                  );
                }
                const isActive = n === page;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => goToPage(n)}
                    className={`w-7 h-7 rounded flex items-center justify-center text-xs transition-colors ${
                      isActive
                        ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-bold shadow-xs"
                        : "text-neutral-600 dark:text-neutral-400 hover:text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 font-medium"
                    }`}
                  >
                    {n}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => goToPage(page + 1)}
                disabled={page >= totalPages}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-muted hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <span>Next</span>
                <ChevronRight width={14} height={14} />
              </button>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-muted">
              <span>Rows:</span>
              <select
                value={pageSize}
                onChange={(e) => changePageSize(Number(e.target.value))}
                className="bg-surface border border-border rounded px-2 py-1 text-xs font-medium text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-accent"
              >
                {PAGE_SIZE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <SelectionActionBar
          count={selectedCount}
          onCopy={handleCopySelected}
          onExport={handleExportSelected}
          onClear={() => setSelectedKeys(new Set())}
        />
      </div>
    </div>
  );
}
