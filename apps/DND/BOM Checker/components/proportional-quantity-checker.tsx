"use client";

import React, { useState, useEffect, useMemo } from "react";
import { AuditedBomLine } from "@/lib/audit-engine";
import {
  computeQuantityChecker,
  QuantityCheckerResult,
  ProportionalSizeColumn,
  ProportionalComparisonRow,
  parseRugAreaSqFt,
} from "@/lib/quantity-checker";
import { Card, Chip, Button, Typography, Tooltip } from "@heroui/react";
import { useBomStore } from "@/lib/store/bom-store";
import {
  Scale,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  Info,
  Layers,
  Sparkles,
  ArrowUpDown,
  ChevronsUpDown,
  ChevronUp,
  ChevronDown,
  RefreshCw,
  Table as TableIcon,
  Grid as GridIcon,
  Zap,
  Database,
} from "lucide-react";

interface ProportionalQuantityCheckerProps {
  line: AuditedBomLine;
  allLines?: AuditedBomLine[];
}

type SortField =
  | "design"
  | "grColorName"
  | "brColorName"
  | "colorCode"
  | "size"
  | "quantity"
  | "compareSize"
  | "status";

export const ProportionalQuantityChecker: React.FC<ProportionalQuantityCheckerProps> = ({
  line,
  allLines = [],
}) => {
  const { getQuantityChecker, setQuantityChecker } = useBomStore();
  const [dbResult, setDbResult] = useState<QuantityCheckerResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isFromCache, setIsFromCache] = useState<boolean>(false);
  const [refreshNonce, setRefreshNonce] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [componentMode, setComponentMode] = useState<"COMPONENT" | "TOTAL">("COMPONENT");
  const [viewMode, setViewMode] = useState<"TABLE" | "TRANSPOSED">("TABLE");

  // Sorting state for the 8-column table
  const [sortField, setSortField] = useState<SortField>("size");
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  // In-memory fallback calculation
  const memoryResult = useMemo(() => {
    return computeQuantityChecker(
      {
        bomNo: line.bomNo,
        itemNo: line.itemNo,
        design: line.design || line.designPrefix,
        quality: line.quality,
        grColorCode: line.grColorCode,
        grColorName: line.grColorName,
        brColorCode: line.brColorCode,
        brColorName: line.brColorName,
        size: line.size,
        areaSqFt: line.areaSqFt,
        componentCode: componentMode === "COMPONENT" ? line.componentCode : undefined,
        componentDescription: line.componentDescription,
        plannedQty: line.plannedQty,
        rawRow: line.rawRow,
      },
      allLines.map((l) => ({
        bomNo: l.bomNo,
        itemNo: l.itemNo,
        design: l.design || l.designPrefix,
        quality: l.quality,
        grColorCode: l.grColorCode,
        grColorName: l.grColorName,
        brColorCode: l.brColorCode,
        brColorName: l.brColorName,
        size: l.size,
        areaSqFt: l.areaSqFt,
        componentCode: componentMode === "COMPONENT" ? l.componentCode : undefined,
        componentDescription: l.componentDescription,
        plannedQty: l.plannedQty,
        standardPsf: l.standardPsf,
        rawRow: l.rawRow,
      }))
    );
  }, [line, allLines, componentMode]);

  // Fetch full MS SQL multi-size matches (with Store Cache check)
  useEffect(() => {
    let isCancelled = false;

    // Cache key for the client store
    const cacheKey = `${(line.design || line.designPrefix || "").trim().toUpperCase()}__${(line.quality || "").trim().toUpperCase()}__${(line.grColorCode || line.grColorName || "").trim().toUpperCase()}__${(line.brColorCode || line.brColorName || "").trim().toUpperCase()}__${componentMode === "COMPONENT" ? (line.componentCode || "").trim().toUpperCase() : "TOTAL"}`;

    // If not explicitly refreshing, check client store first
    if (refreshNonce === 0) {
      const cached = getQuantityChecker(cacheKey);
      if (cached) {
        setDbResult(cached);
        setIsFromCache(true);
        setIsLoading(false);
        return;
      }
    }

    async function fetchQuantityCheck() {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("design", line.design || line.designPrefix);
        if (line.quality) params.set("quality", line.quality);
        if (line.grColorCode) params.set("grColor", line.grColorCode);
        else if (line.grColorName) params.set("grColor", line.grColorName);
        if (line.brColorCode) params.set("brColor", line.brColorCode);
        else if (line.brColorName) params.set("brColor", line.brColorName);
        if (componentMode === "COMPONENT" && line.componentCode) {
          params.set("yarnCode", line.componentCode);
        }
        params.set("currentBomNo", line.bomNo);
        params.set("currentItemNo", line.itemNo);
        params.set("currentSize", line.size);
        params.set("targetAllocated", String(line.plannedQty));
        params.set("targetArea", String(line.areaSqFt || parseRugAreaSqFt(line.size)));

        // Bypass server cache if user clicked refresh
        if (refreshNonce > 0) {
          params.set("bypassCache", "true");
        }

        const res = await fetch(`/api/bom/quantity-checker?${params.toString()}`);
        if (!res.ok) {
          throw new Error(`Server returned HTTP ${res.status}`);
        }
        const data = await res.json();
        if (!isCancelled) {
          if (data.success && data.data) {
            setDbResult(data.data);
            setIsFromCache(data.isCached || false);
            // Save to client store
            setQuantityChecker(cacheKey, data.data);
          } else {
            setError(data.error || "Failed to load multi-size data");
          }
        }
      } catch (err: any) {
        if (!isCancelled) {
          console.warn("Could not fetch remote quantity checker data, using client memory:", err.message);
          setError(err.message);
        }
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    }

    fetchQuantityCheck();

    return () => {
      isCancelled = true;
    };
  }, [
    line.bomNo,
    line.componentCode,
    line.design,
    line.quality,
    line.grColorCode,
    line.brColorCode,
    line.size,
    line.plannedQty,
    line.areaSqFt,
    componentMode,
    refreshNonce,
    getQuantityChecker,
    setQuantityChecker,
  ]);

  // Prefer DB result if it contains reference columns, otherwise fallback to memory
  const result: QuantityCheckerResult = useMemo(() => {
    if (dbResult && dbResult.referenceColumns && dbResult.referenceColumns.length > 0) {
      return dbResult;
    }
    return memoryResult;
  }, [dbResult, memoryResult]);

  const targetSize = line.size || "Unknown";
  const targetArea = result.currentTarget.areaSqFt;
  const targetAllocated = result.currentTarget.allocatedWeight;
  const targetRate = result.currentTarget.consumptionRatePsf;

  const otherSizeColumns = result.referenceColumns.filter((c) => !c.isCurrentBom);
  const sameSizeMatches = otherSizeColumns.filter((c) => c.isSameSize);
  const diffSizeMatches = otherSizeColumns.filter((c) => !c.isSameSize);

  // Handle column header sort click
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // Sorted Comparison Rows for the 8-column table
  const sortedComparisonRows = useMemo(() => {
    const rows = [...(result.comparisonRows || [])];

    rows.sort((a, b) => {
      // Keep baseline at top if not sorting by a specific metric
      if (a.isCurrentBom && !b.isCurrentBom) return -1;
      if (!a.isCurrentBom && b.isCurrentBom) return 1;

      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (typeof valA === "string") valA = valA.toLowerCase();
      if (typeof valB === "string") valB = valB.toLowerCase();

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });

    return rows;
  }, [result.comparisonRows, sortField, sortAsc]);

  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) {
      return <ChevronsUpDown className="w-3 h-3 opacity-60 ml-1 inline shrink-0" />;
    }
    return sortAsc ? (
      <ChevronUp className="w-3 h-3 text-cyan-300 ml-1 inline shrink-0" />
    ) : (
      <ChevronDown className="w-3 h-3 text-cyan-300 ml-1 inline shrink-0" />
    );
  };

  return (
    <div className="space-y-4">
      {/* Section Header with View Mode Toggle */}
      <div className="flex items-start justify-between gap-4 flex-wrap pb-2 border-b border-stone-200">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded-md bg-[#8B1E1E]/10 flex items-center justify-center text-[#8B1E1E]">
              <Scale className="w-3.5 h-3.5" />
            </div>
            <Typography type="h4" className="text-sm font-bold text-stone-900">
              Multi-Size Proportional Quantity Checker
            </Typography>
            <Chip size="sm" variant="soft" color="default" className="text-[11px] font-mono">
              Matching: {line.design || line.designPrefix} &bull; {line.quality || "Any Qlty"}
            </Chip>

            {/* Store Management Cache Status Badge */}
            {isFromCache ? (
              <Chip size="sm" color="success" variant="soft" className="text-[10px] font-bold inline-flex items-center">
                <Zap className="w-2.5 h-2.5 text-emerald-600 inline mr-1" />
                Store Cached (&lt;1ms)
              </Chip>
            ) : (
              <Chip size="sm" color="default" variant="soft" className="text-[10px] font-bold inline-flex items-center">
                <Database className="w-2.5 h-2.5 text-stone-600 inline mr-1" />
                Live MS SQL
              </Chip>
            )}

            {/* Refresh / Bypass Cache Button */}
            <Tooltip delay={100}>
              <Tooltip.Trigger>
                <Button
                  isIconOnly
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 text-stone-400 hover:text-stone-800 cursor-pointer p-0"
                  aria-label="Refresh directly from MS SQL"
                  onClick={() => setRefreshNonce((n) => n + 1)}
                >
                  <RefreshCw className={`w-3 h-3 ${isLoading ? "animate-spin text-[#8B1E1E]" : ""}`} />
                </Button>
              </Tooltip.Trigger>
              <Tooltip.Content className="bg-stone-900 text-white p-1.5 text-[10px] rounded-md shadow-xl z-50">
                <Tooltip.Arrow className="fill-stone-900" />
                <span>Bypass cache &amp; query fresh from MS SQL</span>
              </Tooltip.Content>
            </Tooltip>
          </div>
          <Typography type="body-xs" color="muted" className="text-stone-500">
            Compares weight utilized across sizes by proportional surface area (KG / Sq. Ft.).
            Flags material deficits (&lt; expected) and excess (&gt; 2&ndash;3%).
          </Typography>
        </div>

        {/* Action Controls: Component/Total Toggle & Table/Transposed Toggle */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Table View vs Transposed View */}
          <div className="flex items-center space-x-1 bg-stone-100 p-0.5 rounded-lg border border-stone-200">
            <Button
              size="sm"
              variant={viewMode === "TABLE" ? "primary" : "ghost"}
              className={`text-[11px] h-7 px-2.5 font-semibold flex items-center space-x-1 cursor-pointer ${
                viewMode === "TABLE"
                  ? "bg-white text-stone-900 shadow-2xs"
                  : "text-stone-600 hover:text-stone-900"
              }`}
              onClick={() => setViewMode("TABLE")}
            >
              <TableIcon className="w-3 h-3" />
              <span>Comparison Table</span>
            </Button>
            <Button
              size="sm"
              variant={viewMode === "TRANSPOSED" ? "primary" : "ghost"}
              className={`text-[11px] h-7 px-2.5 font-semibold flex items-center space-x-1 cursor-pointer ${
                viewMode === "TRANSPOSED"
                  ? "bg-white text-stone-900 shadow-2xs"
                  : "text-stone-600 hover:text-stone-900"
              }`}
              onClick={() => setViewMode("TRANSPOSED")}
            >
              <GridIcon className="w-3 h-3" />
              <span>Transposed View</span>
            </Button>
          </div>

          {/* Component vs Total Toggle */}
          <div className="flex items-center space-x-1 bg-stone-100 p-0.5 rounded-lg border border-stone-200">
            <Button
              size="sm"
              variant={componentMode === "COMPONENT" ? "primary" : "ghost"}
              className={`text-[11px] h-7 px-2.5 font-semibold cursor-pointer ${
                componentMode === "COMPONENT"
                  ? "bg-white text-stone-900 shadow-2xs"
                  : "text-stone-600 hover:text-stone-900"
              }`}
              onClick={() => setComponentMode("COMPONENT")}
            >
              Yarn: {line.componentCode || "Comp"}
            </Button>
            <Button
              size="sm"
              variant={componentMode === "TOTAL" ? "primary" : "ghost"}
              className={`text-[11px] h-7 px-2.5 font-semibold cursor-pointer ${
                componentMode === "TOTAL"
                  ? "bg-white text-stone-900 shadow-2xs"
                  : "text-stone-600 hover:text-stone-900"
              }`}
              onClick={() => setComponentMode("TOTAL")}
            >
              Total Rug Weight
            </Button>
          </div>
        </div>
      </div>

      {/* Target Baseline Overview Card */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-stone-50/70 p-3 rounded-xl border border-stone-200">
        <div>
          <Typography type="body-xs" color="muted" className="text-stone-500 uppercase tracking-wider text-[10px] font-bold">
            Inspected Rug Size
          </Typography>
          <Typography type="body-sm" className="font-bold text-stone-900 mt-0.5">
            {targetSize}
          </Typography>
          <span className="text-[11px] text-stone-500 font-mono">
            {targetArea > 0 ? `${targetArea.toFixed(2)} Sq. Ft.` : "N/A"}
          </span>
        </div>

        <div>
          <Typography type="body-xs" color="muted" className="text-stone-500 uppercase tracking-wider text-[10px] font-bold">
            Allocated Weight
          </Typography>
          <Typography type="code" className="font-bold text-stone-900 font-mono text-sm mt-0.5">
            {targetAllocated.toFixed(3)} KG
          </Typography>
          <span className="text-[11px] text-stone-500 font-mono">
            Rate: {targetRate > 0 ? `${targetRate.toFixed(4)} PSF` : "N/A"}
          </span>
        </div>

        <div>
          <Typography type="body-xs" color="muted" className="text-stone-500 uppercase tracking-wider text-[10px] font-bold">
            Benchmark Expected
          </Typography>
          <Typography type="code" className="font-bold text-stone-900 font-mono text-sm mt-0.5">
            {result.benchmarkExpectedWeight > 0 ? `${result.benchmarkExpectedWeight.toFixed(3)} KG` : "—"}
          </Typography>
          <span className="text-[11px] text-stone-500 font-mono">
            Avg Rate: {result.benchmarkRatePsf > 0 ? `${result.benchmarkRatePsf.toFixed(4)} PSF` : "—"}
          </span>
        </div>

        <div>
          <Typography type="body-xs" color="muted" className="text-stone-500 uppercase tracking-wider text-[10px] font-bold">
            Overall Diagnosis
          </Typography>
          <div className="mt-1">
            <Chip
              size="sm"
              color={
                result.benchmarkVerdict === "DEFICIT"
                  ? "warning"
                  : result.benchmarkVerdict === "EXCESS"
                  ? "danger"
                  : "success"
              }
              variant="soft"
              className="font-bold text-[11px]"
            >
              {result.benchmarkVerdictText}
            </Chip>
          </div>
          <span className="text-[11px] font-mono text-stone-600 block mt-0.5">
            Δ {result.benchmarkDeltaWeight > 0 ? `+${result.benchmarkDeltaWeight.toFixed(3)}` : result.benchmarkDeltaWeight.toFixed(3)} KG ({result.benchmarkDeltaPct > 0 ? `+${result.benchmarkDeltaPct}%` : `${result.benchmarkDeltaPct}%`})
          </span>
        </div>
      </div>

      {/* Match Summary Chips */}
      <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
        <div className="flex items-center space-x-2 flex-wrap gap-1">
          <span className="text-stone-500 font-medium">Color Matching:</span>
          <Tooltip delay={100}>
            <Tooltip.Trigger>
              <span className="px-2 py-0.5 rounded bg-stone-100 border border-stone-200 font-mono text-stone-700 cursor-help">
                GR: {line.grColorCode || line.grColorName || "Any"}
              </span>
            </Tooltip.Trigger>
            <Tooltip.Content className="bg-stone-900 text-white p-2 text-xs rounded-lg shadow-xl z-50">
              <Tooltip.Arrow className="fill-stone-900" />
              <span>Ground Color: {line.grColorName || line.grColorCode || "Any"}</span>
            </Tooltip.Content>
          </Tooltip>

          <Tooltip delay={100}>
            <Tooltip.Trigger>
              <span className="px-2 py-0.5 rounded bg-stone-100 border border-stone-200 font-mono text-stone-700 cursor-help">
                BR: {line.brColorCode || line.brColorName || "Any"}
              </span>
            </Tooltip.Trigger>
            <Tooltip.Content className="bg-stone-900 text-white p-2 text-xs rounded-lg shadow-xl z-50">
              <Tooltip.Arrow className="fill-stone-900" />
              <span>Border Color: {line.brColorName || line.brColorCode || "Any"}</span>
            </Tooltip.Content>
          </Tooltip>
          {sameSizeMatches.length > 0 && (
            <Chip size="sm" color="accent" variant="soft" className="text-[10px] font-bold">
              {sameSizeMatches.length} Same-Size Match found
            </Chip>
          )}
          {diffSizeMatches.length > 0 && (
            <Chip size="sm" color="default" variant="soft" className="text-[10px] font-bold">
              {diffSizeMatches.length} Alternate Sizes found
            </Chip>
          )}
        </div>

        {isLoading && (
          <div className="flex items-center space-x-1.5 text-stone-500 text-xs">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#8B1E1E]" />
            <span>Scanning MS SQL multi-size BOMs...</span>
          </div>
        )}
      </div>

      {/* VIEW 1: THE 8-COLUMN COMPARISON TABLE (Requested Table Format) */}
      {viewMode === "TABLE" && (
        <div className="border border-stone-800 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto max-w-full">
            <table className="w-full text-xs border-collapse">
              {/* Dark header with cyan/blue typography matching the user's reference */}
              <thead>
                <tr className="bg-black text-[#38bdf8] font-bold uppercase tracking-wider text-[11px] border-b border-stone-800 select-none">
                  {/* 1. Design */}
                  <th
                    className="p-3 text-left cursor-pointer hover:bg-stone-900 transition-colors whitespace-nowrap min-w-[110px]"
                    onClick={() => handleSort("design")}
                  >
                    <span className="inline-flex items-center">
                      Design {renderSortIndicator("design")}
                    </span>
                  </th>

                  {/* 2. GR Color Name */}
                  <th
                    className="p-3 text-left cursor-pointer hover:bg-stone-900 transition-colors whitespace-nowrap min-w-[130px]"
                    onClick={() => handleSort("grColorName")}
                  >
                    <span className="inline-flex items-center">
                      GR Color Name {renderSortIndicator("grColorName")}
                    </span>
                  </th>

                  {/* 3. BR Color Name */}
                  <th
                    className="p-3 text-left cursor-pointer hover:bg-stone-900 transition-colors whitespace-nowrap min-w-[130px]"
                    onClick={() => handleSort("brColorName")}
                  >
                    <span className="inline-flex items-center">
                      BR Color Name {renderSortIndicator("brColorName")}
                    </span>
                  </th>

                  {/* 4. ColorCode */}
                  <th
                    className="p-3 text-left cursor-pointer hover:bg-stone-900 transition-colors whitespace-nowrap min-w-[110px]"
                    onClick={() => handleSort("colorCode")}
                  >
                    <span className="inline-flex items-center">
                      ColorCode {renderSortIndicator("colorCode")}
                    </span>
                  </th>

                  {/* 5. Size */}
                  <th
                    className="p-3 text-left cursor-pointer hover:bg-stone-900 transition-colors whitespace-nowrap min-w-[100px]"
                    onClick={() => handleSort("size")}
                  >
                    <span className="inline-flex items-center">
                      Size {renderSortIndicator("size")}
                    </span>
                  </th>

                  {/* 6. Quantity */}
                  <th
                    className="p-3 text-right cursor-pointer hover:bg-stone-900 transition-colors whitespace-nowrap min-w-[110px]"
                    onClick={() => handleSort("quantity")}
                  >
                    <span className="inline-flex items-center justify-end">
                      Quantity {renderSortIndicator("quantity")}
                    </span>
                  </th>

                  {/* 7. CompareSize */}
                  <th
                    className="p-3 text-left cursor-pointer hover:bg-stone-900 transition-colors whitespace-nowrap min-w-[140px]"
                    onClick={() => handleSort("compareSize")}
                  >
                    <span className="inline-flex items-center">
                      CompareSize {renderSortIndicator("compareSize")}
                    </span>
                  </th>

                  {/* 8. Status */}
                  <th
                    className="p-3 text-center cursor-pointer hover:bg-stone-900 transition-colors whitespace-nowrap min-w-[170px]"
                    onClick={() => handleSort("status")}
                  >
                    <span className="inline-flex items-center justify-center">
                      Status {renderSortIndicator("status")}
                    </span>
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-stone-200 bg-white">
                {sortedComparisonRows.length > 0 ? (
                  sortedComparisonRows.map((row) => (
                    <tr
                      key={row.id}
                      className={`hover:bg-stone-50/80 transition-colors ${
                        row.isCurrentBom
                          ? "bg-amber-50/40 font-semibold"
                          : row.isSameSize
                          ? "bg-blue-50/20"
                          : ""
                      }`}
                    >
                      {/* 1. Design */}
                      <td className="p-3 font-semibold text-stone-900 whitespace-nowrap">
                        <div className="flex items-center space-x-1.5">
                          <span>{row.design}</span>
                          {row.isCurrentBom && (
                            <Chip size="sm" color="warning" variant="soft" className="text-[9px] font-bold px-1.5 h-4">
                              Current
                            </Chip>
                          )}
                        </div>
                      </td>

                      {/* 2. GR Color Name */}
                      <td className="p-3 text-stone-700 whitespace-nowrap">
                        <Tooltip delay={100}>
                          <Tooltip.Trigger>
                            <span className="cursor-help hover:text-stone-950 font-medium">
                              {row.grColorName}
                            </span>
                          </Tooltip.Trigger>
                          <Tooltip.Content className="bg-stone-900 text-white p-2 text-xs rounded-lg shadow-xl z-50">
                            <Tooltip.Arrow className="fill-stone-900" />
                            <span>GR Color Code: {row.grColorCode || "—"}</span>
                          </Tooltip.Content>
                        </Tooltip>
                      </td>

                      {/* 3. BR Color Name */}
                      <td className="p-3 text-stone-700 whitespace-nowrap">
                        <Tooltip delay={100}>
                          <Tooltip.Trigger>
                            <span className="cursor-help hover:text-stone-950 font-medium">
                              {row.brColorName}
                            </span>
                          </Tooltip.Trigger>
                          <Tooltip.Content className="bg-stone-900 text-white p-2 text-xs rounded-lg shadow-xl z-50">
                            <Tooltip.Arrow className="fill-stone-900" />
                            <span>BR Color Code: {row.brColorCode || "—"}</span>
                          </Tooltip.Content>
                        </Tooltip>
                      </td>

                      {/* 4. ColorCode */}
                      <td className="p-3 font-mono text-[11px] text-stone-700 whitespace-nowrap">
                        <span className="px-1.5 py-0.5 rounded bg-stone-100 border border-stone-200 font-mono">
                          {row.colorCode}
                        </span>
                      </td>

                      {/* 5. Size */}
                      <td className="p-3 font-bold text-stone-900 whitespace-nowrap">
                        <div>
                          <span>{row.size}</span>
                          {row.areaSqFt > 0 && (
                            <span className="block text-[10px] text-stone-500 font-normal font-mono">
                              {row.areaSqFt.toFixed(1)} sq.ft.
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 6. Quantity */}
                      <td className="p-3 text-right font-mono text-xs whitespace-nowrap">
                        <span className="font-bold text-stone-900">
                          {row.quantity.toFixed(3)} KG
                        </span>
                        {row.consumptionRatePsf > 0 && (
                          <span className="block text-[10px] text-stone-500 font-normal">
                            {row.consumptionRatePsf.toFixed(4)} PSF
                          </span>
                        )}
                      </td>

                      {/* 7. CompareSize */}
                      <td className="p-3 text-stone-800 whitespace-nowrap">
                        <div className="space-y-0.5">
                          <span className="font-semibold text-xs text-stone-900">
                            {row.compareSize}
                          </span>
                          {!row.isCurrentBom && row.expectedQuantity > 0 && (
                            <span className="block text-[10px] text-stone-600 font-mono">
                              Expected: <strong>{row.expectedQuantity.toFixed(3)} KG</strong>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 8. Status */}
                      <td className="p-3 text-center whitespace-nowrap">
                        <div className="flex flex-col items-center space-y-0.5">
                          <Chip
                            size="sm"
                            color={row.statusColor}
                            variant="soft"
                            className="font-bold text-[10px] px-2 py-0.5 h-auto whitespace-normal leading-tight"
                          >
                            {row.statusText}
                          </Chip>

                          {!row.isCurrentBom && row.status === "MORE_MATERIAL_NEEDED" && (
                            <span className="text-[10px] text-amber-700 font-semibold font-mono">
                              Shortfall: {row.deltaWeight.toFixed(3)} KG ({row.deltaPct}%)
                            </span>
                          )}

                          {!row.isCurrentBom && row.status === "DECREASE_MATERIAL" && (
                            <span className="text-[10px] text-rose-700 font-semibold font-mono">
                              Surplus: +{row.deltaWeight.toFixed(3)} KG (+{row.deltaPct}%)
                            </span>
                          )}

                          {!row.isCurrentBom && row.status === "OPTIMAL" && (
                            <span className="text-[10px] text-emerald-700 font-medium">
                              Within &plusmn;2%
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-stone-500 text-xs">
                      No matching records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: TRANSPOSED SIZE MATRIX (Columns as Sizes) */}
      {viewMode === "TRANSPOSED" && (
        <div className="border border-stone-200 rounded-xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto max-w-full">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-stone-100/90 border-b border-stone-200 text-left">
                  {/* Sticky Metric Header Column */}
                  <th className="p-3 text-stone-700 font-bold uppercase tracking-wider text-[11px] sticky left-0 z-20 bg-stone-100 min-w-[200px] border-r border-stone-200 shadow-xs">
                    Comparison Metric
                  </th>

                  {/* Dynamic Size Columns */}
                  {result.referenceColumns.map((col) => (
                    <th
                      key={col.id}
                      className={`p-3 text-center min-w-[170px] border-r border-stone-200/80 last:border-r-0 ${
                        col.isCurrentBom
                          ? "bg-amber-50/70 text-amber-950 font-bold"
                          : col.isSameSize
                          ? "bg-blue-50/50 text-blue-950"
                          : "text-stone-800"
                      }`}
                    >
                      <div className="flex flex-col items-center space-y-0.5">
                        <span className="font-bold text-xs">{col.size}</span>
                        {col.isCurrentBom ? (
                          <Chip size="sm" color="warning" variant="primary" className="text-[9px] font-bold px-1.5 h-4">
                            Inspected Baseline
                          </Chip>
                        ) : col.isSameSize ? (
                          <Chip size="sm" color="accent" variant="soft" className="text-[9px] font-bold px-1.5 h-4">
                            Same Size Match
                          </Chip>
                        ) : (
                          <span className="text-[10px] text-stone-500 font-normal">
                            Proportional Match
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-stone-200/70 bg-white">
                {/* Row 1: Surface Area */}
                <tr className="hover:bg-stone-50/50 transition-colors">
                  <td className="p-2.5 font-semibold text-stone-700 sticky left-0 z-10 bg-white border-r border-stone-200">
                    Surface Area (Sq. Ft.)
                  </td>
                  {result.referenceColumns.map((col) => (
                    <td
                      key={col.id}
                      className={`p-2.5 text-center font-mono border-r border-stone-200/80 last:border-r-0 ${
                        col.isCurrentBom ? "bg-amber-50/30 font-bold text-stone-900" : "text-stone-800"
                      }`}
                    >
                      {col.areaSqFt > 0 ? `${col.areaSqFt.toFixed(2)} sq.ft.` : "—"}
                    </td>
                  ))}
                </tr>

                {/* Row 2: Production BOM No */}
                <tr className="hover:bg-stone-50/50 transition-colors">
                  <td className="p-2.5 font-semibold text-stone-700 sticky left-0 z-10 bg-white border-r border-stone-200">
                    Production BOM No_
                  </td>
                  {result.referenceColumns.map((col) => (
                    <td
                      key={col.id}
                      className={`p-2.5 text-center font-mono text-[11px] border-r border-stone-200/80 last:border-r-0 ${
                        col.isCurrentBom ? "bg-amber-50/30 font-bold text-[#8B1E1E]" : "text-stone-700"
                      }`}
                    >
                      {col.bomNo}
                    </td>
                  ))}
                </tr>

                {/* Row 3: Allocated Weight */}
                <tr className="hover:bg-stone-50/50 transition-colors bg-stone-50/20">
                  <td className="p-2.5 font-semibold text-stone-700 sticky left-0 z-10 bg-stone-50/40 border-r border-stone-200">
                    Allocated Weight (KG)
                  </td>
                  {result.referenceColumns.map((col) => (
                    <td
                      key={col.id}
                      className={`p-2.5 text-center font-mono text-xs border-r border-stone-200/80 last:border-r-0 ${
                        col.isCurrentBom ? "bg-amber-50/40 font-extrabold text-stone-900" : "font-bold text-stone-800"
                      }`}
                    >
                      {col.allocatedWeight.toFixed(3)} KG
                    </td>
                  ))}
                </tr>

                {/* Row 4: Material Rate (PSF) */}
                <tr className="hover:bg-stone-50/50 transition-colors">
                  <td className="p-2.5 font-semibold text-stone-700 sticky left-0 z-10 bg-white border-r border-stone-200">
                    Material Rate (Weight / Area)
                  </td>
                  {result.referenceColumns.map((col) => (
                    <td
                      key={col.id}
                      className={`p-2.5 text-center font-mono text-[11px] border-r border-stone-200/80 last:border-r-0 ${
                        col.isCurrentBom ? "bg-amber-50/30 font-bold text-stone-900" : "text-stone-700"
                      }`}
                    >
                      {col.consumptionRatePsf.toFixed(4)} PSF
                    </td>
                  ))}
                </tr>

                {/* Row 5: Expected Weight for Inspected Size */}
                <tr className="hover:bg-stone-50/50 transition-colors bg-stone-50/30">
                  <td className="p-2.5 font-semibold text-stone-800 sticky left-0 z-10 bg-stone-50/50 border-r border-stone-200">
                    <div>
                      <span>Expected Weight for {targetSize}</span>
                      <span className="block text-[10px] text-stone-500 font-normal">
                        (Ref Rate &times; {targetArea.toFixed(1)} sq.ft.)
                      </span>
                    </div>
                  </td>
                  {result.referenceColumns.map((col) => (
                    <td
                      key={col.id}
                      className={`p-2.5 text-center font-mono text-xs border-r border-stone-200/80 last:border-r-0 ${
                        col.isCurrentBom ? "bg-amber-50/40 font-bold text-stone-900" : "font-semibold text-stone-800"
                      }`}
                    >
                      {col.expectedWeightForCurrentSize > 0
                        ? `${col.expectedWeightForCurrentSize.toFixed(3)} KG`
                        : "—"}
                    </td>
                  ))}
                </tr>

                {/* Row 6: Variance Delta */}
                <tr className="hover:bg-stone-50/50 transition-colors">
                  <td className="p-2.5 font-semibold text-stone-700 sticky left-0 z-10 bg-white border-r border-stone-200">
                    Variance (Δ KG &amp; %)
                  </td>
                  {result.referenceColumns.map((col) => {
                    if (col.isCurrentBom) {
                      return (
                        <td
                          key={col.id}
                          className="p-2.5 text-center font-mono text-[11px] bg-amber-50/30 text-stone-500 border-r border-stone-200/80 last:border-r-0"
                        >
                          Baseline (0.00%)
                        </td>
                      );
                    }
                    const isDeficit = col.deltaWeight < -0.005;
                    const isExcess = col.deltaPct > 2.5;

                    return (
                      <td
                        key={col.id}
                        className={`p-2.5 text-center font-mono text-[11px] font-bold border-r border-stone-200/80 last:border-r-0 ${
                          isDeficit
                            ? "text-amber-700"
                            : isExcess
                            ? "text-rose-700"
                            : "text-emerald-700"
                        }`}
                      >
                        {col.deltaWeight > 0 ? `+${col.deltaWeight.toFixed(3)}` : col.deltaWeight.toFixed(3)} KG
                        <span className="block text-[10px] opacity-85">
                          ({col.deltaPct > 0 ? `+${col.deltaPct}%` : `${col.deltaPct}%`})
                        </span>
                      </td>
                    );
                  })}
                </tr>

                {/* Row 7: Diagnostic Verdict */}
                <tr className="bg-stone-100/50">
                  <td className="p-3 font-bold text-stone-900 sticky left-0 z-10 bg-stone-100 border-r border-stone-200">
                    Diagnostic Verdict
                  </td>
                  {result.referenceColumns.map((col) => {
                    if (col.isCurrentBom) {
                      return (
                        <td
                          key={col.id}
                          className="p-3 text-center bg-amber-50/60 border-r border-stone-200/80 last:border-r-0"
                        >
                          <Chip size="sm" color="default" variant="soft" className="text-[10px] font-bold">
                            Current Baseline
                          </Chip>
                        </td>
                      );
                    }

                    return (
                      <td
                        key={col.id}
                        className="p-3 text-center border-r border-stone-200/80 last:border-r-0"
                      >
                        <div className="flex flex-col items-center space-y-1">
                          <Chip
                            size="sm"
                            color={col.statusColor}
                            variant="soft"
                            className="font-bold text-[10px] whitespace-normal text-center leading-tight py-1 h-auto"
                          >
                            {col.verdictText}
                          </Chip>
                          {col.verdict === "DEFICIT" && (
                            <span className="text-[10px] text-amber-800 font-semibold">
                              Shortfall of {Math.abs(col.deltaWeight).toFixed(3)} KG
                            </span>
                          )}
                          {col.verdict === "EXCESS" && (
                            <span className="text-[10px] text-rose-800 font-semibold">
                              Surplus of +{col.deltaWeight.toFixed(3)} KG
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Proportional Rule Explanation Callout */}
      <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 text-xs text-stone-600 space-y-1 leading-relaxed">
        <div className="flex items-center space-x-1.5 font-bold text-stone-800">
          <Sparkles className="w-3.5 h-3.5 text-[#8B1E1E]" />
          <span>Proportional Quantity Checker Rules &amp; Math</span>
        </div>
        <div className="text-[11px] space-y-1 pl-5">
          <p>
            &bull; <strong>Proportional Rate:</strong> Consumption Rate = Allocated Weight (KG) &divide; Rug Surface Area (Sq. Ft.).
          </p>
          <p>
            &bull; <strong>Expected Weight for Target Size:</strong> Expected Weight = Reference Rate &times; Target Rug Area (Sq. Ft.).
          </p>
          <p>
            &bull; <strong>Deficit:</strong> If allocated weight is less than expected proportion &rarr; <span className="text-amber-800 font-semibold">&ldquo;More material is needed&rdquo;</span>.
          </p>
          <p>
            &bull; <strong>Excess (&gt; 2&ndash;3%):</strong> If allocated weight exceeds expected proportion by more than 2&ndash;3% &rarr; <span className="text-rose-800 font-semibold">&ldquo;Material needs to be decreased&rdquo;</span>.
          </p>
          <p>
            &bull; <strong>Optimal:</strong> If variance is within 0% to +2.5% &rarr; <span className="text-emerald-800 font-semibold">&ldquo;Optimal / Balanced Weight&rdquo;</span>.
          </p>
        </div>
      </div>
    </div>
  );
};
