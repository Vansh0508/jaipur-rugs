"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { AppShell, NavTab } from "@/components/app-shell";
import { AuditDashboard } from "@/components/audit-dashboard";
import { BomTable } from "@/components/bom-table";
import { LineDetailModal } from "@/components/line-detail-modal";
import { BenchmarksView } from "@/components/benchmarks-view";
import { AuditedBomLine, AuditSummary } from "@/lib/audit-engine";
import { DesignBenchmark } from "@/lib/supabase";
import { createClient } from "@/lib/supabase/client";
import { AlertCircle, ShieldAlert } from "lucide-react";
import { Card, Chip, Spinner, Typography } from "@heroui/react";
import { useBomStore } from "@/lib/store/bom-store";

export default function HomePage() {
  const { clearAllCaches, setCachedMasterLines } = useBomStore();

  // Navigation Shell State
  const [currentTab, setCurrentTab] = useState<NavTab>("dashboard");

  // Master cache of lines from database
  const [masterLines, setMasterLines] = useState<AuditedBomLine[]>([]);
  const [serverSummary, setServerSummary] = useState<AuditSummary>({
    totalLines: 0,
    validCount: 0,
    invalidCodeCount: 0,
    belowAvgQtyCount: 0,
    unregisteredPrefixCount: 0,
    discrepancyRate: 0,
  });
  const [benchmarks, setBenchmarks] = useState<DesignBenchmark[]>([]);
  const [isLive, setIsLive] = useState(false);
  const [isCachedData, setIsCachedData] = useState(false);
  const [isMssqlConfigured, setIsMssqlConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLazyLoading, setIsLazyLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [selectedPrefix, setSelectedPrefix] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [fetchLimit, setFetchLimit] = useState(1000);

  // Handle search with immediate optimistic UI
  const handleSearchChange = (val: string) => {
    setSearchTerm(val);
    setIsSearching(true);
  };

  // Modals
  const [selectedLine, setSelectedLine] = useState<AuditedBomLine | null>(null);

  // Authenticated User State
  const [currentUser, setCurrentUser] = useState<{
    email: string;
    fullName?: string;
    role?: string;
  } | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user && user.email) {
        const fullName =
          user.user_metadata?.full_name ||
          user.email.split("@")[0];
        const role = user.user_metadata?.role || "Auditor";

        setCurrentUser({
          email: user.email,
          fullName,
          role,
        });
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.email) {
        setCurrentUser({
          email: session.user.email,
          fullName:
            session.user.user_metadata?.full_name || session.user.email.split("@")[0],
          role: "Auditor",
        });
      } else {
        setCurrentUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  // Optimistic Client-Side Filtering (Instant feedback while typing)
  const optimisticLines = useMemo(() => {
    let result = masterLines;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (l) =>
          (l.bomNo && l.bomNo.toLowerCase().includes(term)) ||
          (l.itemNo && l.itemNo.toLowerCase().includes(term)) ||
          (l.matchingCode && l.matchingCode.toLowerCase().includes(term)) ||
          (l.design && l.design.toLowerCase().includes(term)) ||
          (l.designPrefix && l.designPrefix.toLowerCase().includes(term)) ||
          (l.quality && l.quality.toLowerCase().includes(term)) ||
          (l.componentCode && l.componentCode.toLowerCase().includes(term)) ||
          (l.componentDescription && l.componentDescription.toLowerCase().includes(term)) ||
          (l.remarks && l.remarks.toLowerCase().includes(term))
      );
    }

    if (selectedPrefix) {
      const pfx = selectedPrefix.toUpperCase();
      result = result.filter(
        (l) =>
          l.designPrefix.toUpperCase() === pfx ||
          (l.design && l.design.toUpperCase().startsWith(pfx))
      );
    }

    if (statusFilter === "DISCREPANCIES") {
      result = result.filter((l) => l.status !== "VALID");
    } else if (statusFilter === "INVALID_CODE") {
      result = result.filter((l) => l.status === "INVALID_CODE");
    } else if (statusFilter === "BELOW_AVG_QUANTITY") {
      result = result.filter((l) => l.status === "BELOW_AVG_QUANTITY");
    } else if (statusFilter === "VALID") {
      result = result.filter((l) => l.status === "VALID");
    }

    return result;
  }, [masterLines, searchTerm, selectedPrefix, statusFilter]);

  // Dynamically compute summary for current view
  const summary: AuditSummary = useMemo(() => {
    if (searchTerm || selectedPrefix || statusFilter !== "ALL") {
      const total = optimisticLines.length;
      const valid = optimisticLines.filter((l) => l.status === "VALID").length;
      const invalid = optimisticLines.filter((l) => l.status === "INVALID_CODE").length;
      const belowAvg = optimisticLines.filter((l) => l.status === "BELOW_AVG_QUANTITY").length;
      const unreg = optimisticLines.filter((l) => l.status === "UNREGISTERED_PREFIX").length;
      const disc = invalid + belowAvg + unreg;
      const rate = total > 0 ? Math.round((disc / total) * 1000) / 10 : 0;
      return {
        totalLines: total,
        validCount: valid,
        invalidCodeCount: invalid,
        belowAvgQtyCount: belowAvg,
        unregisteredPrefixCount: unreg,
        discrepancyRate: rate,
      };
    }
    return serverSummary;
  }, [optimisticLines, serverSummary, searchTerm, selectedPrefix, statusFilter]);

  const discrepancyTotal =
    summary.invalidCodeCount + summary.belowAvgQtyCount + summary.unregisteredPrefixCount;

  // Handle Tab Switch from Sidebar Nav Shell
  const handleTabChange = (tab: NavTab) => {
    setCurrentTab(tab);
    if (tab === "discrepancies") {
      setStatusFilter("DISCREPANCIES");
    } else if (tab === "dashboard") {
      setStatusFilter("ALL");
    }
  };

  // Background fetch to sync from live MS SQL view
  const INITIAL_PAGE_BATCH = 100;

  const fetchBom = useCallback(async (isInitial = false, bypassCache = false) => {
    try {
      if (isInitial) setIsLoading(true);
      else setIsRefreshing(true);

      if (bypassCache) {
        clearAllCaches();
      }

      const initialLimit = Math.min(INITIAL_PAGE_BATCH, fetchLimit);
      const params = new URLSearchParams();
      if (searchTerm) params.set("search", searchTerm);
      if (selectedPrefix) params.set("prefix", selectedPrefix);
      if (statusFilter) params.set("status", statusFilter);
      if (bypassCache) params.set("refresh", "true");
      params.set("offset", "0");
      params.set("limit", String(initialLimit));

      const res = await fetch(`/api/bom?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setMasterLines(data.lines);
        setServerSummary(data.summary);
        setCachedMasterLines(data.lines, data.summary);
        setIsLive(data.isLive);
        setIsCachedData(data.isCached || false);
        setIsMssqlConfigured(data.isMssqlConfigured);
        setErrorMessage(data.errorMessage || null);

        setIsLoading(false);
        setIsRefreshing(false);

        if (fetchLimit > initialLimit && data.hasMore) {
          setIsLazyLoading(true);
          const lazyParams = new URLSearchParams();
          if (searchTerm) lazyParams.set("search", searchTerm);
          if (selectedPrefix) lazyParams.set("prefix", selectedPrefix);
          if (statusFilter) lazyParams.set("status", statusFilter);
          lazyParams.set("offset", String(initialLimit));
          lazyParams.set("limit", String(fetchLimit - initialLimit));

          fetch(`/api/bom?${lazyParams.toString()}`)
            .then((r) => r.json())
            .then((lazyData) => {
              if (lazyData.success && lazyData.lines && lazyData.lines.length > 0) {
                setMasterLines((prev) => {
                  const existingIds = new Set(prev.map((l) => l.id));
                  const newUnique = lazyData.lines.filter((l: AuditedBomLine) => !existingIds.has(l.id));
                  return [...prev, ...newUnique];
                });
                setServerSummary((prev) => {
                  const total = prev.totalLines + lazyData.summary.totalLines;
                  const invalid = prev.invalidCodeCount + lazyData.summary.invalidCodeCount;
                  const belowAvg = prev.belowAvgQtyCount + lazyData.summary.belowAvgQtyCount;
                  const unreg = prev.unregisteredPrefixCount + lazyData.summary.unregisteredPrefixCount;
                  const disc = invalid + belowAvg + unreg;
                  return {
                    totalLines: total,
                    validCount: prev.validCount + lazyData.summary.validCount,
                    invalidCodeCount: invalid,
                    belowAvgQtyCount: belowAvg,
                    unregisteredPrefixCount: unreg,
                    discrepancyRate: total > 0 ? Math.round((disc / total) * 1000) / 10 : 0,
                  };
                });
              }
            })
            .catch((err) => {
              console.warn("Background lazy-load error:", err);
            })
            .finally(() => {
              setIsLazyLoading(false);
            });
        }
      } else {
        setErrorMessage(data.error || "Failed to fetch BOM records");
        setIsLoading(false);
        setIsRefreshing(false);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to connect to server");
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [searchTerm, selectedPrefix, statusFilter, fetchLimit]);

  const fetchBenchmarks = async () => {
    try {
      const res = await fetch("/api/benchmarks");
      const data = await res.json();
      if (data.success) {
        setBenchmarks(data.benchmarks);
      }
    } catch (err) {
      console.error("Failed to load benchmarks:", err);
    }
  };

  useEffect(() => {
    fetchBenchmarks();
    fetchBom(true);
  }, []);

  // Debounced background sync on filter changes
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchBom(false);
      setIsSearching(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [fetchBom]);

  useEffect(() => {
    if (!isSearching) return;
    const timer = setTimeout(() => {
      setIsSearching(false);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchTerm, isSearching]);

  const handleExport = () => {
    const params = new URLSearchParams();
    if (searchTerm) params.set("search", searchTerm);
    if (selectedPrefix) params.set("prefix", selectedPrefix);
    window.location.href = `/api/export?${params.toString()}`;
  };

  const availablePrefixes = Array.from(
    new Set(benchmarks.map((b) => b.design_prefix))
  ).sort();

  return (
    <AppShell
      currentTab={currentTab}
      onTabChange={handleTabChange}
      isLive={isLive}
      isMssqlConfigured={isMssqlConfigured}
      benchmarkCount={benchmarks.length}
      discrepancyCount={discrepancyTotal}
      totalLinesCount={summary.totalLines}
      isRefreshing={isRefreshing}
      onExport={handleExport}
      onRefresh={() => fetchBom(false, true)}
      onOpenBenchmarks={() => handleTabChange("benchmarks")}
      userEmail={currentUser?.email || "auditor@jaipurrugs.com"}
      userName={currentUser?.fullName || "D&D Auditor"}
      userRole={currentUser?.role || "Auditor"}
      onSignOut={handleSignOut}
    >
      {currentTab === "benchmarks" ? (
        <BenchmarksView
          benchmarks={benchmarks}
          onBackToDashboard={() => handleTabChange("dashboard")}
        />
      ) : (
        <div className="flex-1 flex flex-col min-h-0 gap-3">
          {/* Connection Notice if using Demo Data */}
          {!isMssqlConfigured && (
            <Card className="shrink-0 p-3 bg-amber-50/90 border border-amber-200 text-amber-900 shadow-2xs rounded-2xl">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                  <div className="text-xs">
                    <span className="font-bold">Displaying Representative NAV-004 Sample BOM Data: </span>
                    <span>
                      To connect to your hosted MS SQL database directly, configure your credentials in{" "}
                      <Typography.Code className="px-1.5 py-0.5 rounded bg-amber-100/80 font-sans font-bold text-amber-950">
                        .env.local
                      </Typography.Code>{" "}
                      (MSSQL_SERVER, MSSQL_USER, MSSQL_PASSWORD, MSSQL_DATABASE).
                    </span>
                  </div>
                </div>
                <Chip color="warning" variant="soft" size="sm" className="font-bold shrink-0">
                  Demo Active
                </Chip>
              </div>
            </Card>
          )}

          {/* Error banner if query failed */}
          {errorMessage && isMssqlConfigured && (
            <Card className="shrink-0 p-3 bg-rose-50 border border-rose-200 text-rose-900 text-xs rounded-2xl">
              <div className="flex items-center space-x-3">
                <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
                <div>
                  <span className="font-bold">MS SQL Query Notice: </span>
                  <span>{errorMessage}</span>
                </div>
              </div>
            </Card>
          )}

          {/* Dashboard Title, Underline Tabs & Action Bar */}
          <div className="shrink-0">
            <AuditDashboard
              summary={summary}
              activeStatusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              searchTerm={searchTerm}
              onSearchChange={handleSearchChange}
              isSearching={isSearching}
              selectedPrefix={selectedPrefix}
              onPrefixChange={setSelectedPrefix}
              availablePrefixes={availablePrefixes}
              fetchLimit={fetchLimit}
              onFetchLimitChange={setFetchLimit}
              onExport={handleExport}
              onRefresh={() => fetchBom(false, true)}
              isRefreshing={isRefreshing}
              onOpenBenchmarks={() => handleTabChange("benchmarks")}
              benchmarkCount={benchmarks.length}
            />
          </div>

          {/* Revitalized Main Table Section (Fills full remaining height) */}
          <div className="flex-1 flex flex-col min-h-0">
            <BomTable
              lines={optimisticLines}
              onInspectLine={(line) => setSelectedLine(line)}
              isLoading={isLoading}
              isSearching={isSearching}
              searchTerm={searchTerm}
            />
          </div>
        </div>
      )}

      {/* Audit Detail Diagnosis Modal */}
      <LineDetailModal
        line={selectedLine}
        allLines={masterLines}
        onClose={() => setSelectedLine(null)}
      />
    </AppShell>
  );
}
