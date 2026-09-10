"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { FacetCheckboxList, SingleSelect } from "@/components/FilterPrimitives";

// Same portal-into-sidebar pattern as OrdersFilterPanel.tsx (see that file's comment).
// RugLens started with just Location (the one filter Ayaan first asked for, since the
// "available open stock" condition itself — open-stock customer codes, PO blank, not on
// hold — isn't something a user picks, it's what defines this whole view) and gained
// Type (Sample/Rug) 2026-09-10 per direct follow-up feedback.
export interface RugLensFilterPanelProps {
  locationOptions: string[];
  values: {
    location: string[];
    itemType?: string;
  };
  hasAnyFilter: boolean;
}

export function RugLensFilterPanel({ locationOptions, values, hasAnyFilter }: RugLensFilterPanelProps) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setSlot(document.getElementById("page-sidebar-extra"));
  }, []);

  const content = (
    <form method="get" className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold uppercase text-muted">Filters</h2>

      <FacetCheckboxList
        name="location"
        label="Location"
        options={locationOptions.map((v) => ({ value: v, label: v }))}
        selected={values.location}
      />

      {/* Sample = Serial No_ starts with "SS" — see lib/queries/rugLens.ts's
          applyRugLensFilters for the exact rule (and its null-handling caveat). */}
      <SingleSelect
        name="itemType"
        label="Type"
        selected={values.itemType}
        options={[
          { value: "sample", label: "Sample" },
          { value: "rug", label: "Rug" },
        ]}
      />

      <div className="flex flex-col gap-2 border-t-2 border-border pt-3">
        <button type="submit" className="rounded-lg border-2 border-border px-3 py-2 text-sm hover:bg-surface-secondary">
          Apply filters
        </button>
        {hasAnyFilter ? (
          <Link href="/rug-lens" className="text-center text-sm text-accent hover:underline">
            Clear all
          </Link>
        ) : null}
      </div>
    </form>
  );

  if (!slot) return null;
  return createPortal(content, slot);
}
