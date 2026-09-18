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
  Sparkles,
  Tag,
  Filter,
  Check,
  Copy,
} from "lucide-react";
import {
  DesignSeriesRecord,
  YarnLookupEntry,
  matchesMaterialOrYarnQuery,
  getNextNumberForPrefix,
} from "@/lib/design-series";
import { NextNumberModal } from "./NextNumberModal";

interface DesignSeriesViewProps {
  initialSeries: DesignSeriesRecord[];
  yarnLookup: YarnLookupEntry[];
  constructions: string[];
  qualitiesByConstruction: Record<string, string[]>;
  onBackToDashboard?: () => void;
}

type SeriesRowItem = {
  id: string;
  prefix: string;
  quality: string;
  construction: string;
  sampleCode: string;
  itemType: string;
  yarnCount: number;
  isParent: boolean;
  yarnCode?: string;
  materialName?: string;
  description?: string;
  tani?: string;
  theda?: string;
  lacchi?: string;
  record?: DesignSeriesRecord;
  children: SeriesRowItem[];
};

export const DesignSeriesView: React.FC<DesignSeriesViewProps> = ({
  initialSeries,
  yarnLookup,
  constructions,
  qualitiesByConstruction,
  onBackToDashboard,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedConstruction, setSelectedConstruction] = useState("");
  const [selectedQuality, setSelectedQuality] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [expandedKeys, setExpandedKeys] = useState<Selection>(() => new Set<string>());

  // Modal State
  const [modalData, setModalData] = useState<{
    isOpen: boolean;
    prefix: string;
    quality: string;
    construction: string;
    sampleCode: string;
    highestKnownSuffix?: string | null;
    suggestedCode: string;
    note: string;
  }>({
    isOpen: false,
    prefix: "",
    quality: "",
    construction: "",
    sampleCode: "",
    suggestedCode: "",
    note: "",
  });

  // Yarn Lookup Map for fast O(1) material & description lookups
  const yarnMap = useMemo(() => {
    const map = new Map<string, YarnLookupEntry>();
    for (const y of yarnLookup) {
      map.set(y.code, y);
    }
    return map;
  }, [yarnLookup]);

  // Dynamically scoped qualities based on selected construction
  const availableQualities = useMemo(() => {
    if (selectedConstruction && qualitiesByConstruction[selectedConstruction]) {
      return qualitiesByConstruction[selectedConstruction];
    }
    const allQ = new Set<string>();
    for (const s of initialSeries) {
      if (s.quality) allQ.add(s.quality.trim());
    }
    return Array.from(allQ).sort();
  }, [initialSeries, selectedConstruction, qualitiesByConstruction]);

  // Reset quality when construction changes if current quality isn't in new construction
  const handleConstructionChange = (val: string) => {
    setSelectedConstruction(val);
    setSelectedQuality("");
    setCurrentPage(1);
  };

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedConstruction, selectedQuality]);

  // Filtered series records
  const filtered = useMemo(() => {
    let result = initialSeries;

    if (selectedConstruction) {
      result = result.filter(
        (s) => s.construction.toLowerCase() === selectedConstruction.toLowerCase()
      );
    }

    if (selectedQuality) {
      result = result.filter(
        (s) => s.quality.toLowerCase() === selectedQuality.toLowerCase()
      );
    }

    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      // Supports slash token search or text search across prefix, design_code, etc.
      result = result.filter((s) => {
        // Direct matches on prefix or design_code
        if (
          s.prefix.toLowerCase().includes(q) ||
          s.design_code.toLowerCase().includes(q) ||
          s.quality.toLowerCase().includes(q) ||
          s.construction.toLowerCase().includes(q)
        ) {
          return true;
        }
        // Multi-token material / yarn code set matching
        return matchesMaterialOrYarnQuery(s, searchTerm.trim(), yarnLookup);
      });
    }

    return result;
  }, [initialSeries, selectedConstruction, selectedQuality, searchTerm, yarnLookup]);

  // Stats
  const totalUniqueYarnsCount = useMemo(() => {
    const set = new Set<string>();
    for (const s of initialSeries) {
      for (const y of s.yarns) {
        set.add(y);
      }
    }
    return set.size;
  }, [initialSeries]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginatedSeries = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  // Hierarchical table data tree for Hero UI Table
  const tableData: SeriesRowItem[] = useMemo(() => {
    return paginatedSeries.map((s) => {
      const childRows: SeriesRowItem[] = s.yarns.map((yarnCode, idx) => {
        const entry = yarnMap.get(yarnCode);
        return {
          id: `${s.prefix}__yarn__${yarnCode}__${idx}`,
          prefix: `Yarn #${yarnCode}`,
          quality: entry?.material || s.quality || "—",
          construction: s.construction,
          sampleCode: s.design_code,
          itemType: "Yarn Spec",
          yarnCount: 1,
          isParent: false,
          yarnCode,
          materialName: entry?.material || "Standard Pile Yarn",
          description: entry?.description || "NAV Master Spec",
          tani: s.tani,
          theda: s.theda,
          lacchi: s.lacchi,
          record: s,
          children: [],
        };
      });

      return {
        id: s.prefix,
        prefix: s.prefix,
        quality: s.quality || "—",
        construction: s.construction,
        sampleCode: s.design_code || "—",
        itemType: s.item_type || "RUG",
        yarnCount: s.yarns.length,
        isParent: true,
        tani: s.tani,
        theda: s.theda,
        lacchi: s.lacchi,
        record: s,
        children: childRows,
      };
    });
  }, [paginatedSeries, yarnMap]);

  // Expand / Collapse All toggle
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

  // Open Next Number Modal
  const handleOpenNextNumber = (rec: DesignSeriesRecord) => {
    const result = getNextNumberForPrefix(rec.prefix, initialSeries);
    setModalData({
      isOpen: true,
      prefix: rec.prefix,
      quality: rec.quality,
      construction: rec.construction,
      sampleCode: rec.design_code,
      highestKnownSuffix: result.highestKnownSuffix || rec.suffix,
      suggestedCode: result.suggestedCode,
      note: result.note,
    });
  };

  // Render function for Hero UI Table.Row
  const renderExpandableRow = (item: SeriesRowItem) => {
    return (
      <Table.Row
        id={item.id}
        textValue={item.prefix}
        className={
          item.isParent
            ? "hover:bg-neutral-100/70 dark:hover:bg-neutral-800/60 border-b border-border/80 transition-colors select-none group"
            : "bg-neutral-50/50 dark:bg-neutral-900/30 hover:bg-neutral-100/50 dark:hover:bg-neutral-800/40 border-b border-border/40 transition-colors select-none"
        }
      >
        {/* Tree Column: Prefix / Component */}
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
                  className="w-6 h-6 p-0 text-muted hover:text-foreground cursor-pointer rounded-md shrink-0"
                >
                  <ChevronRight
                    aria-hidden
                    className={cn(
                      "w-3.5 h-3.5 text-muted transition-transform duration-150",
                      isExpanded ? "rotate-90" : "rtl:rotate-180"
                    )}
                  />
                </Button>
              ) : !item.isParent ? (
                <span className="w-6 flex items-center justify-center text-muted shrink-0">
                  <CornerDownRight className="w-3.5 h-3.5 text-muted/70" />
                </span>
              ) : (
                <span className="w-6 shrink-0" />
              )}

              {item.isParent ? (
                <div className="flex items-center space-x-2">
                  <span className="font-mono font-bold text-foreground text-xs">
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
                  <span className="font-mono font-bold text-foreground text-xs bg-surface border border-border px-2 py-0.5 rounded-md shadow-2xs">
                    {item.yarnCode}
                  </span>
                  <span className="text-[11px] font-medium text-foreground">
                    {item.materialName}
                  </span>
                </div>
              )}
            </span>
          )}
        </Table.Cell>

        {/* Construction & Quality */}
        <Table.Cell className="text-xs">
          {item.isParent ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-border/80">
                {item.construction}
              </span>
              <span className="font-medium text-foreground">{item.quality}</span>
            </div>
          ) : (
            <span className="text-muted text-[11px]">
              {item.description || "Active Component Yarn"}
            </span>
          )}
        </Table.Cell>

        {/* Reference Design Code */}
        <Table.Cell className="font-mono text-xs tabular-nums">
          {item.isParent ? (
            <span className="font-semibold text-foreground">{item.sampleCode}</span>
          ) : (
            <span className="text-muted text-[11px]">
              {item.tani || item.theda
                ? `Tani: ${item.tani || "-"} • Theda: ${item.theda || "-"}`
                : "—"}
            </span>
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
            <span className="text-muted text-[11px]">
              {item.lacchi ? `Lacchi: ${item.lacchi}` : "Verified Spec"}
            </span>
          )}
        </Table.Cell>

        {/* Action: Next Number Button */}
        <Table.Cell className="text-xs">
          {item.isParent && item.record ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={(e) => {
                e.stopPropagation();
                if (item.record) handleOpenNextNumber(item.record);
              }}
              className="h-7 px-2.5 rounded-lg border border-border bg-surface hover:bg-neutral-100 dark:hover:bg-neutral-800 text-foreground font-semibold flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Next Number</span>
            </Button>
          ) : (
            <span className="text-muted text-[10px]">Component</span>
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
      {/* 1. Header with Stats Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/80 pb-4">
        <div className="space-y-1">
          {onBackToDashboard && (
            <button
              onClick={onBackToDashboard}
              className="flex items-center space-x-1.5 text-xs text-muted hover:text-foreground font-semibold cursor-pointer mb-2 transition hover:-translate-x-0.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Dashboard</span>
            </button>
          )}
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-surface border border-border flex items-center justify-center text-foreground shadow-2xs">
              <Tag className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <Typography.Heading level={2} className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
                Design Name Series & Code Generator
              </Typography.Heading>
            </div>
          </div>
        </div>

        {/* Quick Stats Summary Badges */}
        <div className="flex items-center space-x-2 flex-wrap self-start sm:self-auto text-xs">
          <div className="flex items-center space-x-1.5 bg-surface border border-border px-3 py-1.5 rounded-full shadow-2xs">
            <span className="font-medium text-muted">Prefixes:</span>
            <span className="font-bold text-foreground font-mono tabular-nums">{initialSeries.length}</span>
          </div>
          <div className="flex items-center space-x-1.5 bg-surface border border-border px-3 py-1.5 rounded-full shadow-2xs">
            <span className="font-medium text-muted">Constructions:</span>
            <span className="font-bold text-foreground font-mono tabular-nums">{constructions.length}</span>
          </div>
          <div className="flex items-center space-x-1.5 bg-surface border border-border px-3 py-1.5 rounded-full shadow-2xs">
            <span className="font-medium text-muted">Unique Yarns:</span>
            <span className="font-bold text-foreground font-mono tabular-nums">{totalUniqueYarnsCount}</span>
          </div>
        </div>
      </div>

      {/* 2. Step-by-Step Discovery Toolbar (Construction -> Quality -> Material/Yarn Search) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 text-xs">
        <div className="flex items-center space-x-2 flex-wrap flex-1">
          {/* Construction Selector */}
          <div className="relative">
            <select
              value={selectedConstruction}
              onChange={(e) => handleConstructionChange(e.target.value)}
              className="appearance-none text-xs h-8 pl-3 pr-7 rounded-full border border-border bg-surface hover:bg-surface-secondary focus:outline-hidden focus:border-accent font-medium text-foreground cursor-pointer transition shadow-2xs"
            >
              <option value="">All Constructions ({constructions.length})</option>
              {constructions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Quality Selector (scoped to Construction) */}
          <div className="relative">
            <select
              value={selectedQuality}
              onChange={(e) => {
                setSelectedQuality(e.target.value);
                setCurrentPage(1);
              }}
              className="appearance-none text-xs h-8 pl-3 pr-7 rounded-full border border-border bg-surface hover:bg-surface-secondary focus:outline-hidden focus:border-accent font-medium text-foreground cursor-pointer transition shadow-2xs"
            >
              <option value="">All Qualities ({availableQualities.length})</option>
              {availableQualities.map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </select>
          </div>

          {/* Pill Search Input */}
          <div className="relative min-w-[220px] flex-1 sm:flex-initial">
            <Search className="w-3.5 h-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search prefix, yarn/material (e.g. wool/11)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-72 pl-8 pr-4 py-1.5 text-xs bg-surface border border-border rounded-full focus:outline-hidden focus:border-accent font-medium text-foreground transition placeholder:text-muted shadow-2xs"
            />
          </div>

          {/* Clear filters badge */}
          {(searchTerm || selectedConstruction || selectedQuality) && (
            <button
              onClick={() => {
                setSearchTerm("");
                setSelectedConstruction("");
                setSelectedQuality("");
              }}
              className="text-[11px] text-muted hover:text-foreground underline cursor-pointer"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Expand / Collapse All Toggle */}
        <div className="flex items-center space-x-2 self-end sm:self-auto">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleToggleExpandAll}
            className="text-xs font-semibold h-8 px-3.5 rounded-full border border-border bg-surface hover:bg-surface-secondary text-foreground flex items-center space-x-1.5 cursor-pointer shadow-2xs"
          >
            <ChevronsUpDown className="w-3.5 h-3.5 text-muted" />
            <span>{isAllCurrentlyExpanded ? "Collapse All" : "Expand All"}</span>
          </Button>
        </div>
      </div>

      {/* 3. Main Hero UI Table with Expandable Tree Rows */}
      <div className="w-full rounded-2xl border border-border shadow-2xs bg-surface overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-20 px-4">
            <div className="w-12 h-12 rounded-2xl bg-surface-secondary flex items-center justify-center text-muted mx-auto mb-3">
              <Search className="w-6 h-6" />
            </div>
            <Typography.Heading level={4} className="font-bold text-foreground">
              No design series match your filter
            </Typography.Heading>
            <Typography.Paragraph size="xs" color="muted" className="text-muted mt-1 max-w-md mx-auto">
              Try adjusting your construction, quality, or material/yarn query (e.g. searching <code className="font-mono text-foreground font-semibold">wool</code> or <code className="font-mono text-foreground font-semibold">11</code>).
            </Typography.Paragraph>
          </div>
        ) : (
          <Table>
            <Table.ScrollContainer>
              <Table.Content
                aria-label="Design Series Master Table"
                className="min-w-[850px]"
                expandedKeys={expandedKeys}
                treeColumn="prefix"
                onExpandedChange={setExpandedKeys}
              >
                <Table.Header>
                  <Table.Column isRowHeader id="prefix" className="text-foreground font-bold">
                    Design Prefix / Component
                  </Table.Column>
                  <Table.Column id="construction" className="text-foreground font-bold">
                    Construction & Quality
                  </Table.Column>
                  <Table.Column id="sampleCode" className="text-foreground font-bold">
                    Sample Design Code
                  </Table.Column>
                  <Table.Column id="yarns" className="text-foreground font-bold">
                    Approved Yarns
                  </Table.Column>
                  <Table.Column id="actions" className="text-foreground font-bold">
                    Action
                  </Table.Column>
                </Table.Header>
                <Table.Body items={tableData}>
                  {renderExpandableRow}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        )}

        {/* 4. Bottom Pagination Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between px-5 py-3.5 border-t border-border bg-surface gap-3 select-none">
          {/* Summary Count */}
          <Typography.Paragraph size="xs" color="muted" className="text-muted font-medium">
            Showing <span className="font-semibold text-foreground font-mono tabular-nums">{startResult}</span> to{" "}
            <span className="font-semibold text-foreground font-mono tabular-nums">{endResult}</span> of{" "}
            <span className="font-semibold text-foreground font-mono tabular-nums">{filtered.length}</span> Design Series
          </Typography.Paragraph>

          {/* Controls */}
          <div className="flex items-center space-x-2.5 text-xs">
            <div className="flex items-center space-x-1.5 text-muted pr-2 border-r border-border">
              <span className="text-[11px] font-medium">Rows:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="appearance-none bg-surface border border-border rounded-lg px-2 py-0.5 text-xs font-semibold text-foreground focus:outline-hidden focus:border-accent cursor-pointer shadow-2xs"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              isDisabled={currentPage === 1}
              className="h-7 px-2.5 rounded-lg border border-border bg-surface text-foreground disabled:opacity-40 disabled:cursor-not-allowed font-semibold flex items-center space-x-1 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Prev</span>
            </Button>

            <span className="text-xs font-semibold text-foreground px-1">
              Page {currentPage} of {totalPages}
            </span>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              isDisabled={currentPage === totalPages}
              className="h-7 px-2.5 rounded-lg border border-border bg-surface text-foreground disabled:opacity-40 disabled:cursor-not-allowed font-semibold flex items-center space-x-1 cursor-pointer"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* 5. Next Number Generator Modal */}
      <NextNumberModal
        isOpen={modalData.isOpen}
        onClose={() => setModalData((prev) => ({ ...prev, isOpen: false }))}
        prefix={modalData.prefix}
        quality={modalData.quality}
        construction={modalData.construction}
        sampleCode={modalData.sampleCode}
        highestKnownSuffix={modalData.highestKnownSuffix}
        suggestedCode={modalData.suggestedCode}
        note={modalData.note}
      />
    </div>
  );
};
