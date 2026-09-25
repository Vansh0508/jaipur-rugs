"use client";

import React, { useState, useEffect, useCallback, useTransition, useRef } from "react";
import {
  Button,
  Chip,
  Table,
  Typography,
} from "@heroui/react";
import {
  Search,
  ChevronRight,
  ChevronLeft,
  RefreshCw,
  Database,
  X,
  Boxes,
  Sparkles,
} from "lucide-react";
import { BomGroupSetupRecord } from "@/lib/queries/bom-group-setup";

interface BomGroupSetupTableProps {
  initialRecords?: BomGroupSetupRecord[];
  initialTotalCount?: number;
  initialPage?: number;
  initialPageSize?: number;
}

const GROUP_ITEM_LABELS: Record<string, { label: string; color: "default" | "accent" | "success" | "warning" }> = {
  GR_DY_WYN: { label: "Dyed Wool Yarn", color: "accent" },
  GR_DY_BYN: { label: "Dyed Blend Yarn", color: "accent" },
  GR_DY_SKYN: { label: "Dyed Silk Yarn", color: "success" },
  GR_TN: { label: "Tani", color: "warning" },
  GR_TH: { label: "Theda", color: "warning" },
  GR_LC: { label: "Lacchi", color: "default" },
};

// Global in-memory cache for instant client-side page transitions
const bomGroupMemoryCache = new Map<string, { records: BomGroupSetupRecord[]; totalCount: number }>();

