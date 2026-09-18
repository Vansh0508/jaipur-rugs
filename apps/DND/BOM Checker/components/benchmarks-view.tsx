"use client";

import React, { useState, useMemo, useEffect } from "react";
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
  BookOpen,
  ChevronRight,
  ChevronsUpDown,
  CornerDownRight,
  ChevronLeft,
  ArrowLeft,
  Layers,
  Filter,
} from "lucide-react";
import { DesignBenchmark } from "@/lib/supabase";

interface BenchmarksViewProps {
  benchmarks: DesignBenchmark[];
  onBackToDashboard?: () => void;
}

type BenchmarkRow = {
  id: string;
  prefix: string;
  quality: string;
  sampleCode: string;
  itemType?: string;
  yarnCount: number;
  status: string;
  isParent: boolean;
  yarnCode?: string;
  children: BenchmarkRow[];
};

export const BenchmarksView: React.FC<BenchmarksViewProps> = ({
  benchmarks,
  onBackToDashboard,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedQuality, setSelectedQuality] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [expandedKeys, setExpandedKeys] = useState<Selection>(() => new Set<string>());

  // Unique qualities for filter dropdown
  const availableQualities = useMemo(() => {
    const set = new Set<string>();
    for (const b of benchmarks) {
      if (b.quality && b.quality.trim()) {
        set.add(b.quality.trim());
      }
    }
    return Array.from(set).sort();
  }, [benchmarks]);

  // Reset page when search or quality filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedQuality]);

  // Client-side search and quality filtering
  const filtered = useMemo(() => {
    let result = benchmarks;

    if (selectedQuality) {
      result = result.filter(
        (b) => b.quality && b.quality.trim().toLowerCase() === selectedQuality.toLowerCase()
      );
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      result = result.filter(
        (b) =>
          b.design_prefix.toLowerCase().includes(q) ||
          (b.design_code && b.design_code.toLowerCase().includes(q)) ||
          (b.quality && b.quality.toLowerCase().includes(q)) ||
          (b.item_type && b.item_type.toLowerCase().includes(q)) ||
          (b.approved_yarn_codes &&
            b.approved_yarn_codes.some((y) => y.toLowerCase().includes(q)))
      );
    }

    return result;
  }, [benchmarks, searchTerm, selectedQuality]);

  // Total unique yarns count
  const totalApprovedYarnsCount = useMemo(() => {
    const yarnSet = new Set<string>();
    for (const b of benchmarks) {
      for (const y of b.approved_yarn_codes || []) {
        yarnSet.add(y);
      }
    }
    return yarnSet.size;
  }, [benchmarks]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginatedBenchmarks = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  // Hierarchical data tree for Hero UI Table with Expandable Rows
  const tableData: BenchmarkRow[] = useMemo(() => {
    return paginatedBenchmarks.map((b) => {
      const childYarns: BenchmarkRow[] = (b.approved_yarn_codes || []).map(
        (yarnCode, idx) => ({
          id: `${b.design_prefix}__yarn__${yarnCode}__${idx}`,
          prefix: `Yarn #${yarnCode}`,
          quality: b.quality || "Approved Construction Yarn",
          sampleCode: b.design_code || "—",
          itemType: "Yarn Component",
          yarnCount: 1,
          status: "Approved",
          isParent: false,
          yarnCode,
          children: [],
        })
      );

      return {
        id: b.design_prefix,
        prefix: b.design_prefix,
        quality: b.quality || "—",
        sampleCode: b.design_code || "—",
        itemType: b.item_type || "RUG",
        yarnCount: b.approved_yarn_codes?.length || 0,
        status: b.remark || "Done",
        isParent: true,
        children: childYarns,
      };
    });
  }, [paginatedBenchmarks]);

  // Toggle expand / collapse all for currently displayed page
  const handleToggleExpandAll = () => {
    const isAllExpanded =
      expandedKeys === "all" ||
      (expandedKeys instanceof Set &&
        tableData.length > 0 &&
        tableData.every((d) => expandedKeys.has(d.id)));

    if (isAllExpanded) {
      setExpandedKeys(new Set<string>());
    } else {
      setExpandedKeys(new Set<string>(tableData.map((d) => d.id)));
    }
  };

  const isAllCurrentlyExpanded =
    expandedKeys === "all" ||
    (expandedKeys instanceof Set &&
      tableData.length > 0 &&
      tableData.every((d) => expandedKeys.has(d.id)));

  // Render function for expandable row using Hero UI Table.Collection
  const renderExpandableRow = (item: BenchmarkRow) => {
    return (
      <Table.Row
        id={item.id}
        textValue={item.prefix}
        className={
          item.isParent
            ? "hover:bg-stone-50/80 border-b border-stone-200/80 transition-colors cursor-pointer select-none"
            : "bg-stone-50/40 hover:bg-stone-100/60 border-b border-stone-100 transition-colors select-none"
        }
      >
        {/* Tree Column: Design Prefix / Component with Chevron button */}
        <Table.Cell textValue={item.prefix} className="font-sans text-xs py-3 px-4 tabular-nums">
          {({ hasChildItems, isDisabled, isExpanded, isTreeColumn }) => (
            <span className="flex items-center gap-2">
              {hasChildItems && isTreeColumn ? (
                <Button
                  isIconOnly
                  aria-label="Toggle row"
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
                  <span className="font-bold text-stone-900 text-xs">
                    {item.prefix}
                  </span>
                  {item.itemType && (
                    <Chip variant="soft" size="sm" className="text-[10px] h-4 px-1.5 font-medium">
                      {item.itemType}
                    </Chip>
                  )}
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-stone-900 text-xs bg-white border border-stone-200 px-2 py-0.5 rounded-md shadow-2xs">
                    {item.prefix}
                  </span>
                  <span className="text-[11px] text-stone-500 font-sans">
                    Approved Component Yarn
                  </span>
                </div>
              )}
            </span>
          )}
        </Table.Cell>

        {/* Quality / Material */}
        <Table.Cell className="text-xs text-stone-700">
          {item.isParent ? (
            <span className="font-medium text-stone-800">{item.quality}</span>
          ) : (
            <span className="text-stone-400 text-[11px] italic">
              Specification for {item.quality}
            </span>
          )}
        </Table.Cell>

        {/* Sample Design Code */}
        <Table.Cell className="font-sans text-xs text-stone-700 tabular-nums">
          {item.isParent ? (
            item.sampleCode !== "—" ? (
              <span className="font-semibold text-stone-900">{item.sampleCode}</span>
            ) : (
              <span className="text-stone-400">—</span>
            )
          ) : (
            <span className="text-stone-400 text-[11px]">—</span>
          )}
        </Table.Cell>

        {/* Approved Yarns Count */}
        <Table.Cell className="text-xs">
          {item.isParent ? (
            <Chip
              variant="soft"
              size="sm"
              className="text-[11px] font-semibold"
            >
              {item.yarnCount} {item.yarnCount === 1 ? "Yarn Code" : "Yarn Codes"}
            </Chip>
          ) : (
            <Chip color="default" variant="soft" size="sm" className="text-[10px]">
              Active Code
            </Chip>
          )}
        </Table.Cell>

        {/* Status */}
        <Table.Cell className="text-xs">
          {item.isParent ? (
            <Chip color="success" variant="soft" size="sm" className="font-semibold text-[10px]">
              {item.status}
            </Chip>
          ) : (
            <Chip color="accent" variant="soft" size="sm" className="font-semibold text-[10px]">
              Approved
            </Chip>
          )}
        </Table.Cell>

        {/* Recursive Hero UI Collection for expandable child rows */}
        <Table.Collection items={item.children}>
          {renderExpandableRow}
        </Table.Collection>
      </Table.Row>
    );
  };

  const startResult = filtered.length > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const endResult = Math.min(currentPage * pageSize, filtered.length);

  return (
    <div className="space-y-4">
      {/* Full Page Header with Back Navigation & Benchmark Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-200/80 pb-4">
        <div className="space-y-1">
          {onBackToDashboard && (
            <button
              onClick={onBackToDashboard}
              className="flex items-center space-x-1.5 text-xs text-stone-600 hover:text-stone-900 font-semibold cursor-pointer mb-2 transition hover:-translate-x-0.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Dashboard</span>
            </button>
          )}
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-800 shadow-2xs">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <Typography.Heading level={2} className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">
                Design Benchmarks Master
              </Typography.Heading>
            </div>
          </div>
        </div>

        {/* Quick Stats Summary Badges */}
        <div className="flex items-center space-x-2 flex-wrap self-start sm:self-auto">
          <div className="flex items-center space-x-1.5 text-xs bg-stone-50 border border-stone-200/80 px-3 py-1.5 rounded-full">
            <span className="font-medium text-stone-500">Prefixes:</span>
            <span className="font-bold text-stone-900 font-sans tabular-nums">{benchmarks.length}</span>
          </div>
          <div className="flex items-center space-x-1.5 text-xs bg-stone-50 border border-stone-200/80 px-3 py-1.5 rounded-full">
            <span className="font-medium text-stone-500">Yarn Codes:</span>
            <span className="font-bold text-stone-900 font-sans tabular-nums">{totalApprovedYarnsCount}</span>
          </div>
        </div>
      </div>

      {/* Toolbar: Search, Quality Filter, and Expand/Collapse All */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 text-xs text-stone-600">
        <div className="flex items-center space-x-2 flex-wrap flex-1">
          {/* Pill Search */}
          <div className="relative min-w-[240px] flex-1 sm:flex-initial">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search prefix, quality, yarn code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-64 pl-8 pr-4 py-1.5 text-xs bg-stone-50/80 hover:bg-white focus:bg-white border border-stone-200/90 rounded-full focus:outline-hidden focus:border-stone-400 focus:ring-1 focus:ring-stone-200 transition placeholder:text-stone-400 font-medium"
            />
          </div>

          {/* Quality Filter Selector */}
          <div className="relative">
            <select
              value={selectedQuality}
              onChange={(e) => setSelectedQuality(e.target.value)}
              className="appearance-none text-xs h-8 pl-3 pr-7 rounded-full border border-stone-200/90 bg-stone-50/80 hover:bg-white focus:bg-white focus:outline-hidden focus:border-stone-400 font-medium text-stone-700 cursor-pointer transition shadow-2xs"
            >
              <option value="">All Qualities ({availableQualities.length})</option>
              {availableQualities.map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </select>
          </div>

          {/* Active filter count badge */}
          {(searchTerm || selectedQuality) && (
            <button
              onClick={() => {
                setSearchTerm("");
                setSelectedQuality("");
              }}
              className="text-[11px] text-stone-500 hover:text-stone-900 underline cursor-pointer"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Expand/Collapse All Action */}
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

      {/* Main Full-Page Table with Expandable Rows */}
      <div className="w-full rounded-2xl border border-stone-200/90 shadow-2xs bg-white overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-20 px-4">
            <div className="w-12 h-12 rounded-2xl bg-stone-100 flex items-center justify-center text-stone-400 mx-auto mb-3">
              <Search className="w-6 h-6" />
            </div>
            <Typography.Heading level={4} className="font-bold text-stone-800">
              No benchmarks match your search
            </Typography.Heading>
            <Typography.Paragraph size="xs" color="muted" className="text-stone-500 mt-1 max-w-md mx-auto">
              Try clearing your search keyword or selecting a different quality from the filter dropdown.
            </Typography.Paragraph>
          </div>
        ) : (
          <Table>
            <Table.ScrollContainer>
              <Table.Content
                aria-label="Design Code Benchmarks Table"
                className="min-w-[850px]"
                expandedKeys={expandedKeys}
                treeColumn="prefix"
                onExpandedChange={setExpandedKeys}
              >
                <Table.Header>
                  <Table.Column isRowHeader id="prefix" className="text-stone-700 font-bold">
                    Design Prefix / Component
                  </Table.Column>
                  <Table.Column id="quality" className="text-stone-700 font-bold">
                    Quality / Construction
                  </Table.Column>
                  <Table.Column id="sampleCode" className="text-stone-700 font-bold">
                    Sample Design Code
                  </Table.Column>
                  <Table.Column id="yarns" className="text-stone-700 font-bold">
                    Approved Yarns
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

        {/* Pagination Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between px-5 py-3.5 border-t border-stone-200 bg-white gap-3 select-none">
          {/* Left: Summary Count */}
          <Typography.Paragraph size="xs" color="muted" className="text-stone-500 font-medium">
            Showing <span className="font-semibold text-stone-900 font-sans tabular-nums">{startResult}</span> to{" "}
            <span className="font-semibold text-stone-900 font-sans tabular-nums">{endResult}</span> of{" "}
            <span className="font-semibold text-stone-900 font-sans tabular-nums">{filtered.length}</span> Design Prefixes
          </Typography.Paragraph>

          {/* Right: Pagination Controls */}
          <div className="flex items-center space-x-2.5 text-xs">
            {/* Rows selector */}
            <div className="flex items-center space-x-1.5 text-stone-500 pr-2 border-r border-stone-200">
              <span className="text-[11px] font-medium">Rows:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
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
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              isDisabled={currentPage === 1}
              className="h-7 px-2.5 rounded-lg border border-stone-200 bg-white text-stone-700 disabled:opacity-40 disabled:cursor-not-allowed font-semibold flex items-center space-x-1 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Prev</span>
            </Button>

            {/* Current Page Indicator */}
            <span className="text-xs font-semibold text-stone-700 px-1">
              Page {currentPage} of {totalPages}
            </span>

            {/* Next Page Button */}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              isDisabled={currentPage === totalPages}
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
