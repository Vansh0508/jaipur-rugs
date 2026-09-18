"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  Download,
  RefreshCw,
  BookOpen,
  X,
} from "lucide-react";
import { AuditSummary } from "@/lib/audit-engine";
import { Dropdown, Button, Chip, Typography, Tabs, ScrollShadow } from "@heroui/react";

interface AuditDashboardProps {
  summary: AuditSummary;
  activeStatusFilter: string;
  onStatusFilterChange: (status: string) => void;
  searchTerm: string;
  onSearchChange: (search: string) => void;
  isSearching?: boolean;
  selectedPrefix: string;
  onPrefixChange: (prefix: string) => void;
  availablePrefixes: string[];
  fetchLimit: number;
  onFetchLimitChange: (limit: number) => void;
  onExport?: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onOpenBenchmarks?: () => void;
  benchmarkCount?: number;
}

export const AuditDashboard: React.FC<AuditDashboardProps> = ({
  summary,
  activeStatusFilter,
  onStatusFilterChange,
  searchTerm,
  onSearchChange,
  isSearching = false,
  selectedPrefix,
  onPrefixChange,
  availablePrefixes,
  fetchLimit,
  onFetchLimitChange,
  onExport,
  onRefresh,
  isRefreshing = false,
  onOpenBenchmarks,
  benchmarkCount = 0,
}) => {
  const discrepancyTotal =
    summary.invalidCodeCount + summary.belowAvgQtyCount + summary.unregisteredPrefixCount;

  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [activeSubmenu, setActiveSubmenu] = useState<"prefix" | "limit" | null>(null);
  const [prefixSearch, setPrefixSearch] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  // Close filter menu when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setFilterMenuOpen(false);
        setActiveSubmenu(null);
      }
    };
    if (filterMenuOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [filterMenuOpen]);

  const tabs = [
    {
      key: "ALL",
      label: "All",
    },
  ];

  return (
    <div className="space-y-4">
      {/* 
        Reference UI Header:
        - Clean Title at top left
        - Tab strip with underline indicator on left
        - Search pill + Action button on right
      */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <Typography.Heading level={2} className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">
            BOM Quality Audit
          </Typography.Heading>
        </div>
      </div>

      {/* Horizontal Controls Row (Without bottom divider) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Left: Hero UI Tabs component with variant="secondary" */}
        <Tabs
          selectedKey={activeStatusFilter}
          onSelectionChange={(key) => onStatusFilterChange(String(key))}
          variant="secondary"
          className="max-w-xl"
        >
          <Tabs.List aria-label="BOM Audit Status Tabs">
            {tabs.map((tab) => (
              <Tabs.Tab
                key={tab.key}
                id={tab.key}
                className="cursor-pointer text-xs font-semibold py-1.5 px-3"
              >
                <div className="flex items-center space-x-1.5">
                  <span>{tab.label}</span>
                </div>
                <Tabs.Indicator />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs>

        {/* Right: Merged Unified Control (Search Bar + Single Chevron with Cascading Submenus) + Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 self-stretch lg:self-auto">
          {/* Unified Pill Control with single chevron button */}
          <div className="relative" ref={menuRef}>
            <div className="flex items-center bg-stone-50/90 hover:bg-white focus-within:bg-white border border-stone-200/90 rounded-full shadow-2xs focus-within:ring-1 focus-within:ring-stone-200 focus-within:border-stone-400 transition h-8 min-w-[260px] sm:min-w-[320px]">
              {/* Search Input ("Merge pull request" becomes the search bar) */}
              <div className="relative flex-1 flex items-center pl-3 pr-2">
                <Search className="w-3.5 h-3.5 text-stone-400 shrink-0 pointer-events-none mr-2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Search BOMs, items..."
                  className="w-full text-xs bg-transparent border-none outline-none focus:outline-none placeholder:text-stone-400 font-normal text-stone-900"
                />
              </div>

              {/* Separator before Sync */}
              {onRefresh && <div className="h-4 w-px bg-stone-200 shrink-0" />}

              {/* Sync Button (Divider separated from the search bar) */}
              {onRefresh && (
                <button
                  type="button"
                  onClick={onRefresh}
                  disabled={isRefreshing}
                  title="Sync ERP data"
                  className="h-full px-2.5 flex items-center justify-center text-stone-500 hover:text-stone-900 hover:bg-stone-100/70 transition cursor-pointer disabled:opacity-40"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${
                      isRefreshing ? "animate-spin text-stone-900" : "text-stone-500 hover:text-stone-900"
                    }`}
                  />
                </button>
              )}

              {/* Separator before Down Arrow */}
              <div className="h-4 w-px bg-stone-200 shrink-0" />

              {/* Down Arrow Button (Comes after Sync Button) */}
              <button
                type="button"
                onClick={() => {
                  setFilterMenuOpen(!filterMenuOpen);
                  setActiveSubmenu(null);
                }}
                title="Filter & Export Options"
                className={`h-full px-2.5 rounded-r-full flex items-center justify-center text-stone-500 hover:text-stone-900 hover:bg-stone-100/70 transition cursor-pointer ${
                  filterMenuOpen ? "bg-stone-100/90 text-stone-900" : ""
                }`}
              >
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-150 ${
                    filterMenuOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
            </div>

            {/* Dropdown Menu (Opened by the chevron button) */}
            {filterMenuOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-52 bg-white border border-stone-200/90 rounded-2xl shadow-[0_12px_32px_rgba(0,0,0,0.12)] p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                {/* Item 1: Design Prefix */}
                <div
                  className="relative"
                  onMouseEnter={() => setActiveSubmenu("prefix")}
                >
                  <button
                    type="button"
                    onClick={() => setActiveSubmenu(activeSubmenu === "prefix" ? null : "prefix")}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${
                      activeSubmenu === "prefix"
                        ? "bg-stone-100 text-stone-900"
                        : "text-stone-700 hover:bg-stone-50 hover:text-stone-900"
                    }`}
                  >
                    <div className="flex items-center space-x-2 truncate">
                      <span className="font-semibold">Prefix:</span>
                      <span className="text-[11px] text-stone-500 font-medium truncate max-w-[90px]">
                        {selectedPrefix || "All"}
                      </span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                  </button>

                  {/* Submenu for Design Prefix (Flyout to the side) */}
                  {activeSubmenu === "prefix" && (
                    <div className="absolute right-full top-0 mr-1.5 w-56 bg-white border border-stone-200/90 rounded-2xl shadow-[0_12px_32px_rgba(0,0,0,0.12)] p-2 z-50 animate-in fade-in zoom-in-95 duration-100 before:content-[''] before:absolute before:-right-3 before:top-0 before:w-3.5 before:h-full">
                      {/* Search Prefix Input */}
                      <div className="relative mb-2">
                        <Search className="w-3 h-3 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={prefixSearch}
                          onChange={(e) => setPrefixSearch(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              const matches = availablePrefixes.filter((pfx) =>
                                pfx.toLowerCase().includes(prefixSearch.toLowerCase().trim())
                              );
                              if (matches.length > 0) {
                                onPrefixChange(matches[0]);
                                setFilterMenuOpen(false);
                                setActiveSubmenu(null);
                                setPrefixSearch("");
                              }
                            } else if (e.key === "Escape") {
                              setPrefixSearch("");
                            }
                          }}
                          placeholder="Search prefix..."
                          autoFocus
                          className="w-full text-[11px] pl-7 pr-7 py-1 bg-stone-50 hover:bg-stone-100/80 focus:bg-white border border-stone-200/90 rounded-lg focus:outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-200 transition font-medium placeholder:text-stone-400 text-stone-900"
                        />
                        {prefixSearch && (
                          <button
                            type="button"
                            onClick={() => setPrefixSearch("")}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 p-0.5"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      <ScrollShadow hideScrollBar size={30} className="max-h-60 space-y-0.5">
                        {(!prefixSearch || "all prefixes".includes(prefixSearch.toLowerCase().trim())) && (
                          <button
                            type="button"
                            onClick={() => {
                              onPrefixChange("");
                              setFilterMenuOpen(false);
                              setActiveSubmenu(null);
                              setPrefixSearch("");
                            }}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer font-sans ${
                              !selectedPrefix
                                ? "bg-stone-900 text-white font-bold"
                                : "text-stone-700 hover:bg-stone-100"
                            }`}
                          >
                            <span>All Prefixes</span>
                            <span className={`text-[10px] ${!selectedPrefix ? "text-stone-300" : "text-stone-400"}`}>
                              ({availablePrefixes.length})
                            </span>
                          </button>
                        )}
                        {availablePrefixes
                          .filter((pfx) => pfx.toLowerCase().includes(prefixSearch.toLowerCase().trim()))
                          .map((pfx) => (
                            <button
                              key={pfx}
                              type="button"
                              onClick={() => {
                                onPrefixChange(pfx);
                                setFilterMenuOpen(false);
                                setActiveSubmenu(null);
                                setPrefixSearch("");
                              }}
                              className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer font-sans ${
                                selectedPrefix === pfx
                                  ? "bg-stone-900 text-white font-bold"
                                  : "text-stone-700 hover:bg-stone-100"
                              }`}
                            >
                              {pfx}
                            </button>
                          ))}
                        {availablePrefixes.filter((pfx) =>
                          pfx.toLowerCase().includes(prefixSearch.toLowerCase().trim())
                        ).length === 0 &&
                          prefixSearch && (
                            <div className="px-2 py-3 text-center text-xs text-stone-400 font-sans">
                              No prefixes match &ldquo;{prefixSearch}&rdquo;
                            </div>
                          )}
                      </ScrollShadow>
                    </div>
                  )}
                </div>

                {/* Item 2: Rows Limit */}
                <div
                  className="relative mt-0.5"
                  onMouseEnter={() => setActiveSubmenu("limit")}
                >
                  <button
                    type="button"
                    onClick={() => setActiveSubmenu(activeSubmenu === "limit" ? null : "limit")}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${
                      activeSubmenu === "limit"
                        ? "bg-stone-100 text-stone-900"
                        : "text-stone-700 hover:bg-stone-50 hover:text-stone-900"
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold">Rows:</span>
                      <span className="text-[11px] text-stone-500 font-medium">
                        {fetchLimit.toLocaleString()}
                      </span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                  </button>

                  {/* Submenu for Rows Limit (Flyout to the side) */}
                  {activeSubmenu === "limit" && (
                    <div className="absolute right-full top-0 mr-1.5 w-44 bg-white border border-stone-200/90 rounded-2xl shadow-[0_12px_32px_rgba(0,0,0,0.12)] p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                      <div className="px-2 py-1 text-[10px] uppercase font-bold text-stone-400 tracking-wider border-b border-stone-100 mb-1">
                        Query Limit
                      </div>
                      <ScrollShadow hideScrollBar size={30} className="max-h-56 space-y-0.5">
                        {[
                          { limit: 500, label: "500 Lines" },
                          { limit: 1000, label: "1,000 Lines" },
                          { limit: 2500, label: "2,500 Lines" },
                          { limit: 5000, label: "5,000 Lines" },
                          { limit: 10000, label: "10,000 Lines" },
                        ].map((opt) => (
                          <button
                            key={opt.limit}
                            type="button"
                            onClick={() => {
                              onFetchLimitChange(opt.limit);
                              setFilterMenuOpen(false);
                              setActiveSubmenu(null);
                            }}
                            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                              fetchLimit === opt.limit
                                ? "bg-stone-900 text-white font-bold"
                                : "text-stone-700 hover:bg-stone-100"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </ScrollShadow>
                    </div>
                  )}
                </div>

                {/* Item 3: Export Button */}
                {onExport && (
                  <div className="pt-1 mt-1 border-t border-stone-100">
                    <button
                      type="button"
                      onClick={() => {
                        onExport();
                        setFilterMenuOpen(false);
                        setActiveSubmenu(null);
                      }}
                      className="w-full flex items-center space-x-2 px-2.5 py-2 rounded-xl text-xs font-medium text-stone-700 hover:bg-stone-50 hover:text-stone-900 transition cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                      <span>Export Audit Data</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
