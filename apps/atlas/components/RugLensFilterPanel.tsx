"use client";

import { useRouter, useSearchParams } from "next/navigation";
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
  values: {
    location: string[];
    itemType?: string;
  };
  hasAnyFilter: boolean;
}

export function RugLensFilterPanel({ locationOptions, values, hasAnyFilter }: RugLensFilterPanelProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filtersVisible, setFiltersVisible] = useLocalPreference("atlas:rugLens:filtersVisible", true);

  function apply(overrides: Record<string, string | string[] | undefined>) {
    const p = new URLSearchParams();
    for (const [key, value] of searchParams.entries()) {
      if (key in overrides || key === "page") continue;
      p.append(key, value);
    }
    for (const [key, value] of Object.entries(overrides)) {
      if (value === undefined) continue;
      for (const v of Array.isArray(value) ? value : [value]) {
        if (v) p.append(key, v);
      }
    }
    router.push(`/rug-lens?${p.toString()}`);
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
          <FacetDropdown
            label="Location"
            options={locationOptions.map((v) => ({ value: v, label: v }))}
            selected={values.location}
            onApply={(v) => apply({ location: v })}
          />
          {/* Sample = Serial No_ starts with "SS" — see lib/queries/rugLens.ts's
              applyRugLensFilters for the exact rule (and its null-handling caveat). */}
          <SingleSelect
            label="Type"
            selected={values.itemType}
            onApply={(v) => apply({ itemType: v })}
            options={[
              { value: "sample", label: "Sample" },
              { value: "rug", label: "Rug" },
            ]}
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
