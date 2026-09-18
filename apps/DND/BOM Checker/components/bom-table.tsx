"use client";

import React, { useState, useMemo } from "react";
import { AuditedBomLine, AuditStatus } from "@/lib/audit-engine";
import { Table, TableLayout, Virtualizer, Chip, Button, Skeleton, Dropdown, Typography, Tooltip } from "@heroui/react";
import {
  Eye,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Layers,
  ChevronsUpDown,
  Search,
  FolderOpen,
  CornerDownRight,
  Copy,
  Check,
  Sparkles,
  AlertCircle,
  XCircle,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";

interface BomTableProps {
  lines: AuditedBomLine[];
  onInspectLine: (line: AuditedBomLine) => void;
  isLoading?: boolean;
  isSearching?: boolean;
  searchTerm?: string;
}

interface BomGroup {
  bomNo: string;
  firstItemNo: string;
  matchingCode: string;
  quality: string;
  design: string;
  itemCount: number;
  worstStatus: AuditStatus;
  errorText: string;
  remarks: string;
  creationDate?: string;
  grColorCode?: string;
  grColorName?: string;
  brColorCode?: string;
  brColorName?: string;
  lines: AuditedBomLine[];
}

type VirtualizedRow =
  | {
      type: "GROUP";
      id: string;
      group: BomGroup;
    }
  | {
      type: "ITEM";
      id: string;
      line: AuditedBomLine;
      parentBomNo: string;
      itemIndex: number;
    };

export const BomTable: React.FC<BomTableProps> = ({
  lines,
  onInspectLine,
  isLoading = false,
  isSearching = false,
  searchTerm = "",
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [expandedBoms, setExpandedBoms] = useState<Set<string>>(new Set());
  const [copiedBom, setCopiedBom] = useState<string | null>(null);

  // Group lines by BOM Number (Optimistic UI memoization)
  const groupedBoms: BomGroup[] = useMemo(() => {
    const map = new Map<string, AuditedBomLine[]>();
    for (const line of lines) {
      const key = line.bomNo || "UNKNOWN-BOM";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(line);
    }

    const groups: BomGroup[] = [];
    map.forEach((bomLines, bomNo) => {
      const first = bomLines[0];

      // Determine worst status in the group
      let worstStatus: AuditStatus = "VALID";
      let errorText = "None";
      let remarks = first.remarks;

      const hasInvalid = bomLines.some((l) => l.status === "INVALID_CODE");
      const hasBelowAvg = bomLines.some((l) => l.status === "BELOW_AVG_QUANTITY");
      const hasUnregistered = bomLines.some((l) => l.status === "UNREGISTERED_PREFIX");

      if (hasInvalid) {
        worstStatus = "INVALID_CODE";
        const invalidLine = bomLines.find((l) => l.status === "INVALID_CODE")!;
        errorText = invalidLine.error;
        remarks = invalidLine.remarks;
      } else if (hasBelowAvg) {
        worstStatus = "BELOW_AVG_QUANTITY";
        const belowLine = bomLines.find((l) => l.status === "BELOW_AVG_QUANTITY")!;
        errorText = belowLine.error;
        remarks = belowLine.remarks;
      } else if (hasUnregistered) {
        worstStatus = "UNREGISTERED_PREFIX";
        const unregLine = bomLines.find((l) => l.status === "UNREGISTERED_PREFIX")!;
        errorText = unregLine.error;
        remarks = unregLine.remarks;
      }

      groups.push({
        bomNo,
        firstItemNo: first.itemNo,
        matchingCode: first.matchingCode,
        quality: first.quality,
        design: first.design || first.designPrefix,
        itemCount: bomLines.length,
        worstStatus,
        errorText,
        remarks,
        creationDate: first.creationDate || first.lastDateModified,
        grColorCode: first.grColorCode,
        grColorName: first.grColorName,
        brColorCode: first.brColorCode,
        brColorName: first.brColorName,
        lines: bomLines,
      });
    });

    // Ensure groups are sorted by the latest creation date descending
    groups.sort((a, b) => {
      const timeA = a.creationDate ? new Date(a.creationDate).getTime() : 0;
      const timeB = b.creationDate ? new Date(b.creationDate).getTime() : 0;
      if (timeB !== timeA) return timeB - timeA;
      return b.bomNo.localeCompare(a.bomNo);
    });

    return groups;
  }, [lines]);

  // Reset to page 1 whenever total groups change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [groupedBoms.length]);

  const totalResults = groupedBoms.length;
  const totalPages = Math.max(1, Math.ceil(totalResults / pageSize));

  // Current page of BOM groups (Optimistic slicing)
  const paginatedGroups = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return groupedBoms.slice(start, start + pageSize);
  }, [groupedBoms, currentPage, pageSize]);

  const startResult = totalResults === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endResult = Math.min(currentPage * pageSize, totalResults);

  // Optimistic expand / collapse
  const toggleBomExpand = (bomNo: string) => {
    setExpandedBoms((prev) => {
      const next = new Set(prev);
      if (next.has(bomNo)) next.delete(bomNo);
      else next.add(bomNo);
      return next;
    });
  };

  const expandBom = (bomNo: string) => {
    setExpandedBoms((prev) => {
      if (prev.has(bomNo)) return prev;
      const next = new Set(prev);
      next.add(bomNo);
      return next;
    });
  };

  const toggleAllExpand = () => {
    if (expandedBoms.size === paginatedGroups.length) {
      setExpandedBoms(new Set());
    } else {
      setExpandedBoms(new Set(paginatedGroups.map((g) => g.bomNo)));
    }
  };

  const copyToClipboard = (text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedBom(text);
    setTimeout(() => setCopiedBom(null), 1500);
  };

  // Pagination items
  const paginationItems = useMemo(() => {
    const items: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) items.push(i);
    } else {
      if (currentPage <= 4) {
        items.push(1, 2, 3, 4, 5, "...", totalPages);
      } else if (currentPage >= totalPages - 3) {
        items.push(1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        items.push(1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages);
      }
    }
    return items;
  }, [totalPages, currentPage]);

  // Virtualized row list for Hero UI Virtualizer (Unconditionally called hook)
  const virtualizedRows: VirtualizedRow[] = useMemo(() => {
    const rows: VirtualizedRow[] = [];
    for (const group of paginatedGroups) {
      rows.push({
        type: "GROUP",
        id: `group-${group.bomNo}`,
        group,
      });

      if (expandedBoms.has(group.bomNo)) {
        group.lines.forEach((line, index) => {
          rows.push({
            type: "ITEM",
            id: `item-${line.id}`,
            line,
            parentBomNo: group.bomNo,
            itemIndex: index + 1,
          });
        });
      }
    }
    return rows;
  }, [paginatedGroups, expandedBoms]);

  const renderStatusChip = (status: AuditStatus, errorText: string, remarks?: string) => {
    let chipContent;
    switch (status) {
      case "INVALID_CODE":
        chipContent = (
          <Chip color="danger" variant="soft" size="sm" className="font-semibold flex items-center gap-1 cursor-help">
            <XCircle className="w-3 h-3 text-rose-600 inline mr-1" />
            <span>{errorText}</span>
          </Chip>
        );
        break;
      case "BELOW_AVG_QUANTITY":
        chipContent = (
          <Chip color="warning" variant="soft" size="sm" className="font-semibold flex items-center gap-1 cursor-help">
            <AlertTriangle className="w-3 h-3 text-amber-600 inline mr-1" />
            <span>{errorText}</span>
          </Chip>
        );
        break;
      case "UNREGISTERED_PREFIX":
        chipContent = (
          <Chip color="default" variant="soft" size="sm" className="font-semibold flex items-center gap-1 cursor-help">
            <AlertCircle className="w-3 h-3 text-stone-500 inline mr-1" />
            <span>{errorText}</span>
          </Chip>
        );
        break;
      case "VALID":
      default:
        chipContent = (
          <Chip color="success" variant="soft" size="sm" className="font-semibold flex items-center gap-1 cursor-help">
            <ShieldCheck className="w-3 h-3 text-emerald-600 inline mr-1" />
            <span>Passed</span>
          </Chip>
        );
        break;
    }

    if (remarks) {
      return (
        <Tooltip delay={100}>
          <Tooltip.Trigger>
            <div className="inline-flex cursor-help">{chipContent}</div>
          </Tooltip.Trigger>
          <Tooltip.Content
            showArrow
            className="max-w-xs text-xs px-3 py-2 rounded-xl bg-stone-900 text-white shadow-xl border border-stone-800 leading-relaxed font-normal z-50 animate-in fade-in zoom-in-95 duration-100"
          >
            <Tooltip.Arrow className="fill-stone-900" />
            <div className="space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                Audit Remarks
              </div>
              <p className="text-xs text-stone-100 leading-snug">{remarks}</p>
            </div>
          </Tooltip.Content>
        </Tooltip>
      );
    }

    return chipContent;
  };

  const renderColorCell = (
    code?: string,
    name?: string,
    type: "Ground Color (GR)" | "Border Color (BR)" = "Ground Color (GR)"
  ) => {
    if (!code || code === "—" || code.trim() === "") {
      return <span className="text-stone-400 font-normal">—</span>;
    }

    const trigger = (
      <div className="inline-flex items-center space-x-1.5 cursor-pointer group py-0.5 select-none">
        <span className="w-2.5 h-2.5 rounded-full bg-stone-300 border border-stone-400/80 inline-block shrink-0 group-hover:scale-110 group-hover:border-stone-600 transition-all shadow-2xs" />
        <span className="text-stone-700 font-normal group-hover:text-stone-950 transition-colors">
          {code}
        </span>
      </div>
    );

    return (
      <Tooltip delay={50}>
        <Tooltip.Trigger>
          {trigger}
        </Tooltip.Trigger>
        <Tooltip.Content
          showArrow
          className="max-w-xs text-xs px-3 py-2 rounded-xl bg-stone-900 text-white shadow-xl border border-stone-800 leading-snug z-50 animate-in fade-in zoom-in-95 duration-100"
        >
          <Tooltip.Arrow className="fill-stone-900" />
          <div className="space-y-1">
            <div className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">
              {type}
            </div>
            <div className="font-semibold text-stone-100 text-xs leading-tight">
              {name && name.trim() ? name : "Standard Tone"}
            </div>
            <div className="text-[10px] text-stone-400 pt-0.5 border-t border-stone-800 flex items-center justify-between gap-4">
              <span>Code</span>
              <span className="font-medium text-stone-200">{code}</span>
            </div>
          </div>
        </Tooltip.Content>
      </Tooltip>
    );
  };

  // Hero UI Skeleton Loaders for Table during Search Queries & Data Fetching
  if (isLoading || isSearching) {
    return (
      <div className="w-full flex-1 flex flex-col min-h-0 rounded-2xl border border-stone-200/90 shadow-2xs bg-white overflow-hidden">
        {/* Top Status Bar during Skeleton Loading */}
        <div className="shrink-0 px-5 py-3.5 bg-stone-50/80 border-b border-stone-200 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2.5">
            <Skeleton animationType="shimmer" className="h-4 w-4 rounded-md" />
            <Typography.Paragraph size="xs" className="font-semibold text-stone-700">
              {isSearching ? `Searching records for "${searchTerm}"...` : "Auditing BOM lines..."}
            </Typography.Paragraph>
            <Chip color="accent" variant="soft" size="sm" className="h-5 text-[10px] animate-pulse">
              Shimmer Active
            </Chip>
          </div>
          <div className="flex items-center space-x-2">
            <Skeleton animationType="shimmer" className="h-7 w-28 rounded-lg" />
          </div>
        </div>

        {/* Shimmering Hero UI Skeleton Table */}
        <div className="flex-1 min-h-0 overflow-auto">
          <Table className="h-full">
            <Table.ScrollContainer className="h-full">
              <Table.Content aria-label="Loading BOM Records" className="min-w-[1200px]">
                <Table.Header>
                  <Table.Column isRowHeader>BOM No</Table.Column>
                  <Table.Column>Item No.</Table.Column>
                  <Table.Column>Matching Code</Table.Column>
                  <Table.Column>Quality</Table.Column>
                  <Table.Column>Design</Table.Column>
                  <Table.Column>GR Color Code</Table.Column>
                  <Table.Column>BR Color Code</Table.Column>
                  <Table.Column>Size</Table.Column>
                  <Table.Column>Shape</Table.Column>
                  <Table.Column>Error</Table.Column>
                  <Table.Column>Action</Table.Column>
                </Table.Header>
                <Table.Body>
                  {Array.from({ length: 10 }).map((_, idx) => (
                    <Table.Row key={`skeleton-${idx}`} className="border-b border-stone-100">
                      <Table.Cell className="py-3.5 px-4">
                        <div className="flex items-center space-x-2">
                          <Skeleton animationType="shimmer" className="h-6 w-6 rounded-md shrink-0" />
                          <Skeleton animationType="shimmer" className="h-4 w-28 rounded-md" />
                          <Skeleton animationType="shimmer" className="h-4 w-12 rounded-full" />
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        <Skeleton animationType="shimmer" className="h-5 w-20 rounded-md" />
                      </Table.Cell>
                      <Table.Cell>
                        <Skeleton animationType="shimmer" className="h-5 w-16 rounded-full" />
                      </Table.Cell>
                      <Table.Cell>
                        <Skeleton animationType="shimmer" className="h-4 w-24 rounded-md" />
                      </Table.Cell>
                      <Table.Cell>
                        <Skeleton animationType="shimmer" className="h-4 w-20 rounded-md" />
                      </Table.Cell>
                      <Table.Cell>
                        <Skeleton animationType="shimmer" className="h-4 w-16 rounded-md" />
                      </Table.Cell>
                      <Table.Cell>
                        <Skeleton animationType="shimmer" className="h-4 w-16 rounded-md" />
                      </Table.Cell>
                      <Table.Cell>
                        <Skeleton animationType="shimmer" className="h-4 w-14 rounded-md" />
                      </Table.Cell>
                      <Table.Cell>
                        <Skeleton animationType="shimmer" className="h-5 w-14 rounded-full" />
                      </Table.Cell>
                      <Table.Cell>
                        <Skeleton animationType="shimmer" className="h-5 w-24 rounded-full" />
                      </Table.Cell>
                      <Table.Cell className="text-center">
                        <Skeleton animationType="shimmer" className="h-7 w-12 rounded-lg mx-auto" />
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        </div>

        {/* Footer Skeleton */}
        <div className="shrink-0 flex items-center justify-between px-5 py-3.5 border-t border-stone-200 bg-stone-50/50">
          <Skeleton animationType="shimmer" className="h-4 w-48 rounded-md" />
          <div className="flex items-center space-x-2">
            <Skeleton animationType="shimmer" className="h-7 w-14 rounded-md" />
            <Skeleton animationType="shimmer" className="h-7 w-28 rounded-md" />
            <Skeleton animationType="shimmer" className="h-7 w-14 rounded-md" />
          </div>
        </div>
      </div>
    );
  }

  // Empty State
  if (groupedBoms.length === 0) {
    return (
      <div className="w-full flex-1 flex flex-col min-h-0 items-center justify-center bg-white rounded-2xl border border-stone-200 p-12 text-center shadow-2xs">
        <div className="w-12 h-12 rounded-2xl bg-stone-100 flex items-center justify-center text-stone-400 mx-auto mb-3">
          <Search className="w-6 h-6" />
        </div>
        <Typography.Heading level={4} className="font-bold text-stone-800">
          No BOM records match your filters
        </Typography.Heading>
        <Typography.Paragraph size="xs" color="muted" className="text-stone-500 mt-1 max-w-md mx-auto">
          Try clearing your search keyword, selecting a different prefix filter, or adjusting the records query limit.
        </Typography.Paragraph>
      </div>
    );
  }

  return (
    <div className="w-full flex-1 flex flex-col min-h-0 rounded-2xl border border-stone-200/90 shadow-2xs bg-white overflow-hidden">
      {/* Revitalized Top Action Toolbar */}
      <div className="shrink-0 px-5 py-3 bg-stone-50/80 border-b border-stone-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs text-stone-600">
        <div className="flex items-center space-x-2.5 flex-wrap">
          <div className="flex items-center space-x-1.5 font-bold text-stone-900">
            <Layers className="w-4 h-4 text-stone-700" />
            <span>Production BOM Batches</span>
          </div>
          <span className="text-stone-300">&bull;</span>
          <Chip color="default" variant="soft" size="sm" className="font-semibold text-[11px] h-5">
            {totalResults.toLocaleString()} BOMs ({lines.length.toLocaleString()} Line Items)
          </Chip>
          {searchTerm && (
            <Chip color="accent" variant="soft" size="sm" className="h-5 text-[10px] font-medium">
              Filtered by: &ldquo;{searchTerm}&rdquo;
            </Chip>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={toggleAllExpand}
            className="text-xs font-semibold h-7 px-3 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 flex items-center space-x-1.5 cursor-pointer shadow-2xs"
          >
            <ChevronsUpDown className="w-3.5 h-3.5 text-stone-500" />
            <span>
              {expandedBoms.size === paginatedGroups.length ? "Collapse All" : "Expand All"}
            </span>
          </Button>
        </div>
      </div>

      {/* Main Revitalized Enterprise Grid with Hero UI Virtualization */}
      <div className="flex-1 min-h-0 relative overflow-hidden flex flex-col">
        <Virtualizer
          layout={TableLayout}
          layoutOptions={{
            headingHeight: 44,
            rowHeight: 52,
          }}
        >
          <Table className="h-full">
            <Table.ScrollContainer className="h-full">
              <Table.Content
                aria-label="Grouped BOM Details Grid"
                className="h-full min-w-[1250px] overflow-auto"
              >
                <Table.Header className="h-full w-full">
                  <Table.Column isRowHeader id="bomNo" minWidth={260} className="text-stone-600 font-semibold text-xs">
                    BOM No.
                  </Table.Column>
                  <Table.Column id="itemNo" minWidth={140} className="text-stone-600 font-semibold text-xs">
                    Item No.
                  </Table.Column>
                  <Table.Column id="matchingCode" minWidth={130} className="text-stone-600 font-semibold text-xs">
                    Matching Code
                  </Table.Column>
                  <Table.Column id="quality" minWidth={160} className="text-stone-600 font-semibold text-xs">
                    Quality
                  </Table.Column>
                  <Table.Column id="design" minWidth={120} className="text-stone-600 font-semibold text-xs">
                    Design
                  </Table.Column>
                  <Table.Column id="grColor" minWidth={130} className="text-stone-600 font-semibold text-xs">
                    GR Color Code
                  </Table.Column>
                  <Table.Column id="brColor" minWidth={130} className="text-stone-600 font-semibold text-xs">
                    BR Color Code
                  </Table.Column>
                  <Table.Column id="size" minWidth={100} className="text-stone-600 font-semibold text-xs">
                    Size
                  </Table.Column>
                  <Table.Column id="shape" minWidth={100} className="text-stone-600 font-semibold text-xs">
                    Shape
                  </Table.Column>
                  <Table.Column id="status" minWidth={170} className="text-stone-600 font-semibold text-xs">
                    Audit Status
                  </Table.Column>
                  <Table.Column id="action" minWidth={90} className="text-stone-600 font-semibold text-xs text-center">
                    Action
                  </Table.Column>
                </Table.Header>
                <Table.Body items={virtualizedRows}>
                  {(row) => {
                    if (row.type === "GROUP") {
                      const group = row.group;
                      const isExpanded = expandedBoms.has(group.bomNo);
                      const hasAnomaly = group.worstStatus !== "VALID";

                      return (
                        <Table.Row
                          key={`group-${group.bomNo}`}
                          className={`cursor-pointer transition-colors border-b border-stone-100/90 ${
                            isExpanded ? "bg-stone-50/70" : "hover:bg-stone-50/50"
                          } ${hasAnomaly ? "bg-rose-50/20" : ""}`}
                          onClick={() => toggleBomExpand(group.bomNo)}
                        >
                          {/* 1. BOM No & Expand Icon */}
                          <Table.Cell className="py-3 px-3">
                            <div className="flex items-center space-x-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleBomExpand(group.bomNo);
                                }}
                                className="w-5 h-5 rounded-md flex items-center justify-center text-stone-500 hover:bg-stone-200/70 transition shrink-0"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="w-3.5 h-3.5 text-stone-700" />
                                ) : (
                                  <ChevronRight className="w-3.5 h-3.5 text-stone-500" />
                                )}
                              </button>

                              <span className="font-semibold text-stone-900 text-xs">
                                {group.bomNo}
                              </span>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyToClipboard(group.bomNo, e);
                                }}
                                className="text-stone-400 hover:text-stone-700 p-0.5 rounded transition"
                                title="Copy BOM Number"
                              >
                                {copiedBom === group.bomNo ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </Table.Cell>

                          {/* 2. Item Count & Quick Selector Dropdown */}
                          <Table.Cell className="text-xs">
                            <Dropdown>
                              <Dropdown.Trigger
                                aria-label={`View ${group.lines.length} lines in BOM ${group.bomNo}`}
                                className="group inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-0.5 rounded-md bg-stone-100/90 hover:bg-stone-200/80 text-stone-600 hover:text-stone-900 border border-stone-200/60 font-sans text-[11px] font-normal transition-colors cursor-pointer select-none"
                              >
                                <span>
                                  {group.lines.length} {group.lines.length === 1 ? "line" : "lines"}
                                </span>
                                <ChevronDown className="w-3 h-3 text-stone-400 group-hover:text-stone-700 transition-colors shrink-0" />
                              </Dropdown.Trigger>
                              <Dropdown.Popover placement="bottom start" className="w-56 shadow-xl border border-stone-200/90 rounded-xl p-1 bg-white z-50">
                                <Dropdown.Menu
                                  aria-label={`Lines in BOM ${group.bomNo}`}
                                  className="max-h-60 overflow-y-auto space-y-0.5"
                                  onAction={(key) => {
                                    const selectedLine = group.lines.find((l) => l.id === key);
                                    if (selectedLine) onInspectLine(selectedLine);
                                  }}
                                >
                                    <Dropdown.Section aria-label={`BOM #${group.bomNo} Lines`}>
                                      {group.lines.map((line, idx) => (
                                        <Dropdown.Item
                                          key={line.id}
                                          id={line.id}
                                          textValue={`${line.itemNo} #${idx + 1}`}
                                        >
                                          <div className="flex items-center justify-between gap-3 text-xs w-full py-0.5">
                                            <span className="font-sans font-medium text-stone-900 tabular-nums">
                                              {line.itemNo}
                                            </span>
                                            <span className="text-[10px] text-stone-500 font-normal tabular-nums">
                                              #{idx + 1}
                                            </span>
                                            {line.status !== "VALID" ? (
                                              <Chip color="danger" variant="soft" size="sm" className="text-[9px] h-4 font-normal">
                                                {line.error}
                                              </Chip>
                                            ) : (
                                              <Chip color="success" variant="soft" size="sm" className="text-[9px] h-4 font-normal">
                                                Passed
                                              </Chip>
                                            )}
                                          </div>
                                        </Dropdown.Item>
                                      ))}
                                    </Dropdown.Section>
                                  </Dropdown.Menu>
                                </Dropdown.Popover>
                              </Dropdown>
                          </Table.Cell>

                          {/* 3. Matching Code */}
                          <Table.Cell className="font-sans text-xs text-stone-600 font-normal">
                            {group.matchingCode || "—"}
                          </Table.Cell>

                          {/* 4. Quality */}
                          <Table.Cell className="text-xs text-stone-600 font-normal">
                            {group.quality || "—"}
                          </Table.Cell>

                          {/* 5. Design */}
                          <Table.Cell className="font-sans text-xs text-stone-600 font-normal">
                            {group.design || "—"}
                          </Table.Cell>

                          {/* 6. GR Color Code */}
                          <Table.Cell className="font-sans text-xs text-stone-600 font-normal">
                            {group.grColorCode ? (
                              renderColorCell(group.grColorCode, group.grColorName, "Ground Color (GR)")
                            ) : (
                              <span className="text-xs text-stone-400 italic font-normal">
                                (See expanded lines)
                              </span>
                            )}
                          </Table.Cell>

                          {/* 7. BR Color Code */}
                          <Table.Cell className="font-sans text-xs text-stone-600 font-normal">
                            {group.brColorCode ? (
                              renderColorCell(group.brColorCode, group.brColorName, "Border Color (BR)")
                            ) : (
                              <span className="text-xs text-stone-400 italic font-normal">
                                (See expanded lines)
                              </span>
                            )}
                          </Table.Cell>

                          {/* 8. Size */}
                          <Table.Cell className="text-xs text-stone-600 font-normal">
                            {group.lines[0]?.size || "—"}
                          </Table.Cell>

                          {/* 9. Shape */}
                          <Table.Cell className="font-sans text-xs text-stone-600 font-normal">
                            {group.lines[0]?.shape || "—"}
                          </Table.Cell>

                          {/* 10. Audit Status with Remarks Tooltip (Important Field: Prominent) */}
                          <Table.Cell className="whitespace-nowrap">
                            {renderStatusChip(group.worstStatus, group.errorText, group.remarks)}
                          </Table.Cell>

                          {/* 11. Action */}
                          <Table.Cell className="text-center">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                // Open the items list in the table
                                expandBom(group.bomNo);
                                // Open the diagnosis box with the line
                                const targetLine =
                                  group.lines.find((l) => l.status !== "VALID") || group.lines[0];
                                if (targetLine) {
                                  onInspectLine(targetLine);
                                }
                              }}
                              className="text-xs font-semibold h-7 px-3 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-stone-800 cursor-pointer shadow-2xs hover:border-stone-300"
                            >
                              Inspect
                            </Button>
                          </Table.Cell>
                        </Table.Row>
                      );
                    }

                    // ITEM Row (BOM Line Items Revealed Upon Expansion)
                    const line = row.line;
                    const isLineAnomaly = line.status !== "VALID";

                    return (
                      <Table.Row
                        key={row.id}
                        id={row.id}
                        className={`transition border-b border-stone-200/60 ${
                          isLineAnomaly
                            ? line.status === "INVALID_CODE"
                              ? "bg-rose-50/45 hover:bg-rose-50/70"
                              : "bg-amber-50/35 hover:bg-amber-50/60"
                            : "bg-[#f5f6f8] hover:bg-[#eceef2]"
                        }`}
                      >
                        {/* 1. Indented Line Number with Tree Branch indicator */}
                        <Table.Cell className="font-sans text-xs text-stone-500 pl-7 py-2.5">
                          <div className="flex items-center space-x-2">
                            <CornerDownRight className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                            <span className="text-[11px] font-medium text-stone-700 bg-white border border-stone-200/80 px-2 py-0.5 rounded-md shadow-2xs font-sans tabular-nums">
                              #{row.itemIndex}
                            </span>
                          </div>
                        </Table.Cell>

                      {/* 2. Item No. (Important Identifier: Medium weight) */}
                      <Table.Cell className="font-sans font-medium text-xs text-stone-800 tabular-nums">
                        {line.itemNo || "—"}
                      </Table.Cell>

                      {/* 3. Matching Code */}
                      <Table.Cell className="font-sans text-xs text-stone-600 font-normal">
                        {line.matchingCode || "—"}
                      </Table.Cell>

                      {/* 4. Quality */}
                      <Table.Cell className="text-xs text-stone-600 font-normal">
                        {line.quality || "—"}
                      </Table.Cell>

                      {/* 5. Design */}
                      <Table.Cell className="font-sans text-xs text-stone-600 font-normal">
                        {line.design || line.designPrefix || "—"}
                      </Table.Cell>

                      {/* 6. GR Color Code */}
                      <Table.Cell className="font-sans text-xs text-stone-600 font-normal">
                        {renderColorCell(line.grColorCode, line.grColorName, "Ground Color (GR)")}
                      </Table.Cell>

                      {/* 7. BR Color Code */}
                      <Table.Cell className="font-sans text-xs text-stone-600 font-normal">
                        {renderColorCell(line.brColorCode, line.brColorName, "Border Color (BR)")}
                      </Table.Cell>

                      {/* 8. Size */}
                      <Table.Cell className="text-xs text-stone-600 font-normal">
                        {line.size || "—"}
                      </Table.Cell>

                      {/* 9. Shape */}
                      <Table.Cell className="font-sans text-xs text-stone-600 font-normal">
                        {line.shape || "—"}
                      </Table.Cell>

                      {/* 10. Line Error with Remarks Tooltip (Important Field: Prominent) */}
                      <Table.Cell className="whitespace-nowrap">
                        {renderStatusChip(line.status, line.error, line.remarks)}
                      </Table.Cell>

                      {/* 11. Action */}
                      <Table.Cell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          isIconOnly
                          aria-label="Inspect Line"
                          onClick={() => onInspectLine(line)}
                          className="hover:bg-stone-100 cursor-pointer rounded-lg text-stone-500 hover:text-stone-900"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </Table.Cell>
                    </Table.Row>
                  );
                }}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      </Virtualizer>
      </div>

      {/* Revitalized Pagination Bar with Hero UI Typography */}
      <div className="shrink-0 flex flex-col sm:flex-row items-center justify-between px-5 py-3.5 border-t border-stone-200 bg-white gap-3 select-none">
        {/* Left: Summary Count */}
        <Typography.Paragraph size="xs" color="muted" className="text-stone-500 font-medium">
          Showing <span className="font-semibold text-stone-900 font-sans tabular-nums">{startResult}</span> to{" "}
          <span className="font-semibold text-stone-900 font-sans tabular-nums">{endResult}</span> of{" "}
          <span className="font-semibold text-stone-900 font-sans tabular-nums">{totalResults.toLocaleString()}</span> BOMs (
          <span className="font-medium text-stone-700 font-sans tabular-nums">{lines.length.toLocaleString()}</span> lines)
        </Typography.Paragraph>

        {/* Right: Prev, Numbers, Next, Rows per page */}
        <div className="flex items-center space-x-3 text-xs">
          {/* Prev Button */}
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

          {/* Page Number Pills */}
          <div className="flex items-center space-x-1">
            {paginationItems.map((item, idx) => {
              if (item === "...") {
                return (
                  <span key={`ellipsis-${idx}`} className="px-1 text-stone-400 font-medium">
                    ..
                  </span>
                );
              }
              const pageNum = Number(item);
              const isActive = pageNum === currentPage;
              return (
                <button
                  key={`page-${pageNum}`}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`w-7 h-7 rounded-lg text-xs flex items-center justify-center font-bold transition cursor-pointer ${
                    isActive
                      ? "bg-stone-900 text-white shadow-2xs"
                      : "text-stone-700 hover:bg-stone-100"
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          {/* Next Button */}
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

          {/* Rows per page selector with Hero UI Dropdown */}
          <div className="flex items-center space-x-1.5 pl-2 border-l border-stone-200 text-stone-500">
            <span className="whitespace-nowrap text-[11px] font-medium">Rows:</span>
            <Dropdown>
              <Dropdown.Trigger
                aria-label="Select rows per page"
                className="bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-lg pl-2.5 pr-2 py-1 text-xs font-semibold text-stone-800 cursor-pointer shadow-2xs flex items-center space-x-1.5 transition select-none"
              >
                <span>{pageSize}</span>
                <ChevronDown className="w-3 h-3 text-stone-500" />
              </Dropdown.Trigger>
              <Dropdown.Popover placement="top end" className="min-w-20 shadow-xl border border-stone-200/90 rounded-xl p-1 bg-white z-50">
                <Dropdown.Menu
                  aria-label="Rows per page"
                  selectedKeys={new Set([String(pageSize)])}
                  selectionMode="single"
                  onAction={(key) => {
                    setPageSize(Number(key));
                    setCurrentPage(1);
                  }}
                  className="space-y-0.5"
                >
                  {[20, 50, 100].map((size) => (
                    <Dropdown.Item
                      key={size}
                      id={String(size)}
                      textValue={`${size} rows`}
                      className={`px-2.5 py-1.5 text-xs rounded-lg cursor-pointer transition flex items-center justify-between font-sans ${
                        pageSize === size
                          ? "bg-stone-900 text-white font-bold"
                          : "text-stone-700 hover:bg-stone-100 font-medium"
                      }`}
                    >
                      <span>{size}</span>
                      {pageSize === size && <Check className="w-3 h-3 text-white ml-2 shrink-0" />}
                    </Dropdown.Item>
                  ))}
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown>
          </div>
        </div>
      </div>
    </div>
  );
};
