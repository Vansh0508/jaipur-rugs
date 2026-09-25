"use client";

import React, { useState, useTransition, useMemo, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Button,
  ScrollShadow,
  SearchField,
  Spinner,
  Table,
  Tooltip,
} from "@heroui/react";
import {
  ChevronDown,
  ChevronRight,
  Layers3Diagonal,
  Copy,
  Check,
  Funnel,
  ChevronLeft,
  LayoutColumns3,
} from "@gravity-ui/icons";
import {
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Scale,
  AlertTriangle,
  SearchX,
} from "lucide-react";
import { OrderRow, StageRow, PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "@/lib/queries/orders";
import { AuditedBomLine } from "@/lib/audit-engine";
import { StageChip } from "@/components/orders/StageChip";
import { NestedBomTable } from "./NestedBomTable";
import { displayDate } from "@/lib/displayDate";
import { copyToClipboard } from "@/lib/clipboardCopy";
import { useLocalPreference } from "@/lib/useLocalPreference";
import type {
  RugEvaluationInput,
  BomValidityResult,
  WeightAccuracyResult,
} from "@/lib/bom-evaluator";

export type StageGroupTab = "all" | "pre_loom" | "loom" | "after_loom";

export interface ColumnDef {
  id: string;
  label: string;
  sortable?: boolean;
}

export const ALL_RUG_COLUMNS: ColumnDef[] = [
  { id: "itemNo", label: "Rug Number", sortable: true },
  { id: "matchingCode", label: "Matching Code", sortable: true },
  { id: "quality", label: "Quality", sortable: true },
  { id: "design", label: "Design", sortable: true },
  { id: "grColor", label: "GR Color Code", sortable: true },
  { id: "brColor", label: "BR Color Code", sortable: true },
  { id: "size", label: "Size", sortable: true },
  { id: "shape", label: "Shape", sortable: true },
  { id: "stage", label: "Stage" },
  { id: "salesOrderDate", label: "Order Date", sortable: true },
  { id: "bomValidity", label: "BOM Validity", sortable: true },
  { id: "weightAccuracy", label: "Weight Accuracy", sortable: true },
];

// In-memory client caches for rug evaluations across tabs and re-renders
const bomValidityMemoryCache = new Map<string, BomValidityResult>();
const weightAccuracyMemoryCache = new Map<string, WeightAccuracyResult>();

export const ALL_BOM_COLUMNS: ColumnDef[] = [
  { id: "lineNo", label: "Line No" },
  { id: "componentCode", label: "Raw Material / Item" },
  { id: "yarnCode", label: "Yarn Code" },
  { id: "plannedQty", label: "Planned Qty" },
  { id: "stdQty", label: "Std Qty" },
  { id: "stdPsf", label: "Std PSF" },
  { id: "uom", label: "UOM" },
  { id: "status", label: "Audit Status" },
];

interface GroupedOrdersBomTableProps {
  rows: OrderRow[];
  stages: StageRow[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  currentTab: StageGroupTab;
  currentSearch?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}

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

export function GroupedOrdersBomTable({
  rows,
  stages,
  totalCount,
  page,
  pageSize,
  totalPages,
  currentTab,
  currentSearch = "",
  sortBy = "salesOrderDate",
  sortDir = "desc",
}: GroupedOrdersBomTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // On-demand BOM cache & state
  const [expandedItemNos, setExpandedItemNos] = useState<Set<string>>(new Set());
  const [bomsByItem, setBomsByItem] = useState<Record<string, AuditedBomLine[]>>({});
  const [loadingItemNos, setLoadingItemNos] = useState<Set<string>>(new Set());

  // Independent lazy background evaluations state (BOM Validity & Weight Accuracy)
  const [bomValidityMap, setBomValidityMap] = useState<Record<string, BomValidityResult>>(() => {
    const initial: Record<string, BomValidityResult> = {};
    for (const [key, val] of bomValidityMemoryCache.entries()) {
      initial[key] = val;
    }
    return initial;
  });

  const [weightAccuracyMap, setWeightAccuracyMap] = useState<Record<string, WeightAccuracyResult>>(() => {
    const initial: Record<string, WeightAccuracyResult> = {};
    for (const [key, val] of weightAccuracyMemoryCache.entries()) {
      initial[key] = val;
    }
    return initial;
  });

  const inFlightValidity = useRef<Set<string>>(new Set());
  const inFlightWeight = useRef<Set<string>>(new Set());

  // Non-blocking lazy background loader in batches of 10 starting from the first list provided by the ruglist
  useEffect(() => {
    if (!rows || rows.length === 0) return;

    const abortController = new AbortController();
    const signal = abortController.signal;

    // Ordered list of items directly from the ruglist (preserving rows[0], rows[1], ...)
    const orderedItems: RugEvaluationInput[] = [];
    for (const row of rows) {
      const itemNo = row.item_no?.trim();
      if (!itemNo) continue;
      orderedItems.push({
        itemNo,
        design: row.design ?? undefined,
        quality: row.quality ?? undefined,
        grColorName: row.gr_color_name ?? undefined,
        grColorCode: (row as any).gr_color_code ?? undefined,
        brColorName: row.br_color_name ?? undefined,
        brColorCode: (row as any).br_color_code ?? undefined,
        shape: row.shape ?? undefined,
        size: row.size ?? undefined,
        matchingCode: row.matching_code ?? undefined,
      });
    }

    if (orderedItems.length === 0) return;

    // 1. Sync any already cached items immediately from memory caches
    const cachedValidityUpdates: Record<string, BomValidityResult> = {};
    const cachedWeightUpdates: Record<string, WeightAccuracyResult> = {};

    for (const item of orderedItems) {
      if (bomValidityMemoryCache.has(item.itemNo) && !bomValidityMap[item.itemNo]) {
        cachedValidityUpdates[item.itemNo] = bomValidityMemoryCache.get(item.itemNo)!;
      }
      if (weightAccuracyMemoryCache.has(item.itemNo) && !weightAccuracyMap[item.itemNo]) {
        cachedWeightUpdates[item.itemNo] = weightAccuracyMemoryCache.get(item.itemNo)!;
      }
    }

    if (Object.keys(cachedValidityUpdates).length > 0) {
      setBomValidityMap((prev) => ({ ...prev, ...cachedValidityUpdates }));
    }
    if (Object.keys(cachedWeightUpdates).length > 0) {
      setWeightAccuracyMap((prev) => ({ ...prev, ...cachedWeightUpdates }));
    }

    // Helper to partition items into batches of 10
    const chunkArray = <T,>(arr: T[], chunkSize = 10): T[][] => {
      const chunks: T[][] = [];
      for (let i = 0; i < arr.length; i += chunkSize) {
        chunks.push(arr.slice(i, i + chunkSize));
      }
      return chunks;
    };

    // 2. Independent Pipeline: BOM Validity (processed sequentially in batches of 10 from top of list)
    const validityItemsToFetch = orderedItems.filter(
      (item) => !bomValidityMemoryCache.has(item.itemNo) && !inFlightValidity.current.has(item.itemNo)
    );

    if (validityItemsToFetch.length > 0) {
      const validityBatches = chunkArray(validityItemsToFetch, 10);

      (async () => {
        for (const batch of validityBatches) {
          if (signal.aborted) break;

          for (const itm of batch) {
            inFlightValidity.current.add(itm.itemNo);
          }

          try {
            const res = await fetch("/api/bom/evaluate-rugs", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ items: batch, type: "bomValidity" }),
              signal,
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();

            if (data.success && data.evaluations) {
              for (const [k, v] of Object.entries(data.evaluations as Record<string, BomValidityResult>)) {
                bomValidityMemoryCache.set(k, v);
              }
              setBomValidityMap((prev) => ({
                ...prev,
                ...data.evaluations,
              }));
            }
          } catch (err: any) {
            if (err.name !== "AbortError") {
              console.error("Failed to lazily evaluate BOM validity batch:", err);
            }
          } finally {
            for (const itm of batch) {
              inFlightValidity.current.delete(itm.itemNo);
            }
          }
        }
      })();
    }

    // 3. Independent Pipeline: Weight Accuracy (processed sequentially in batches of 10 from top of list)
    const weightItemsToFetch = orderedItems.filter(
      (item) => !weightAccuracyMemoryCache.has(item.itemNo) && !inFlightWeight.current.has(item.itemNo)
    );

    if (weightItemsToFetch.length > 0) {
      const weightBatches = chunkArray(weightItemsToFetch, 10);

      (async () => {
        for (const batch of weightBatches) {
          if (signal.aborted) break;

          for (const itm of batch) {
            inFlightWeight.current.add(itm.itemNo);
          }

          try {
            const res = await fetch("/api/bom/evaluate-rugs", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ items: batch, type: "weightAccuracy" }),
              signal,
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();

            if (data.success && data.evaluations) {
              for (const [k, v] of Object.entries(data.evaluations as Record<string, WeightAccuracyResult>)) {
                weightAccuracyMemoryCache.set(k, v);
              }
              setWeightAccuracyMap((prev) => ({
                ...prev,
                ...data.evaluations,
              }));
            }
          } catch (err: any) {
            if (err.name !== "AbortError") {
              console.error("Failed to lazily evaluate Weight Accuracy batch:", err);
            }
          } finally {
            for (const itm of batch) {
              inFlightWeight.current.delete(itm.itemNo);
            }
          }
        }
      })();
    }

    return () => {
      abortController.abort();
    };
  }, [rows]);

  // Client-side sort for evaluations if sorted by bomValidity or weightAccuracy
  const sortedRows = useMemo(() => {
    if (sortBy === "bomValidity") {
      return [...rows].sort((a, b) => {
        const aVal = bomValidityMap[a.item_no]?.status || "Z";
        const bVal = bomValidityMap[b.item_no]?.status || "Z";
        return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      });
    }
    if (sortBy === "weightAccuracy") {
      return [...rows].sort((a, b) => {
        const aVal = weightAccuracyMap[a.item_no]?.status || "Z";
        const bVal = weightAccuracyMap[b.item_no]?.status || "Z";
        return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      });
    }
    return rows;
  }, [rows, sortBy, sortDir, bomValidityMap, weightAccuracyMap]);

  // Search input state
  const [searchInput, setSearchInput] = useState(currentSearch);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Column preferences
  const [hiddenColumns, setHiddenColumns] = useLocalPreference<string[]>("bom:rug-boms:columns", []);
  const [hiddenBomColumns, setHiddenBomColumns] = useLocalPreference<string[]>("bom:rug-boms:nestedColumns", []);
  const hidden = useMemo(() => new Set(hiddenColumns), [hiddenColumns]);
  const hiddenBom = useMemo(() => new Set(hiddenBomColumns), [hiddenBomColumns]);

  const visibleRugColumns = useMemo(
    () => ALL_RUG_COLUMNS.filter((c) => !hidden.has(c.id)),
    [hidden]
  );
  const visibleBomColumns = useMemo(
    () => ALL_BOM_COLUMNS.filter((c) => !hiddenBom.has(c.id)),
    [hiddenBom]
  );

  // Search & extended menu state
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSubmenu, setActiveSubmenu] = useState<"columns" | null>(null);
  const [columnTab, setColumnTab] = useState<"rug" | "bom">("rug");
  const menuContainerRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
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

  function toggleRugColumn(colId: string) {
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

  function toggleBomColumn(colId: string) {
    setHiddenBomColumns((prev) => {
      const s = new Set(prev);
      if (s.has(colId)) {
        s.delete(colId);
      } else {
        s.add(colId);
      }
      return Array.from(s);
    });
  }

  const stageById = useMemo(() => new Map(stages.map((s) => [s.id, s])), [stages]);

  function buildLink(overrides: Record<string, string | undefined>) {
    const p = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(overrides)) {
      if (value === undefined) {
        p.delete(key);
      } else {
        p.set(key, value);
      }
    }
    return `/rug-boms?${p.toString()}`;
  }

  function navigate(url: string) {
    startTransition(() => {
      router.push(url);
    });
  }

  // Track in-flight promises to deduplicate background prefetch and expand-clicks
  const inFlightFetches = React.useRef<Map<string, Promise<AuditedBomLine[]>>>(new Map());

  const fetchBomForItem = React.useCallback(async (itemNo: string): Promise<AuditedBomLine[]> => {
    if (!itemNo) return [];
    if (bomsByItem[itemNo]) return bomsByItem[itemNo];

    const existingPromise = inFlightFetches.current.get(itemNo);
    if (existingPromise) {
      return existingPromise;
    }

    setLoadingItemNos((prev) => new Set(prev).add(itemNo));

    const promise = (async () => {
      try {
        const res = await fetch(`/api/bom?itemNo=${encodeURIComponent(itemNo)}&limit=200`);
        if (res.ok) {
          const data = await res.json();
          const lines = (data.lines as AuditedBomLine[]) || [];
          setBomsByItem((prev) => ({
            ...prev,
            [itemNo]: lines,
          }));
          return lines;
        } else {
          setBomsByItem((prev) => ({
            ...prev,
            [itemNo]: [],
          }));
          return [];
        }
      } catch (err) {
        console.error("Failed to load on-demand BOM for item:", itemNo, err);
        setBomsByItem((prev) => ({
          ...prev,
          [itemNo]: [],
        }));
        return [];
      } finally {
        inFlightFetches.current.delete(itemNo);
        setLoadingItemNos((prev) => {
          const next = new Set(prev);
          next.delete(itemNo);
          return next;
        });
      }
    })();

    inFlightFetches.current.set(itemNo, promise);
    return promise;
  }, [bomsByItem]);

  // Optimistic prefetch on row hover or focus
  const prefetchBom = React.useCallback((itemNo: string) => {
    if (!itemNo || bomsByItem[itemNo] || inFlightFetches.current.has(itemNo)) {
      return;
    }
    fetchBomForItem(itemNo);
  }, [bomsByItem, fetchBomForItem]);

  // Instant optimistic toggle of row expansion
  function toggleRow(itemNo: string) {
    if (!itemNo) return;

    // Instantly expand or collapse row in state
    setExpandedItemNos((prev) => {
      const next = new Set(prev);
      if (next.has(itemNo)) {
        next.delete(itemNo);
      } else {
        next.add(itemNo);
      }
      return next;
    });

    // If not cached, trigger fetch (or reuse in-flight prefetch)
    if (!bomsByItem[itemNo]) {
      fetchBomForItem(itemNo);
    }
  }

  function handleSearchSubmit() {
    if (searchInput === currentSearch) return;
    navigate(buildLink({ q: searchInput || undefined, page: "1" }));
  }

  function handleTabChange(tab: StageGroupTab) {
    navigate(buildLink({ tab: tab === "pre_loom" ? undefined : tab, page: "1" }));
  }

  function handleSort(column: string) {
    const isCurrent = sortBy === column;
    const newDir = isCurrent ? (sortDir === "desc" ? "asc" : "desc") : "desc";
    navigate(buildLink({ sortBy: column, sortDir: newDir, page: "1" }));
  }

  async function handleCopy(text: string, id: string) {
    const ok = await copyToClipboard(text, text);
    if (ok) {
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500);
    }
  }

  const from = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);
  const pageNumbers = useMemo(() => getPageNumbers(page, totalPages), [page, totalPages]);

  return (
    <div className="flex h-full flex-col gap-3">
      {/* 1. Top Controls Bar: Stage Category Tabs & Search */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-0.5">
        {/* Stage Tabs (Pre Loom, On Loom, After Loom, All Stages) */}
        <div className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-surface p-1 shadow-xs text-xs">
          <button
            type="button"
            onClick={() => handleTabChange("pre_loom")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-medium transition-colors cursor-pointer ${
              currentTab === "pre_loom"
                ? "bg-amber-600 text-white shadow-xs"
                : "text-muted hover:text-foreground"
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-amber-300" />
            <span>Pre Loom</span>
          </button>
          <button
            type="button"
            onClick={() => handleTabChange("loom")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-medium transition-colors cursor-pointer ${
              currentTab === "loom"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-muted hover:text-foreground"
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-blue-400" />
            <span>On Loom</span>
          </button>
          <button
            type="button"
            onClick={() => handleTabChange("after_loom")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-medium transition-colors cursor-pointer ${
              currentTab === "after_loom"
                ? "bg-purple-600 text-white shadow-xs"
                : "text-muted hover:text-foreground"
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-purple-400" />
            <span>After Loom</span>
          </button>
          <button
            type="button"
            onClick={() => handleTabChange("all")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-medium transition-colors cursor-pointer ${
              currentTab === "all"
                ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs"
                : "text-muted hover:text-foreground"
            }`}
          >
            <span>All Stages</span>
          </button>
        </div>

        {/* Right Search & Controls Capsule */}
        <div className="relative flex items-center" ref={menuContainerRef}>
          <div className="rounded-full border border-border bg-surface text-foreground shadow-xs overflow-visible flex items-center h-8.5 px-0.5 transition-all focus-within:border-accent">
            <SearchField
              name="search"
              value={searchInput}
              onChange={setSearchInput}
              onSubmit={handleSearchSubmit}
              onClear={() => {
                setSearchInput("");
                navigate(buildLink({ q: undefined, page: "1" }));
              }}
              aria-label="Search rugs and orders"
              className="flex items-center"
            >
              <SearchField.Group className="flex items-center gap-1.5 pl-3 pr-2 py-1 h-8 text-xs bg-transparent">
                <SearchField.SearchIcon className="w-3.5 h-3.5 text-muted shrink-0" />
                <SearchField.Input
                  className="w-[180px] sm:w-[240px] bg-transparent text-xs text-foreground placeholder:text-muted outline-none"
                  placeholder="Search item, OTN, design..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSearchSubmit();
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

          {/* Extended Dropdown with Submenu on Hover */}
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
                      className="absolute right-full top-0 mr-1.5 w-72 rounded-2xl border border-border bg-surface p-2.5 shadow-2xl z-50 animate-in fade-in zoom-in-95"
                    >
                      {/* Tabs: Rug Table vs BOM Table */}
                      <div className="flex items-center gap-1 p-0.5 mb-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-[11px] font-medium">
                        <button
                          type="button"
                          onClick={() => setColumnTab("rug")}
                          className={`flex-1 py-1 px-2 rounded-md transition-all cursor-pointer ${
                            columnTab === "rug"
                              ? "bg-surface text-foreground shadow-2xs font-semibold"
                              : "text-muted hover:text-foreground"
                          }`}
                        >
                          Rug Columns ({visibleRugColumns.length}/{ALL_RUG_COLUMNS.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setColumnTab("bom")}
                          className={`flex-1 py-1 px-2 rounded-md transition-all cursor-pointer ${
                            columnTab === "bom"
                              ? "bg-surface text-foreground shadow-2xs font-semibold"
                              : "text-muted hover:text-foreground"
                          }`}
                        >
                          BOM Columns ({visibleBomColumns.length}/{ALL_BOM_COLUMNS.length})
                        </button>
                      </div>

                      {/* Header with Show all / Hide all */}
                      <div className="flex items-center justify-between pb-2 mb-1.5 border-b border-border/70 px-1">
                        <span className="font-semibold text-xs text-foreground">
                          {columnTab === "rug" ? "Rug Table Columns" : "Nested BOM Columns"}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (columnTab === "rug") setHiddenColumns([]);
                              else setHiddenBomColumns([]);
                            }}
                            className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-medium cursor-pointer"
                          >
                            Show all
                          </button>
                          <span className="text-muted text-[10px]">|</span>
                          <button
                            type="button"
                            onClick={() => {
                              if (columnTab === "rug") setHiddenColumns(ALL_RUG_COLUMNS.map((c) => c.id));
                              else setHiddenBomColumns(ALL_BOM_COLUMNS.map((c) => c.id));
                            }}
                            className="text-[11px] text-muted hover:text-foreground cursor-pointer"
                          >
                            Hide all
                          </button>
                        </div>
                      </div>

                      {/* Scrollable list of columns */}
                      <ScrollShadow
                        hideScrollBar
                        className="max-h-80 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                      >
                        <div className="flex flex-col gap-0.5 pr-0.5">
                          {(columnTab === "rug" ? ALL_RUG_COLUMNS : ALL_BOM_COLUMNS).map((col) => {
                            const isVisible = columnTab === "rug" ? !hidden.has(col.id) : !hiddenBom.has(col.id);
                            return (
                              <button
                                key={col.id}
                                type="button"
                                onClick={() => {
                                  if (columnTab === "rug") toggleRugColumn(col.id);
                                  else toggleBomColumn(col.id);
                                }}
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
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. Main Master-Detail Table Card */}
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

        {/* Table Subheader Bar */}
        <div className="flex shrink-0 items-center justify-between border-b border-border/80 bg-surface px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
              <Layers3Diagonal width={13} height={13} />
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-xs sm:text-sm font-semibold text-foreground">Rugs & Order Details</span>
              <span className="text-[11px] sm:text-xs text-muted font-normal">
                {totalCount} Orders ({rows.length} shown) • Sorted by Latest Date
              </span>
            </div>
          </div>
          <div className="text-[11px] text-muted">
            Click <span className="font-semibold text-foreground">▶</span> to expand available BOMs
          </div>
        </div>

        {/* Scrollable Master Table via Hero UI Table */}
        <div className={`flex-1 min-h-0 overflow-hidden transition-opacity duration-200 ${isPending ? "opacity-40 pointer-events-none" : ""}`}>
          <Table variant="secondary" className="h-full">
            <Table.ScrollContainer className="h-full">
              <Table.Content aria-label="Rug and BOMs Orders Table" className="h-full min-w-[900px] overflow-auto [&_.table__cell]:bg-inherit">
                <Table.Header className="sticky top-0 z-10 bg-surface-secondary text-[10px] uppercase tracking-wider text-muted border-b border-border/80 whitespace-nowrap">
                  <Table.Column id="toggle" className="py-3 px-3 w-10 text-center">
                    <span className="sr-only">Toggle</span>
                  </Table.Column>
                  {visibleRugColumns.map((col) => (
                    <Table.Column
                      key={col.id}
                      id={col.id}
                      isRowHeader={col.id === "itemNo"}
                      allowsSorting={col.sortable}
                      className="py-3 px-3 font-semibold cursor-pointer hover:text-foreground transition-colors select-none text-[10px] uppercase tracking-wider text-muted"
                    >
                      <div className="flex items-center gap-1" onClick={() => col.sortable && handleSort(col.id)}>
                        <span>{col.label}</span>
                        {sortBy === col.id && (
                          <span className="text-foreground">{sortDir === "asc" ? "▲" : "▼"}</span>
                        )}
                      </div>
                    </Table.Column>
                  ))}
                </Table.Header>
                <Table.Body>
                  {rows.length === 0 ? (
                    <Table.Row key="empty-row" id="empty-row">
                      <Table.Cell colSpan={visibleRugColumns.length + 1} className="py-12 text-center text-sm text-muted">
                        No orders match the selected stage filter or search term.
                      </Table.Cell>
                    </Table.Row>
                  ) : (
                    sortedRows.flatMap((order, idx) => {
                      const isExpanded = expandedItemNos.has(order.item_no);
                      const stage = order.stage_id ? stageById.get(order.stage_id) : undefined;
                      const itemBomLines = bomsByItem[order.item_no];
                      const isLoadingBom = loadingItemNos.has(order.item_no);
                      const isEven = idx % 2 === 0;

                      const mainRow = (
                        <Table.Row
                          key={order.id}
                          id={order.id}
                          onMouseEnter={() => prefetchBom(order.item_no)}
                          className={`group transition-colors border-b border-border/50 ${
                            isEven
                              ? "bg-white dark:bg-surface [&>td]:!bg-white dark:[&>td]:!bg-surface"
                              : "bg-neutral-100/90 dark:bg-neutral-900/60 [&>td]:!bg-neutral-100/90 dark:[&>td]:!bg-neutral-900/60"
                          } hover:bg-neutral-200/70 dark:hover:bg-neutral-800/70 hover:[&>td]:!bg-neutral-200/70 dark:hover:[&>td]:!bg-neutral-800/70 ${
                            isExpanded ? "border-b-0" : ""
                          }`}
                        >
                          {/* Expand Toggle */}
                          <Table.Cell className="py-2.5 px-3 text-center w-10">
                            <button
                              type="button"
                              onClick={() => toggleRow(order.item_no)}
                              onMouseEnter={() => prefetchBom(order.item_no)}
                              onFocus={() => prefetchBom(order.item_no)}
                              className={`inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors cursor-pointer ${
                                isExpanded
                                  ? "bg-neutral-200/80 dark:bg-neutral-800 text-foreground"
                                  : "text-muted hover:text-foreground hover:bg-neutral-200/60 dark:hover:bg-neutral-800"
                              }`}
                              aria-label={isExpanded ? "Collapse BOM details" : "Expand BOM details"}
                            >
                              {isExpanded ? (
                                <ChevronDown width={14} height={14} className="text-foreground" />
                              ) : (
                                <ChevronRight width={14} height={14} />
                              )}
                            </button>
                          </Table.Cell>

                          {/* Dynamic Rug Cells */}
                          {visibleRugColumns.map((col) => {
                            switch (col.id) {
                              case "itemNo":
                                return (
                                  <Table.Cell key="itemNo" className="py-2.5 px-3 whitespace-nowrap">
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => toggleRow(order.item_no)}
                                        onMouseEnter={() => prefetchBom(order.item_no)}
                                        onFocus={() => prefetchBom(order.item_no)}
                                        className="font-mono font-semibold text-accent hover:underline text-left cursor-pointer"
                                        title={order.item_description || undefined}
                                      >
                                        {order.item_no}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleCopy(order.item_no, `item-${order.id}`)}
                                        className="opacity-0 group-hover:opacity-100 text-muted hover:text-foreground transition-opacity"
                                        title="Copy rug number"
                                      >
                                        {copiedId === `item-${order.id}` ? (
                                          <Check width={12} height={12} className="text-emerald-500" />
                                        ) : (
                                          <Copy width={12} height={12} />
                                        )}
                                      </button>
                                    </div>
                                  </Table.Cell>
                                );
                              case "matchingCode":
                                return (
                                  <Table.Cell key="matchingCode" className="py-2.5 px-3 whitespace-nowrap font-mono text-foreground font-medium">
                                    {order.matching_code || "-"}
                                  </Table.Cell>
                                );
                              case "quality":
                                return (
                                  <Table.Cell key="quality" className="py-2.5 px-3 whitespace-nowrap text-foreground">
                                    {order.quality || "-"}
                                  </Table.Cell>
                                );
                              case "design":
                                return (
                                  <Table.Cell key="design" className="py-2.5 px-3 whitespace-nowrap font-medium text-foreground">
                                    {order.design || "-"}
                                  </Table.Cell>
                                );
                              case "grColor":
                                return (
                                  <Table.Cell key="grColor" className="py-2.5 px-3 whitespace-nowrap text-muted font-mono text-[11px]">
                                    {order.gr_color_name || "-"}
                                  </Table.Cell>
                                );
                              case "brColor":
                                return (
                                  <Table.Cell key="brColor" className="py-2.5 px-3 whitespace-nowrap text-muted font-mono text-[11px]">
                                    {order.br_color_name || "-"}
                                  </Table.Cell>
                                );
                              case "size":
                                return (
                                  <Table.Cell key="size" className="py-2.5 px-3 whitespace-nowrap font-medium text-muted">
                                    {order.size || "-"}
                                  </Table.Cell>
                                );
                              case "shape":
                                return (
                                  <Table.Cell key="shape" className="py-2.5 px-3 whitespace-nowrap text-muted">
                                    {order.shape || "-"}
                                  </Table.Cell>
                                );
                              case "stage":
                                return (
                                  <Table.Cell key="stage" className="py-2.5 px-3 whitespace-nowrap">
                                    {stage ? (
                                      <StageChip code={stage.code} label={stage.display_name} />
                                    ) : (
                                      <span className="text-muted">{order.raw_current_status || "-"}</span>
                                    )}
                                  </Table.Cell>
                                );
                              case "salesOrderDate":
                                return (
                                  <Table.Cell key="salesOrderDate" className="py-2.5 px-3 whitespace-nowrap text-muted text-[11px]">
                                    {displayDate(order.sales_order_date)}
                                  </Table.Cell>
                                );
                              case "bomValidity": {
                                const validityData = bomValidityMap[order.item_no];
                                if (!validityData) {
                                  return (
                                    <Table.Cell key="bomValidity" className="py-2.5 px-3 whitespace-nowrap">
                                      <div className="flex items-center gap-1.5 animate-pulse">
                                        <div className="h-5 w-20 rounded-full bg-neutral-200/80 dark:bg-neutral-800" />
                                      </div>
                                    </Table.Cell>
                                  );
                                }

                                const { status, details, discrepanciesCount } = validityData;
                                return (
                                  <Table.Cell key="bomValidity" className="py-2.5 px-3 whitespace-nowrap">
                                    <Tooltip delay={80}>
                                      <Tooltip.Trigger>
                                        <div
                                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold cursor-help transition-all hover:shadow-xs select-none ${
                                            status === "Passed"
                                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80"
                                              : status === "Rejected"
                                              ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800/80"
                                              : status === "Unregistered"
                                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/80"
                                              : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 border border-neutral-200/80 dark:border-neutral-700/80"
                                          }`}
                                        >
                                          {status === "Passed" && (
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                          )}
                                          {status === "Rejected" && (
                                            <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                                          )}
                                          {status === "Unregistered" && (
                                            <HelpCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                                          )}
                                          {status === "Not Found" && (
                                            <SearchX className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400 shrink-0" />
                                          )}
                                          <span>{status}</span>
                                        </div>
                                      </Tooltip.Trigger>
                                      <Tooltip.Content className="bg-neutral-900 text-white p-2.5 text-xs rounded-xl shadow-2xl z-50 max-w-sm border border-neutral-700/80">
                                        <Tooltip.Arrow className="fill-neutral-900" />
                                        <div
                                          className={`font-semibold mb-1 flex items-center gap-1.5 ${
                                            status === "Passed"
                                              ? "text-emerald-400"
                                              : status === "Rejected"
                                              ? "text-rose-400"
                                              : status === "Unregistered"
                                              ? "text-amber-400"
                                              : "text-neutral-300"
                                          }`}
                                        >
                                          {status === "Passed" && <CheckCircle2 className="w-3.5 h-3.5" />}
                                          {status === "Rejected" && <AlertCircle className="w-3.5 h-3.5" />}
                                          {status === "Unregistered" && <HelpCircle className="w-3.5 h-3.5" />}
                                          {status === "Not Found" && <SearchX className="w-3.5 h-3.5" />}
                                          <span>
                                            {status === "Passed"
                                              ? "BOM Validated & Passed"
                                              : status === "Rejected"
                                              ? `BOM Audit Discrepancies (${discrepanciesCount})`
                                              : status === "Unregistered"
                                              ? "Unregistered Design Prefix"
                                              : "No BOM Found in NAV"}
                                          </span>
                                        </div>
                                        <div className="text-neutral-300 text-[11px] whitespace-pre-line leading-relaxed">
                                          {details}
                                        </div>
                                      </Tooltip.Content>
                                    </Tooltip>
                                  </Table.Cell>
                                );
                              }
                              case "weightAccuracy": {
                                const weightData = weightAccuracyMap[order.item_no];
                                if (!weightData) {
                                  return (
                                    <Table.Cell key="weightAccuracy" className="py-2.5 px-3 whitespace-nowrap">
                                      <div className="flex items-center gap-1.5 animate-pulse">
                                        <div className="h-5 w-24 rounded-full bg-neutral-200/80 dark:bg-neutral-800" />
                                      </div>
                                    </Table.Cell>
                                  );
                                }

                                const {
                                  status,
                                  details,
                                  referenceBomNo,
                                  referenceSize,
                                  referenceShape,
                                  referenceRatePsf,
                                  currentRatePsf,
                                  variancePct,
                                } = weightData;

                                return (
                                  <Table.Cell key="weightAccuracy" className="py-2.5 px-3 whitespace-nowrap">
                                    <Tooltip delay={80}>
                                      <Tooltip.Trigger>
                                        <div
                                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold cursor-help transition-all hover:shadow-xs select-none ${
                                            status === "Matched"
                                              ? "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/80"
                                              : status === "Rejected"
                                              ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800/80"
                                              : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 border border-neutral-200/80 dark:border-neutral-700/80"
                                          }`}
                                        >
                                          {status === "Matched" && (
                                            <Scale className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                                          )}
                                          {status === "Rejected" && (
                                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                                          )}
                                          {status === "Not Found" && (
                                            <SearchX className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400 shrink-0" />
                                          )}
                                          <span>{status}</span>
                                        </div>
                                      </Tooltip.Trigger>
                                      <Tooltip.Content className="bg-neutral-900 text-white p-2.5 text-xs rounded-xl shadow-2xl z-50 max-w-sm border border-neutral-700/80">
                                        <Tooltip.Arrow className="fill-neutral-900" />
                                        <div
                                          className={`font-semibold mb-1 flex items-center gap-1.5 ${
                                            status === "Matched"
                                              ? "text-blue-400"
                                              : status === "Rejected"
                                              ? "text-rose-400"
                                              : "text-neutral-300"
                                          }`}
                                        >
                                          {status === "Matched" && <Scale className="w-3.5 h-3.5" />}
                                          {status === "Rejected" && <AlertTriangle className="w-3.5 h-3.5" />}
                                          {status === "Not Found" && <SearchX className="w-3.5 h-3.5" />}
                                          <span>
                                            {status === "Matched"
                                              ? "Weight Proportions Matched"
                                              : status === "Rejected"
                                              ? "Weight Proportion Discrepancy"
                                              : "No Historical Comparison"}
                                          </span>
                                        </div>
                                        <p className="text-neutral-300 text-[11px] leading-relaxed mb-1.5">
                                          {details}
                                        </p>
                                        {referenceBomNo && (
                                          <div className="pt-1.5 mt-1 border-t border-neutral-700/70 text-[10px] text-neutral-400 grid grid-cols-2 gap-x-2 gap-y-0.5">
                                            <span>
                                              Ref BOM: <strong className="text-white">{referenceBomNo}</strong>
                                            </span>
                                            <span>
                                              Ref Size: <strong className="text-white">{referenceSize}</strong>
                                            </span>
                                            <span>
                                              Current Rate: <strong className="text-white">{currentRatePsf} kg/sqft</strong>
                                            </span>
                                            <span>
                                              Ref Rate: <strong className="text-white">{referenceRatePsf} kg/sqft</strong>
                                            </span>
                                            {variancePct !== undefined && (
                                              <span className="col-span-2">
                                                Variance:{" "}
                                                <strong
                                                  className={
                                                    status === "Matched" ? "text-emerald-400" : "text-rose-400"
                                                  }
                                                >
                                                  {variancePct >= 0 ? "+" : ""}
                                                  {variancePct}%
                                                </strong>
                                              </span>
                                            )}
                                          </div>
                                        )}
                                      </Tooltip.Content>
                                    </Tooltip>
                                  </Table.Cell>
                                );
                              }
                              default:
                                return null;
                            }
                          })}
                        </Table.Row>
                      );

                      if (!isExpanded) {
                        return [mainRow];
                      }

                      const detailRow = (
                        <Table.Row
                          key={`detail-${order.id}`}
                          id={`detail-${order.id}`}
                          className={`${
                            isEven
                              ? "bg-white dark:bg-surface [&>td]:!bg-white dark:[&>td]:!bg-surface"
                              : "bg-neutral-100/90 dark:bg-neutral-900/60 [&>td]:!bg-neutral-100/90 dark:[&>td]:!bg-neutral-900/60"
                          } border-t-0 border-b border-border/50`}
                        >
                          <Table.Cell colSpan={visibleRugColumns.length + 1} className="py-2.5 px-4 pl-10 pb-4">
                            <NestedBomTable
                              itemNo={order.item_no}
                              lines={itemBomLines || []}
                              isLoading={isLoadingBom}
                              parentIsGrey={!isEven}
                              hiddenColumns={hiddenBom}
                            />
                          </Table.Cell>
                        </Table.Row>
                      );

                      return [mainRow, detailRow];
                    })
                  )}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        </div>

        {/* 3. Bottom Pagination Bar */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border/80 bg-surface px-4 py-2.5">
          <div className="text-xs text-muted">
            Showing <span className="font-semibold text-foreground">{from}</span> to{" "}
            <span className="font-semibold text-foreground">{to}</span> of{" "}
            <span className="font-semibold text-foreground">{totalCount}</span> Orders
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => navigate(buildLink({ page: String(page - 1) }))}
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
                    onClick={() => navigate(buildLink({ page: String(n) }))}
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
                onClick={() => navigate(buildLink({ page: String(page + 1) }))}
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
                onChange={(e) => navigate(buildLink({ pageSize: e.target.value, page: "1" }))}
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
      </div>
    </div>
  );
}
