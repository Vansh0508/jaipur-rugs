"use client";

import React from "react";

export function OrdersTableSkeleton() {
  return (
    <div className="flex h-full flex-col gap-3 animate-pulse select-none">
      {/* 1. Top Area: View Tabs & Counter Skeleton */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-0.5">
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-stone-50 p-0.5">
            <div className="h-6 w-24 rounded-full bg-stone-200" />
            <div className="h-6 w-20 rounded-full bg-stone-200/60" />
            <div className="h-6 w-20 rounded-full bg-stone-200/60" />
            <div className="h-6 w-24 rounded-full bg-stone-200/60" />
          </div>
        </div>
      </div>

      {/* 2. Controls Row: Filter pills & Search bar */}
      <div className="flex shrink-0 items-center justify-between gap-3 px-0.5">
        <div className="flex items-center gap-2 overflow-hidden py-1">
          <div className="h-5 w-14 rounded-md bg-stone-200/70" />
          <div className="h-7 w-20 rounded-full bg-stone-200" />
          <div className="h-7 w-28 rounded-full bg-stone-200" />
          <div className="h-7 w-24 rounded-full bg-stone-200" />
          <div className="h-7 w-32 rounded-full bg-stone-200" />
          <div className="h-7 w-24 rounded-full bg-stone-200" />
          <div className="h-7 w-20 rounded-full bg-stone-200" />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="h-8 w-56 rounded-full bg-stone-200/80" />
          <div className="h-8 w-8 rounded-full bg-stone-200/80" />
        </div>
      </div>

      {/* 3. Table Container Skeleton */}
      <div className="relative flex min-h-0 flex-1 flex-col rounded-2xl border border-stone-200/80 bg-white shadow-2xs overflow-hidden">
        {/* Table Header Row */}
        <div className="flex items-center border-b border-stone-200 bg-stone-50/80 px-4 py-3 gap-4 shrink-0">
          <div className="h-4 w-4 rounded bg-stone-200" />
          <div className="h-3 w-24 rounded bg-stone-300" />
          <div className="h-3 w-28 rounded bg-stone-300" />
          <div className="h-3 w-20 rounded bg-stone-300" />
          <div className="h-3 w-24 rounded bg-stone-300" />
          <div className="h-3 w-16 rounded bg-stone-300" />
          <div className="h-3 w-20 rounded bg-stone-300" />
          <div className="h-3 w-28 rounded bg-stone-300" />
          <div className="h-3 w-24 rounded bg-stone-300" />
          <div className="h-3 w-20 rounded bg-stone-300" />
          <div className="h-3 w-20 rounded bg-stone-300 ml-auto" />
        </div>

        {/* Table Body Rows (Shimmering) */}
        <div className="flex-1 overflow-hidden divide-y divide-stone-100 p-1">
          {Array.from({ length: 12 }).map((_, idx) => (
            <div key={idx} className="flex items-center px-4 py-3 gap-4">
              <div className="h-4 w-4 rounded bg-stone-200/60" />
              <div className="h-3.5 w-24 rounded bg-stone-200" />
              <div className="h-3.5 w-28 rounded bg-stone-100" />
              <div className="h-3.5 w-20 rounded bg-stone-200/80" />
              <div className="h-5 w-24 rounded-full bg-stone-200/60" />
              <div className="h-3.5 w-16 rounded bg-stone-100" />
              <div className="h-3.5 w-20 rounded bg-stone-200" />
              <div className="h-3.5 w-28 rounded bg-stone-100" />
              <div className="h-5 w-20 rounded-full bg-stone-200/70" />
              <div className="h-3.5 w-20 rounded bg-stone-100" />
              <div className="h-5 w-16 rounded-full bg-stone-200/60 ml-auto" />
            </div>
          ))}
        </div>

        {/* Bottom Pagination Bar Skeleton */}
        <div className="flex shrink-0 items-center justify-between border-t border-stone-200 bg-stone-50/50 px-4 py-2.5">
          <div className="h-3 w-40 rounded bg-stone-200" />
          <div className="flex items-center gap-2">
            <div className="h-6 w-16 rounded bg-stone-200" />
            <div className="h-6 w-28 rounded bg-stone-200" />
            <div className="h-6 w-16 rounded bg-stone-200" />
          </div>
        </div>
      </div>
    </div>
  );
}
