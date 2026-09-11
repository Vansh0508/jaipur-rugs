"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FacetDropdown, SingleSelect } from "@/components/FilterPrimitives";
import { useLocalPreference } from "@/lib/useLocalPreference";

// Used to portal itself into the sidebar, same as OrdersFilterPanel.tsx (see that
// file's comment) — reversed 2026-09-10, same day and same reasoning: filters now
// render as a bar of dropdowns above the RugLens table instead. Rug Lens's own data
// behavior (fixed sort order, fixed page size) is unchanged — only the filter UI moved
// and was rebuilt on Hero UI's real Dropdown.
export interface RugLensFilterPanelProps {
  locationOptions: string[];
  qualityOptions: string[];
  values: {
    q: string;
    location: string[];
    quality: string[];
    itemType?: string;
    availability?: string;
  };
  hasAnyFilter: boolean;
}

export function RugLensFilterPanel({ locationOptions, qualityOptions, values, hasAnyFilter }: RugLensFilterPanelProps) {
  const router = useRouter();
  const [filtersVisible, setFiltersVisible] = useLocalPreference("atlas:rugLens:filtersVisible", true);
  const [searchInput, setSearchInput] = useState(values.q);

  // Tracks the full intended filter state locally rather than reconstructing "every
  // other current filter" from useSearchParams() inside apply(). Needed because this
  // page runs a real Supabase query server-side on every filter change, so a
  // router.push() navigation takes real time to land — useSearchParams() only reflects
  // the new URL once that round trip actually completes. The old version read
  // searchParams.entries() fresh on every apply() call; firing a second filter change
  // (Location, then Quality) before the first one's navigation had landed read a stale
  // snapshot missing that first change, and silently dropped it from the merged URL.
  // Confirmed live, 2026-09-11 (direct feedback: applying Quality right after Location
  // deselected Location; repeatedly searching-then-selecting within the same dropdown,
  // faster than the page could round-trip, lost earlier selections the same way).
  //
  // `current` is the fix: updated synchronously on every apply(), so the NEXT apply()
  // (even one fired before the previous navigation resolves) always merges against the
  // true latest intent, not a lagging snapshot. Re-synced from `values` (the server's
  // authoritative state, reflecting whatever URL actually landed) whenever it changes,
  // so a hard refresh or a "Clear all" navigation still ends up correct once the page
  // does catch up.
  const [current, setCurrent] = useState(values);
  useEffect(() => {
    setCurrent(values);
  }, [values]);

  function apply(overrides: Partial<typeof values>) {
    const next = { ...current, ...overrides };
    setCurrent(next);
    const p = new URLSearchParams();
    for (const [key, value] of Object.entries(next)) {
      if (value === undefined) continue;
      for (const v of Array.isArray(value) ? value : [value]) {
        if (v) p.append(key, v);
      }
    }
    router.push(`/rug-lens?${p.toString()}`);
  }

  function applySearch() {
    if (searchInput === current.q) return;
    apply({ q: searchInput || undefined });
  }

  return (
    <div className="flex shrink-0 flex-col gap-2">
      <button
        type="button"
        onClick={() => setFiltersVisible((v) => !v)}
        className="self-start text-xs text-muted hover:text-foreground hover:underline"
      >
        {filtersVisible ? "Hide filters" : "Show filters"}
      </button>

      {filtersVisible ? (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border-2 border-border p-3">
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium uppercase text-muted">Search</span>
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onBlur={applySearch}
              onKeyDown={(e) => e.key === "Enter" && applySearch()}
              placeholder="Design, serial no, location…"
              className="w-48 rounded-lg border-2 border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:border-accent"
            />
          </label>
          <FacetDropdown
            label="Location"
            options={locationOptions.map((v) => ({ value: v, label: v }))}
            selected={current.location}
            onApply={(v) => apply({ location: v })}
          />
          <FacetDropdown
            label="Quality"
            options={qualityOptions.map((v) => ({ value: v, label: v }))}
            selected={current.quality}
            onApply={(v) => apply({ quality: v })}
          />
          {/* Sample = a swatch by size (Std Cubage), same rule Orders' own
              Construction filter uses — see lib/queries/rugLens.ts's
              applyRugLensFilters for the exact rule (and its null-handling caveat). */}
          <SingleSelect
            label="Type"
            selected={current.itemType}
            onApply={(v) => apply({ itemType: v })}
            options={[
              { value: "sample", label: "Sample" },
              { value: "rug", label: "Rug" },
            ]}
          />
          {/* Opt-in, off by default — direct feedback, 2026-09-11: "give an option ...
              to check hold remarks or customer PO mentioned items also but not in
              default view." See lib/queries/rugLens.ts's includeHeldOrAssigned. */}
          <SingleSelect
            label="Availability"
            selected={current.availability}
            onApply={(v) => apply({ availability: v })}
            options={[{ value: "all", label: "Include held / with PO" }]}
          />
          {hasAnyFilter ? (
            <Link href="/rug-lens" className="self-center text-sm text-accent hover:underline">
              Clear all
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