export const BomGroupSetupTable: React.FC<BomGroupSetupTableProps> = ({
  initialRecords = [],
  initialTotalCount = 0,
  initialPage = 1,
  initialPageSize = 20,
}) => {
  const [records, setRecords] = useState<BomGroupSetupRecord[]>(initialRecords);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("");
  const [onlyConfigured, setOnlyConfigured] = useState(false);
  const [isLive, setIsLive] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const prefetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const getCacheKey = (page: number, size: number, query: string, group: string, configuredOnly: boolean) =>
    `cache:${page}:${size}:${query}:${group}:${configuredOnly}`;

  // Cache initial records if provided
  useEffect(() => {
    if (initialRecords.length > 0) {
      const key = getCacheKey(initialPage, initialPageSize, "", "", false);
      bomGroupMemoryCache.set(key, { records: initialRecords, totalCount: initialTotalCount });
    }
  }, [initialRecords, initialTotalCount, initialPage, initialPageSize]);

  // Fetch records with in-memory caching and lazy loading
  const loadData = useCallback(
    async (page: number, size: number, query: string, group: string, configuredOnly: boolean) => {
      const key = getCacheKey(page, size, query, group, configuredOnly);

      // Instant cache hit: render immediately
      if (bomGroupMemoryCache.has(key)) {
        const cached = bomGroupMemoryCache.get(key)!;
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
        });
        if (query.trim()) {
          params.set("search", query.trim());
        }
        if (group.trim()) {
          params.set("groupItemNo", group.trim());
        }
        if (configuredOnly) {
          params.set("onlyConfigured", "true");
        }

        const res = await fetch(`/api/bom-group-setup?${params.toString()}`);
        const data = await res.json();

        if (data.success) {
          const fetchedRecords = data.records || [];
          const fetchedCount = data.totalCount || 0;

          // Save to memory cache
          bomGroupMemoryCache.set(key, { records: fetchedRecords, totalCount: fetchedCount });

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
              const nextKey = getCacheKey(page + 1, size, query, group, configuredOnly);
              if (!bomGroupMemoryCache.has(nextKey)) {
                const nextParams = new URLSearchParams({
                  page: String(page + 1),
                  pageSize: String(size),
                });
                if (query.trim()) nextParams.set("search", query.trim());
                if (group.trim()) nextParams.set("groupItemNo", group.trim());
                if (configuredOnly) nextParams.set("onlyConfigured", "true");

                fetch(`/api/bom-group-setup?${nextParams.toString()}`)
                  .then((r) => r.json())
                  .then((d) => {
                    if (d.success) {
                      bomGroupMemoryCache.set(nextKey, {
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
        setErrorMessage(err.message || "Network error loading BOM group setup");
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // Initial fetch if no initial data
  useEffect(() => {
    if (initialRecords.length === 0) {
      loadData(currentPage, pageSize, activeSearch, selectedGroup, onlyConfigured);
    }
  }, [loadData, currentPage, pageSize, activeSearch, selectedGroup, onlyConfigured, initialRecords.length]);

  // Debounced search trigger
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm !== activeSearch) {
        setActiveSearch(searchTerm);
        setCurrentPage(1);
        loadData(1, pageSize, searchTerm, selectedGroup, onlyConfigured);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchTerm, activeSearch, pageSize, selectedGroup, onlyConfigured, loadData]);

  // Handle page change with instant cache hit
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    const key = getCacheKey(newPage, pageSize, activeSearch, selectedGroup, onlyConfigured);
    if (bomGroupMemoryCache.has(key)) {
      const cached = bomGroupMemoryCache.get(key)!;
      setRecords(cached.records);
      setTotalCount(cached.totalCount);
    } else {
      loadData(newPage, pageSize, activeSearch, selectedGroup, onlyConfigured);
    }
  };

  // Handle page size change
  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
    loadData(1, newSize, activeSearch, selectedGroup, onlyConfigured);
  };

  // Handle group filter change
  const handleGroupFilterChange = (group: string) => {
    setSelectedGroup(group);
    setCurrentPage(1);
    loadData(1, pageSize, activeSearch, group, onlyConfigured);
  };

  // Handle onlyConfigured toggle
  const handleConfiguredToggle = (checked: boolean) => {
    setOnlyConfigured(checked);
    setCurrentPage(1);
    loadData(1, pageSize, activeSearch, selectedGroup, checked);
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const startResult = totalCount > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const endResult = Math.min(currentPage * pageSize, totalCount);

  // Render Group Item Badge
  const renderGroupItemBadge = (groupCode: string | null) => {
    if (!groupCode) {
      return <span className="text-stone-400 text-xs italic">Unassigned</span>;
    }
    const meta = GROUP_ITEM_LABELS[groupCode];
    const color = meta?.color || "default";

    return (
      <div className="flex items-center space-x-1.5">
        <Chip variant="soft" color={color} size="sm" className="text-[10px] font-bold font-mono h-5 px-1.5">
          {groupCode}
        </Chip>
        {meta && (
          <span className="text-[11px] text-stone-600 font-medium">
            {meta.label}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header: Title & Quick Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-200/80 pb-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#8B1E1E] flex items-center justify-center text-white shadow-2xs">
              <Boxes className="w-4 h-4" />
            </div>
            <div>
              <Typography.Heading level={2} className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">
                BOM Group Item Setup
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
            ERP Report View: <code className="font-mono bg-stone-100 px-1 py-0.5 rounded text-stone-700">[dbo].[Production BOM Group Item No Setup]</code>
          </p>
        </div>

        {/* Quick Stats Badges */}
        <div className="flex items-center space-x-2 flex-wrap self-start sm:self-auto">
          <div className="flex items-center space-x-1.5 text-xs bg-amber-50 border border-amber-200/80 px-3 py-1.5 rounded-full text-amber-800 font-medium">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>Newest Creations First</span>
          </div>
          <div className="flex items-center space-x-1.5 text-xs bg-stone-50 border border-stone-200/80 px-3 py-1.5 rounded-full">
            <Database className="w-3.5 h-3.5 text-stone-500" />
            <span className="font-medium text-stone-500">Total Rows:</span>
            <span className="font-bold text-stone-900 font-sans tabular-nums">
              {totalCount.toLocaleString()}
            </span>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              bomGroupMemoryCache.clear();
              loadData(currentPage, pageSize, activeSearch, selectedGroup, onlyConfigured);
            }}
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

      {/* Toolbar: Pill Search, Group Selector, and Filter Toggles */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 text-xs text-stone-600">
        <div className="flex items-center space-x-2 flex-wrap flex-1">
          {/* Pill Search */}
          <div className="relative min-w-[280px] flex-1 sm:flex-initial">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search exact BOM (e.g. 148425, JRC/PRDBOM/...), item no, design..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-80 pl-8 pr-8 py-1.5 text-xs bg-stone-50/80 hover:bg-white focus:bg-white border border-stone-200/90 rounded-full focus:outline-hidden focus:border-stone-400 focus:ring-1 focus:ring-stone-200 transition placeholder:text-stone-400 font-medium"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 p-0.5 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Group Item Selector */}
          <div className="relative">
            <select
              value={selectedGroup}
              onChange={(e) => handleGroupFilterChange(e.target.value)}
              className="appearance-none text-xs h-8 pl-3 pr-7 rounded-full border border-stone-200/90 bg-stone-50/80 hover:bg-white focus:bg-white focus:outline-hidden focus:border-stone-400 font-medium text-stone-700 cursor-pointer transition shadow-2xs"
            >
              <option value="">All Groups</option>
              <option value="GR_DY_WYN">GR_DY_WYN (Dyed Wool Yarn)</option>
              <option value="GR_DY_BYN">GR_DY_BYN (Dyed Blend Yarn)</option>
              <option value="GR_TN">GR_TN (Tani)</option>
              <option value="GR_TH">GR_TH (Theda)</option>
              <option value="GR_LC">GR_LC (Lacchi)</option>
            </select>
          </div>

          {/* Only Configured Checkbox Toggle */}
          <label className="flex items-center space-x-1.5 text-xs text-stone-700 font-medium cursor-pointer bg-stone-50/80 border border-stone-200/90 px-3 py-1.5 rounded-full hover:bg-white transition select-none">
            <input
              type="checkbox"
              checked={onlyConfigured}
              onChange={(e) => handleConfiguredToggle(e.target.checked)}
              className="rounded border-stone-300 text-[#8B1E1E] focus:ring-[#8B1E1E]"
            />
            <span>Only Configured Groups</span>
          </label>

          {(activeSearch || selectedGroup || onlyConfigured) && (
            <button
              onClick={() => {
                setSearchTerm("");
                setActiveSearch("");
                setSelectedGroup("");
                setOnlyConfigured(false);
                setCurrentPage(1);
                loadData(1, pageSize, "", "", false);
              }}
              className="text-[11px] text-stone-500 hover:text-stone-900 underline cursor-pointer"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Current status display */}
        {isLoading && (
          <div className="flex items-center space-x-1.5 text-[11px] text-stone-500">
            <RefreshCw className="w-3 h-3 animate-spin text-[#8B1E1E]" />
            <span>Fetching live report rows...</span>
          </div>
        )}
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center justify-between">
          <span>{errorMessage}</span>
          <Button size="sm" variant="ghost" onClick={() => loadData(currentPage, pageSize, activeSearch, selectedGroup, onlyConfigured)}>
            Retry
          </Button>
        </div>
      )}

      {/* Main Table Container */}
      <div className="w-full rounded-2xl border border-stone-200/90 shadow-2xs bg-white overflow-hidden relative">
        {/* Lazy Loading Skeleton Shimmer */}
        {isLoading && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-[1.5px] z-10 flex flex-col justify-start pointer-events-none transition-opacity">
            <div className="w-full p-4 space-y-3">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="flex items-center justify-between gap-4 py-2 border-b border-stone-100 animate-pulse">
                  <div className="h-4 w-28 bg-stone-200/70 rounded-md" />
                  <div className="h-4 w-24 bg-stone-200/70 rounded-md" />
                  <div className="h-4 w-36 bg-stone-200/70 rounded-md" />
                  <div className="h-4 w-24 bg-stone-200/70 rounded-md" />
                  <div className="h-4 w-16 bg-stone-200/70 rounded-md" />
                  <div className="h-4 w-16 bg-stone-200/70 rounded-md" />
                  <div className="h-4 w-16 bg-stone-200/70 rounded-md" />
                </div>
              ))}
            </div>
          </div>
        )}

        {records.length === 0 && !isLoading ? (
          <div className="text-center py-20 px-4">
            <div className="w-12 h-12 rounded-2xl bg-stone-100 flex items-center justify-center text-stone-400 mx-auto mb-3">
              <Search className="w-6 h-6" />
            </div>
            <Typography.Heading level={4} className="font-bold text-stone-800">
              No BOM setup records found
            </Typography.Heading>
            <Typography.Paragraph size="xs" color="muted" className="text-stone-500 mt-1 max-w-md mx-auto">
              Try adjusting your search criteria or unchecking "Only Configured Groups".
            </Typography.Paragraph>
          </div>
        ) : (
          <Table>
            <Table.ScrollContainer>
              <Table.Content aria-label="Production BOM Group Item No Setup Table" className="min-w-[1000px]">
                <Table.Header>
                  <Table.Column isRowHeader id="bomNo" className="text-stone-700 font-bold">
                    <div className="flex items-center space-x-1.5">
                      <span>BOM No_</span>
                      <span className="text-[10px] text-amber-800 bg-amber-100/90 font-mono px-1.5 py-0.5 rounded-md font-semibold tracking-wide">
                        NEWEST ↓
                      </span>
                    </div>
                  </Table.Column>
                  <Table.Column id="itemNo" className="text-stone-700 font-bold">
                    Rug Item No_
                  </Table.Column>
                  <Table.Column id="designQuality" className="text-stone-700 font-bold">
                    Design & Quality
                  </Table.Column>
                  <Table.Column id="groupItem" className="text-stone-700 font-bold">
                    Group Item No_
                  </Table.Column>
                  <Table.Column id="packing" className="text-stone-700 font-bold text-right">
                    Packing (kg/sq ft)
                  </Table.Column>
                  <Table.Column id="standard" className="text-stone-700 font-bold text-right">
                    Standard (kg/sq ft)
                  </Table.Column>
                  <Table.Column id="totalStd" className="text-stone-700 font-bold text-right">
                    Total Std (kg)
                  </Table.Column>
                  <Table.Column id="contribution" className="text-stone-700 font-bold text-center">
                    Contribution
                  </Table.Column>
                </Table.Header>
                <Table.Body items={records}>
                  {(item: BomGroupSetupRecord) => {
                    const rowKey = `${item.bomNo}__${item.itemNo}__${item.groupItemNo || "none"}__${item.yarnCode || ""}`;
                    return (
                      <Table.Row
                        id={rowKey}
                        className="hover:bg-stone-50/80 border-b border-stone-200/80 transition-colors"
                      >
                        {/* BOM No_ */}
                        <Table.Cell className="font-sans text-xs py-3 px-4 tabular-nums">
                          <span className="font-bold text-stone-900 text-xs bg-stone-100 border border-stone-200 px-2 py-0.5 rounded-md shadow-2xs font-mono">
                            {item.bomNo || "—"}
                          </span>
                        </Table.Cell>

                        {/* Rug Item No_ */}
                        <Table.Cell className="text-xs text-stone-800">
                          <div>
                            <span className="font-bold text-stone-900 font-mono text-xs block">
                              {item.itemNo || "—"}
                            </span>
                            {item.itemDescription && (
                              <span className="text-[10px] text-stone-500 block truncate max-w-[200px]" title={item.itemDescription}>
                                {item.itemDescription}
                              </span>
                            )}
                          </div>
                        </Table.Cell>

                        {/* Design & Quality */}
                        <Table.Cell className="text-xs text-stone-700">
                          <div>
                            <span className="font-bold text-stone-900 block">
                              {item.design || "—"}
                            </span>
                            {item.quality && (
                              <span className="text-[11px] text-stone-600 block">
                                {item.quality}
                              </span>
                            )}
                          </div>
                        </Table.Cell>

                        {/* Group Item No_ */}
                        <Table.Cell className="text-xs">
                          {renderGroupItemBadge(item.groupItemNo)}
                        </Table.Cell>

                        {/* Packing (kg/sq ft) */}
                        <Table.Cell className="text-xs text-stone-800 text-right font-sans tabular-nums">
                          {item.packingKgSqFt !== null ? (
                            <span className="font-medium">{item.packingKgSqFt.toFixed(3)}</span>
                          ) : (
                            <span className="text-stone-400">—</span>
                          )}
                        </Table.Cell>

                        {/* Standard (kg/sq ft) */}
                        <Table.Cell className="text-xs text-stone-800 text-right font-sans tabular-nums">
                          {item.standardKgSqFt !== null ? (
                            <span className="font-semibold text-stone-900">{item.standardKgSqFt.toFixed(3)}</span>
                          ) : (
                            <span className="text-stone-400">—</span>
                          )}
                        </Table.Cell>

                        {/* Total Std (kg) */}
                        <Table.Cell className="text-xs text-stone-800 text-right font-sans tabular-nums">
                          {item.totalGroupedStandard !== null ? (
                            <span className="font-bold text-stone-900">{item.totalGroupedStandard.toFixed(3)} kg</span>
                          ) : (
                            <span className="text-stone-400">—</span>
                          )}
                        </Table.Cell>

                        {/* Contribution % */}
                        <Table.Cell className="text-xs text-center">
                          {item.contribution !== null && item.contribution > 0 ? (
                            <Chip variant="soft" color="accent" size="sm" className="text-[10px] font-bold">
                              {item.contribution}%
                            </Chip>
                          ) : (
                            <span className="text-stone-400 text-xs">—</span>
                          )}
                        </Table.Cell>
                      </Table.Row>
                    );
                  }}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        )}

        {/* Pagination Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between px-5 py-3.5 border-t border-stone-200 bg-white gap-3 select-none">
          {/* Left: Summary Count */}
          <Typography.Paragraph size="xs" color="muted" className="text-stone-500 font-medium">
            Showing <span className="font-semibold text-stone-900 font-sans tabular-nums">{startResult.toLocaleString()}</span> to{" "}
            <span className="font-semibold text-stone-900 font-sans tabular-nums">{endResult.toLocaleString()}</span> of{" "}
            <span className="font-semibold text-stone-900 font-sans tabular-nums">{totalCount.toLocaleString()}</span> Rows
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
