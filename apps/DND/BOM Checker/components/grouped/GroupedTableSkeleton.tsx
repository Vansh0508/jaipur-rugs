"use client";

import React from "react";

export function GroupedTableSkeleton() {
  return (
    <div className="flex h-full flex-col gap-3">
      {/* Top Controls Shimmer */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-0.5">
        {/* Stage Tabs */}
        <div className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-surface p-1 shadow-xs">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-7 w-24 rounded-full bg-neutral-200/70 dark:bg-neutral-800/70 animate-pulse" />
          ))}
        </div>

        {/* Search Shimmer */}
        <div className="h-8.5 w-64 rounded-full bg-neutral-200/70 dark:bg-neutral-800/70 animate-pulse" />
      </div>

      {/* Main Table Card Shimmer */}
      <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/80 bg-surface shadow-2xs">
        {/* Card Header Bar */}
        <div className="flex shrink-0 items-center justify-between border-b border-border/80 bg-surface px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <div className="h-6 w-6 rounded-md bg-neutral-200/70 dark:bg-neutral-800/70 animate-pulse" />
            <div className="h-4 w-40 rounded bg-neutral-200/70 dark:bg-neutral-800/70 animate-pulse" />
          </div>
          <div className="h-4 w-28 rounded bg-neutral-200/70 dark:bg-neutral-800/70 animate-pulse" />
        </div>

        {/* Table Header */}
        <div className="flex items-center gap-4 border-b border-border/80 bg-surface-secondary px-4 py-3 text-xs overflow-x-auto">
          <div className="h-3.5 w-6 shrink-0 rounded bg-neutral-200/70 dark:bg-neutral-800/70 animate-pulse" />
          <div className="h-3.5 w-24 shrink-0 rounded bg-neutral-200/70 dark:bg-neutral-800/70 animate-pulse" />
          <div className="h-3.5 w-20 shrink-0 rounded bg-neutral-200/70 dark:bg-neutral-800/70 animate-pulse" />
          <div className="h-3.5 w-20 shrink-0 rounded bg-neutral-200/70 dark:bg-neutral-800/70 animate-pulse" />
          <div className="h-3.5 w-20 shrink-0 rounded bg-neutral-200/70 dark:bg-neutral-800/70 animate-pulse" />
          <div className="h-3.5 w-16 shrink-0 rounded bg-neutral-200/70 dark:bg-neutral-800/70 animate-pulse" />
          <div className="h-3.5 w-16 shrink-0 rounded bg-neutral-200/70 dark:bg-neutral-800/70 animate-pulse" />
          <div className="h-3.5 w-14 shrink-0 rounded bg-neutral-200/70 dark:bg-neutral-800/70 animate-pulse" />
          <div className="h-3.5 w-14 shrink-0 rounded bg-neutral-200/70 dark:bg-neutral-800/70 animate-pulse" />
          <div className="h-3.5 w-16 shrink-0 rounded bg-neutral-200/70 dark:bg-neutral-800/70 animate-pulse" />
          <div className="h-3.5 w-20 shrink-0 rounded bg-neutral-200/70 dark:bg-neutral-800/70 animate-pulse" />
        </div>

        {/* Table Shimmer Rows */}
        <div className="flex-1 divide-y divide-border/60 overflow-hidden px-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="flex items-center gap-4 py-3 text-xs overflow-x-auto">
              <div className="h-4 w-4 shrink-0 rounded bg-neutral-200/70 dark:bg-neutral-800/70 animate-pulse" />
              <div className="h-3.5 w-24 shrink-0 rounded bg-neutral-200/70 dark:bg-neutral-800/70 animate-pulse" />
              <div className="h-3.5 w-20 shrink-0 rounded bg-neutral-200/70 dark:bg-neutral-800/70 animate-pulse" />
              <div className="h-3.5 w-20 shrink-0 rounded bg-neutral-200/70 dark:bg-neutral-800/70 animate-pulse" />
              <div className="h-3.5 w-20 shrink-0 rounded bg-neutral-200/70 dark:bg-neutral-800/70 animate-pulse" />
              <div className="h-3 w-16 shrink-0 rounded bg-neutral-200/70 dark:bg-neutral-800/70 animate-pulse" />
              <div className="h-3 w-16 shrink-0 rounded bg-neutral-200/70 dark:bg-neutral-800/70 animate-pulse" />
              <div className="h-3.5 w-14 shrink-0 rounded bg-neutral-200/70 dark:bg-neutral-800/70 animate-pulse" />
              <div className="h-3.5 w-14 shrink-0 rounded bg-neutral-200/70 dark:bg-neutral-800/70 animate-pulse" />
              <div className="h-5 w-16 shrink-0 rounded-full bg-neutral-200/70 dark:bg-neutral-800/70 animate-pulse" />
              <div className="h-3.5 w-20 shrink-0 rounded bg-neutral-200/70 dark:bg-neutral-800/70 animate-pulse" />
            </div>
          ))}
        </div>

        {/* Bottom Pagination Shimmer */}
        <div className="flex shrink-0 items-center justify-between border-t border-border/80 bg-surface px-4 py-2.5">
          <div className="h-3 w-40 rounded bg-neutral-200/70 dark:bg-neutral-800/70 animate-pulse" />
          <div className="flex items-center gap-2">
            <div className="h-7 w-16 rounded bg-neutral-200/70 dark:bg-neutral-800/70 animate-pulse" />
            <div className="h-7 w-7 rounded bg-neutral-200/70 dark:bg-neutral-800/70 animate-pulse" />
            <div className="h-7 w-16 rounded bg-neutral-200/70 dark:bg-neutral-800/70 animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}
