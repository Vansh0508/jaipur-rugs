"use client";

import React, { useState, useEffect, useCallback, useTransition, useMemo } from "react";
import type { Selection } from "@heroui/react";
import {
  Button,
  Chip,
  Table,
  Typography,
} from "@heroui/react";
import { cn } from "@heroui/styles";
import {
  Search,
  ChevronRight,
  ChevronLeft,
  ChevronsUpDown,
  CornerDownRight,
  Layers,
  RefreshCw,
  Palette,
  Database,
  X,
  ArrowUpDown,
} from "lucide-react";
import { DesignMasterRecord } from "@/lib/queries/design-master";

interface DesignMasterTableProps {
  initialRecords?: DesignMasterRecord[];
  initialTotalCount?: number;
  initialPage?: number;
  initialPageSize?: number;
}

type TableItemRow = {
  id: string;
  prefix: string;
  code: string;
  description: string;
  quality: string;
  pileFibre: string;
  primaryStyleCode: string;
  primaryPatternCode: string;
  createdBy: string;
  creationDate: string | null;
  blocked: boolean;
  designGroupCode?: string;
  isParent: boolean;
  children: TableItemRow[];
};

// Global in-memory cache for instant client-side page transitions
const designMasterMemoryCache = new Map<string, { records: DesignMasterRecord[]; totalCount: number }>();

