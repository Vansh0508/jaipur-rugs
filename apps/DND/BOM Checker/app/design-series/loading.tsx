import React from "react";
import { AppShell } from "@/components/app-shell";

export default function LoadingDesignSeries() {
  return (
    <AppShell currentTab="design-series">
      <div className="flex-1 flex flex-col min-h-0 space-y-4 animate-pulse">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between pb-4 border-b border-border/80">
          <div className="space-y-2">
            <div className="h-6 w-72 bg-neutral-200 dark:bg-neutral-800 rounded-lg" />
            <div className="h-4 w-96 bg-neutral-200/60 dark:bg-neutral-800/60 rounded" />
          </div>
          <div className="flex gap-2">
            <div className="h-7 w-28 bg-neutral-200 dark:bg-neutral-800 rounded-full" />
            <div className="h-7 w-28 bg-neutral-200 dark:bg-neutral-800 rounded-full" />
          </div>
        </div>

        {/* Toolbar Skeleton */}
        <div className="flex items-center gap-3">
          <div className="h-8 w-44 bg-neutral-200 dark:bg-neutral-800 rounded-full" />
          <div className="h-8 w-44 bg-neutral-200 dark:bg-neutral-800 rounded-full" />
          <div className="h-8 w-64 bg-neutral-200 dark:bg-neutral-800 rounded-full" />
        </div>

        {/* Table Skeleton */}
        <div className="flex-1 rounded-2xl border border-border bg-surface p-4 space-y-3">
          <div className="h-10 w-full bg-neutral-100 dark:bg-neutral-900 rounded-xl" />
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="h-12 w-full bg-neutral-100/70 dark:bg-neutral-900/50 rounded-lg"
            />
          ))}
        </div>
      </div>
    </AppShell>
  );
}