export const DesignMasterTable: React.FC<DesignMasterTableProps> = ({
  initialRecords = [],
  initialTotalCount = 0,
  initialPage = 1,
  initialPageSize = 20,
}) => {
  const [records, setRecords] = useState<DesignMasterRecord[]>(initialRecords);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [sortBy, setSortBy] = useState<"code" | "creationDate">("code");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [isLive, setIsLive] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const prefetchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const getCacheKey = (page: number, size: number, query: string, sort: string) =>
    `cache:${page}:${size}:${query}:${sort}`;

  // Cache initial records
  useEffect(() => {
    if (initialRecords.length > 0) {
      const key = getCacheKey(initialPage, initialPageSize, "", "code");
      designMasterMemoryCache.set(key, { records: initialRecords, totalCount: initialTotalCount });
    }
  }, [initialRecords, initialTotalCount, initialPage, initialPageSize]);

  // Expanded keys for Hero UI Tree Table (default to all expanded)
  const [expandedKeys, setExpandedKeys] = useState<Selection>(() => new Set<string>());

  // Fetch records from API with server-side pagination, caching & prefetching
  const loadData = useCallback(
    async (page: number, size: number, query: string, sort: "code" | "creationDate") => {
      const key = getCacheKey(page, size, query, sort);

      // Instant cache hit: render immediately
      if (designMasterMemoryCache.has(key)) {
        const cached = designMasterMemoryCache.get(key)!;
        setRecords(cached.records);
        setTotalCount(cached.totalCount);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(size),
          sortBy: sort,
          sortDir: sort === "creationDate" ? "desc" : "asc",
        });
        if (query.trim()) {
          params.set("search", query.trim());
        }

        const res = await fetch(`/api/design-master?${params.toString()}`);
        const data = await res.json();

        if (data.success) {
          const fetchedRecords = data.records || [];
          const fetchedCount = data.totalCount || 0;

          // Save to memory cache
          designMasterMemoryCache.set(key, { records: fetchedRecords, totalCount: fetchedCount });

          startTransition(() => {
            setRecords(fetchedRecords);
            setTotalCount(fetchedCount);
            setIsLive(data.isLive ?? true);
          });

          // Background Prefetch next page for 0ms transition
          const totalP = Math.max(1, Math.ceil(fetchedCount / size));
          if (page < totalP) {
            if (prefetchTimeoutRef.current) clearTimeout(prefetchTimeoutRef.current);
            prefetchTimeoutRef.current = setTimeout(() => {
              const nextKey = getCacheKey(page + 1, size, query, sort);
              if (!designMasterMemoryCache.has(nextKey)) {
                const nextParams = new URLSearchParams({
                  page: String(page + 1),
                  pageSize: String(size),
                  sortBy: sort,
                  sortDir: sort === "creationDate" ? "desc" : "asc",
                });
                if (query.trim()) nextParams.set("search", query.trim());
                fetch(`/api/design-master?${nextParams.toString()}`)
                  .then((r) => r.json())
                  .then((d) => {
                    if (d.success) {
                      designMasterMemoryCache.set(nextKey, {
                        records: d.records || [],
                        totalCount: d.totalCount || 0,
                      });
                    }
                  })
                  .catch(() => {});
              }
            }, 600);
          }
        } else {
          setErrorMessage(data.error || "Failed to load records");
        }
      } catch (err: any) {
        setErrorMessage(err.message || "Network error loading design master");
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // Initial load if records empty
  useEffect(() => {
    if (initialRecords.length === 0) {
      loadData(currentPage, pageSize, activeSearch, sortBy);
    }
  }, [loadData, currentPage, pageSize, activeSearch, sortBy, initialRecords.length]);

  // Debounced search trigger
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm !== activeSearch) {
        setActiveSearch(searchTerm);
        setCurrentPage(1);
        loadData(1, pageSize, searchTerm, sortBy);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchTerm, activeSearch, pageSize, sortBy, loadData]);

  // Group records by Design Prefix
  const tableData: TableItemRow[] = useMemo(() => {
    const groups = new Map<string, DesignMasterRecord[]>();

    for (const rec of records) {
      const p = rec.prefix || "OTHER";
      if (!groups.has(p)) {
        groups.set(p, []);
      }
      groups.get(p)!.push(rec);
    }

    return Array.from(groups.entries()).map(([prefix, items]) => {
      const first = items[0];
      const uniqueFibres = Array.from(new Set(items.map((i) => i.pileFibre).filter(Boolean)));
      const uniqueQualities = Array.from(new Set(items.map((i) => i.qualityDetail).filter(Boolean)));
      const uniqueStyles = Array.from(new Set(items.map((i) => i.primaryStyleCode).filter(Boolean)));
      const anyBlocked = items.some((i) => i.blocked);

      const children: TableItemRow[] = items.map((rec) => ({
        id: `child__${rec.code}`,
        prefix: rec.prefix,
        code: rec.code,
        description: rec.description || rec.indianDesignName || "—",
        quality: rec.qualityDetail || "—",
        pileFibre: rec.pileFibre || "—",
        primaryStyleCode: rec.primaryStyleCode || "",
        primaryPatternCode: rec.primaryPatternCode || "",
        createdBy: rec.createdBy || "—",
        creationDate: rec.creationDate,
        blocked: rec.blocked,
        designGroupCode: rec.designGroupCode,
        isParent: false,
        children: [],
      }));

      return {
        id: `group__${prefix}`,
        prefix,
        code: prefix,
        description:
          items.length === 1
            ? first.description || first.indianDesignName || "—"
            : `${items.length} designs in ${prefix} series`,
        quality:
          uniqueQualities.length === 1
            ? uniqueQualities[0]
            : `${uniqueQualities.length} variations`,
        pileFibre: uniqueFibres.join(", ") || first.pileFibre || "—",
        primaryStyleCode: uniqueStyles[0] || "",
        primaryPatternCode: "",
        createdBy: first.createdBy || "—",
        creationDate: first.creationDate,
        blocked: anyBlocked,
        isParent: true,
        children,
      };
    });
  }, [records]);

  // Auto-expand all parent rows when new tableData arrives
  useEffect(() => {
    if (tableData.length > 0) {
      setExpandedKeys(new Set(tableData.map((d) => d.id)));
    }
  }, [tableData]);

  // Expand / Collapse all handler
  const isAllCurrentlyExpanded = useMemo(() => {
    if (expandedKeys === "all") return true;
    if (expandedKeys instanceof Set && tableData.length > 0) {
      return tableData.every((d) => expandedKeys.has(d.id));
    }
    return false;
  }, [expandedKeys, tableData]);

  const handleToggleExpandAll = () => {
    if (isAllCurrentlyExpanded) {
      setExpandedKeys(new Set<string>());
    } else {
      setExpandedKeys(new Set<string>(tableData.map((d) => d.id)));
    }
  };

  // Handle page change with instant memory cache hit
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    const key = getCacheKey(newPage, pageSize, activeSearch, sortBy);
    if (designMasterMemoryCache.has(key)) {
      const cached = designMasterMemoryCache.get(key)!;
      setRecords(cached.records);
      setTotalCount(cached.totalCount);
    } else {
      loadData(newPage, pageSize, activeSearch, sortBy);
    }
  };

  // Handle page size change
  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
    loadData(1, newSize, activeSearch, sortBy);
  };

  // Handle sort change
  const handleSortChange = (newSort: "code" | "creationDate") => {
    setSortBy(newSort);
    setCurrentPage(1);
    loadData(1, pageSize, activeSearch, newSort);
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const startResult = totalCount > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const endResult = Math.min(currentPage * pageSize, totalCount);

  // Render fibre chip
  const renderFibreChip = (fibre: string) => {
    if (!fibre || fibre === "—") return <span className="text-stone-400 text-xs">—</span>;
    const fLower = fibre.toLowerCase();
    let color: "default" | "accent" | "success" | "warning" = "default";
    if (fLower.includes("wool")) color = "accent";
    else if (fLower.includes("silk")) color = "success";
    else if (fLower.includes("jute") || fLower.includes("cotton")) color = "warning";

    return (
      <Chip variant="soft" color={color} size="sm" className="text-[11px] font-semibold h-5 px-2">
        {fibre}
      </Chip>
    );
  };

  // Recursive row render matching benchmarks-view.tsx
  const renderExpandableRow = (item: TableItemRow) => {
    return (
      <Table.Row
        id={item.id}
        textValue={item.code}
        className={
          item.isParent
            ? "bg-stone-50/70 hover:bg-stone-100/70 border-b border-stone-200/90 transition-colors cursor-pointer select-none font-semibold"
            : "bg-white hover:bg-stone-50/80 border-b border-stone-100 transition-colors select-none"
        }
      >
        {/* Tree Column: Design Prefix (parent) or Design Code (child) */}
        <Table.Cell textValue={item.code} className="font-sans text-xs py-3 px-4 tabular-nums">
          {({ hasChildItems, isDisabled, isExpanded, isTreeColumn }) => (
            <span className="flex items-center gap-2">
              {hasChildItems && isTreeColumn ? (
                <Button
                  isIconOnly
                  aria-label="Toggle prefix group"
                  isDisabled={isDisabled}
                  size="sm"
                  slot="chevron"
                  variant="ghost"
                  className="w-6 h-6 p-0 text-stone-500 hover:text-stone-900 cursor-pointer rounded-md shrink-0"
                >
                  <ChevronRight
                    aria-hidden
                    className={cn(
                      "w-3.5 h-3.5 text-stone-600 transition-transform duration-150",
                      isExpanded ? "rotate-90" : "rtl:rotate-180"
                    )}
                  />
                </Button>
              ) : !item.isParent ? (
                <span className="w-6 flex items-center justify-center text-stone-400 shrink-0">
                  <CornerDownRight className="w-3.5 h-3.5 text-stone-400" />
                </span>
              ) : (
                <span className="w-6 shrink-0" />
              )}

              {item.isParent ? (
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-stone-900 text-xs bg-white border border-stone-300/80 px-2 py-0.5 rounded-md font-mono shadow-2xs">
                    {item.prefix}
                  </span>
                  <Chip
                    variant="soft"
                    size="sm"
                    className="text-[10px] h-4.5 px-2 font-bold text-stone-700 bg-stone-200/80"
                  >
                    {item.children.length} {item.children.length === 1 ? "Design" : "Designs"}
                  </Chip>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-stone-900 text-xs bg-stone-50 border border-stone-200 px-2 py-0.5 rounded-md shadow-2xs font-mono">
                    {item.code}
                  </span>
                  {item.designGroupCode && (
                    <Chip variant="soft" size="sm" className="text-[10px] h-4 px-1.5 font-medium">
                      {item.designGroupCode}
                    </Chip>
                  )}
                </div>
              )}
            </span>
          )}
        </Table.Cell>

        {/* Description / Indian Name */}
        <Table.Cell className="text-xs text-stone-800">
          <div className="max-w-[240px]">
            <span
              className={cn("block truncate", item.isParent ? "font-semibold text-stone-700 italic text-[11px]" : "font-medium")}
              title={item.description}
            >
              {item.description}
            </span>
          </div>
        </Table.Cell>

        {/* Quality / Construction */}
        <Table.Cell className="text-xs text-stone-700">
          <span className={cn(item.isParent ? "font-semibold text-stone-800" : "text-stone-700")}>
            {item.quality}
          </span>
        </Table.Cell>

        {/* Pile Fibre */}
        <Table.Cell className="text-xs">
          {renderFibreChip(item.pileFibre)}
        </Table.Cell>

        {/* Style & Pattern */}
        <Table.Cell className="text-xs">
          <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
            {item.primaryStyleCode ? (
              <Chip variant="soft" size="sm" className="text-[10px] font-medium">
                {item.primaryStyleCode}
              </Chip>
            ) : null}
            {item.primaryPatternCode ? (
              <Chip variant="soft" size="sm" className="text-[10px] font-medium text-stone-600">
                {item.primaryPatternCode}
              </Chip>
            ) : null}
            {!item.primaryStyleCode && !item.primaryPatternCode && (
              <span className="text-stone-400 text-[11px]">—</span>
            )}
          </div>
        </Table.Cell>

        {/* Created By & Date */}
        <Table.Cell className="text-xs text-stone-600">
          <div className="space-y-0.5">
            <span className="font-mono text-[11px] text-stone-800 block truncate max-w-[130px]" title={item.createdBy}>
              {item.createdBy ? item.createdBy.replace("JR\\", "") : "—"}
            </span>
            <span className="text-[10px] text-stone-400 block tabular-nums">
              {item.creationDate || "—"}
            </span>
          </div>
        </Table.Cell>

        {/* Status */}
        <Table.Cell className="text-xs">
          {item.blocked ? (
            <Chip color="danger" variant="soft" size="sm" className="font-semibold text-[10px]">
              Blocked
            </Chip>
          ) : (
            <Chip color="success" variant="soft" size="sm" className="font-semibold text-[10px]">
              Active
            </Chip>
          )}
        </Table.Cell>

        {/* Hero UI Table.Collection for expandable child rows */}
        <Table.Collection items={item.children}>
          {renderExpandableRow}
        </Table.Collection>
      </Table.Row>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header: Title & Quick Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-200/80 pb-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#8B1E1E] flex items-center justify-center text-white shadow-2xs">
              <Palette className="w-4 h-4" />
            </div>
            <div>
              <Typography.Heading level={2} className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">
                Design Master
              </Typography.Heading>
            </div>
            <Chip
              color={isLive ? "success" : "warning"}
              variant="soft"
              size="sm"
              className="text-[10px] h-5 font-semibold"
            >
              {isLive ? "MS SQL Live" : "Offline"}
            </Chip>
          </div>
          <p className="text-xs text-stone-500 font-medium pl-10.5">
            Grouped by Design Prefix (code pre-hyphen) from ERP table:{" "}
            <code className="font-mono bg-stone-100 px-1 py-0.5 rounded text-stone-700">
              [dbo].[JRCPL Live$Design]
            </code>
          </p>
        </div>

        {/* Quick Stats Badges */}
        <div className="flex items-center space-x-2 flex-wrap self-start sm:self-auto">
          <div className="flex items-center space-x-1.5 text-xs bg-stone-50 border border-stone-200/80 px-3 py-1.5 rounded-full">
            <Layers className="w-3.5 h-3.5 text-stone-500" />
            <span className="font-medium text-stone-500">Prefix Groups:</span>
            <span className="font-bold text-stone-900 font-sans tabular-nums">
              {tableData.length}
            </span>
          </div>
          <div className="flex items-center space-x-1.5 text-xs bg-stone-50 border border-stone-200/80 px-3 py-1.5 rounded-full">
            <Database className="w-3.5 h-3.5 text-stone-500" />
            <span className="font-medium text-stone-500">Total Designs:</span>
            <span className="font-bold text-stone-900 font-sans tabular-nums">
              {totalCount.toLocaleString()}
            </span>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => loadData(currentPage, pageSize, activeSearch, sortBy)}
            isDisabled={isLoading}
            className="text-xs font-semibold h-8 px-3 rounded-full border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 flex items-center space-x-1.5 cursor-pointer shadow-2xs"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-stone-500 ${isLoading ? "animate-spin text-[#8B1E1E]" : ""}`}
            />
            <span>Sync</span>
          </Button>
        </div>
      </div>

      {/* Toolbar: Pill Search, Sorting, and Expand/Collapse All */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 text-xs text-stone-600">
        <div className="flex items-center space-x-2 flex-wrap flex-1">
          {/* Pill Search */}
          <div className="relative min-w-[280px] flex-1 sm:flex-initial">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search prefix, code, description, fibre..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-80 pl-8 pr-8 py-1.5 text-xs bg-stone-50/80 hover:bg-white focus:bg-white border border-stone-200/90 rounded-full focus:outline-hidden focus:border-stone-400 focus:ring-1 focus:ring-stone-200 transition placeholder:text-stone-400 font-medium"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Sort Order Selector */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => handleSortChange(e.target.value as "code" | "creationDate")}
              className="appearance-none text-xs h-8 pl-3 pr-7 rounded-full border border-stone-200/90 bg-stone-50/80 hover:bg-white focus:bg-white focus:outline-hidden focus:border-stone-400 font-medium text-stone-700 cursor-pointer transition shadow-2xs"
            >
              <option value="code">Sort by Prefix / Code (A-Z)</option>
              <option value="creationDate">Sort by Recently Created</option>
            </select>
          </div>

          {activeSearch && (
            <button
              onClick={() => {
                setSearchTerm("");
                setActiveSearch("");
                setCurrentPage(1);
                loadData(1, pageSize, "", sortBy);
              }}
              className="text-[11px] text-stone-500 hover:text-stone-900 underline cursor-pointer"
            >
              Clear search
            </button>
          )}
        </div>

        {/* Expand / Collapse All Action Button */}
        <div className="flex items-center space-x-2 self-end sm:self-auto">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleToggleExpandAll}
            className="text-xs font-semibold h-8 px-3.5 rounded-full border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 flex items-center space-x-1.5 cursor-pointer shadow-2xs"
          >
            <ChevronsUpDown className="w-3.5 h-3.5 text-stone-500" />
            <span>{isAllCurrentlyExpanded ? "Collapse All" : "Expand All"}</span>
          </Button>
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center justify-between">
          <span>{errorMessage}</span>
          <Button size="sm" variant="ghost" onClick={() => loadData(currentPage, pageSize, activeSearch, sortBy)}>
            Retry
          </Button>
        </div>
      )}

      {/* Main Table Container with Expandable Tree */}
      <div className="w-full rounded-2xl border border-stone-200/90 shadow-2xs bg-white overflow-hidden relative">
        {/* Lazy Loading Overlay */}
        {(isLoading || isPending) && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex items-center justify-center pointer-events-none transition-opacity">
            <div className="flex items-center space-x-2 bg-white px-4 py-2 rounded-xl shadow-md border border-stone-200 text-xs font-semibold text-stone-700">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#8B1E1E]" />
              <span>Loading ERP records...</span>
            </div>
          </div>
        )}

        {tableData.length === 0 && !isLoading ? (
          <div className="text-center py-20 px-4">
            <div className="w-12 h-12 rounded-2xl bg-stone-100 flex items-center justify-center text-stone-400 mx-auto mb-3">
              <Search className="w-6 h-6" />
            </div>
            <Typography.Heading level={4} className="font-bold text-stone-800">
              No design records found
            </Typography.Heading>
            <Typography.Paragraph size="xs" color="muted" className="text-stone-500 mt-1 max-w-md mx-auto">
              Try adjusting your search query or syncing to fetch the latest records.
            </Typography.Paragraph>
          </div>
        ) : (
          <Table>
            <Table.ScrollContainer>
              <Table.Content
                aria-label="Grouped Design Master Table"
                className="min-w-[950px]"
                expandedKeys={expandedKeys}
                treeColumn="prefix"
                onExpandedChange={setExpandedKeys}
              >
                <Table.Header>
                  <Table.Column isRowHeader id="prefix" className="text-stone-700 font-bold">
                    Design Prefix / Code
                  </Table.Column>
                  <Table.Column id="description" className="text-stone-700 font-bold">
                    Description / Name
                  </Table.Column>
                  <Table.Column id="quality" className="text-stone-700 font-bold">
                    Quality / Construction
                  </Table.Column>
                  <Table.Column id="fibre" className="text-stone-700 font-bold">
                    Pile Fibre
                  </Table.Column>
                  <Table.Column id="stylePattern" className="text-stone-700 font-bold">
                    Style & Pattern
                  </Table.Column>
                  <Table.Column id="createdBy" className="text-stone-700 font-bold">
                    Created By / Date
                  </Table.Column>
                  <Table.Column id="status" className="text-stone-700 font-bold">
                    Status
                  </Table.Column>
                </Table.Header>
                <Table.Body items={tableData}>
                  {renderExpandableRow}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        )}

        {/* Pagination Bar (Replicated from benchmarks-view.tsx) */}
        <div className="flex flex-col sm:flex-row items-center justify-between px-5 py-3.5 border-t border-stone-200 bg-white gap-3 select-none">
          {/* Left: Summary Count */}
          <Typography.Paragraph size="xs" color="muted" className="text-stone-500 font-medium">
            Showing <span className="font-semibold text-stone-900 font-sans tabular-nums">{startResult.toLocaleString()}</span> to{" "}
            <span className="font-semibold text-stone-900 font-sans tabular-nums">{endResult.toLocaleString()}</span> of{" "}
            <span className="font-semibold text-stone-900 font-sans tabular-nums">{totalCount.toLocaleString()}</span> Designs
          </Typography.Paragraph>

          {/* Right: Pagination Controls */}
          <div className="flex items-center space-x-2.5 text-xs">
            {/* Rows selector */}
            <div className="flex items-center space-x-1.5 text-stone-500 pr-2 border-r border-stone-200">
              <span className="text-[11px] font-medium">Rows:</span>
              <select
                value={pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                className="appearance-none bg-stone-50 border border-stone-200 rounded-lg px-2 py-0.5 text-xs font-semibold text-stone-800 focus:outline-hidden focus:border-stone-400 cursor-pointer shadow-2xs"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            {/* Prev Page Button */}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
              isDisabled={currentPage === 1 || isLoading}
              className="h-7 px-2.5 rounded-lg border border-stone-200 bg-white text-stone-700 disabled:opacity-40 disabled:cursor-not-allowed font-semibold flex items-center space-x-1 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Prev</span>
            </Button>

            {/* Current Page Indicator */}
            <span className="text-xs font-semibold text-stone-700 px-1 font-sans tabular-nums">
              Page {currentPage} of {totalPages}
            </span>

            {/* Next Page Button */}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
              isDisabled={currentPage === totalPages || isLoading}
              className="h-7 px-2.5 rounded-lg border border-stone-200 bg-white text-stone-700 disabled:opacity-40 disabled:cursor-not-allowed font-semibold flex items-center space-x-1 cursor-pointer"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
