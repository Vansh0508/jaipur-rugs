"use client";

import { useState } from "react";
import { Dropdown } from "@jaipur-rugs/ui-kit";
import type { ColumnDef } from "./ColumnVisibilityMenu";

export type { ColumnDef };

/** Full "manage columns" control for OrdersTable — added 2026-09-12, direct request:
 * every field the rug data actually carries should be addable to the view, and each
 * person should be able to arrange them however THEY read this table ("each user has
 * their own way of viewing rug list"). Two things this does beyond the older, simpler
 * ColumnVisibilityMenu (still used as-is by RugLensTable — this doesn't replace that):
 *
 * 1. Show/hide, same as before, but over a much longer column list (the near-complete
 *    orders/rug field set, not just the curated front set) — hence the search box.
 * 2. Reorder — up/down buttons per row, operating on the real left-to-right column
 *    order (OrdersTable persists it via useLocalPreference, same mechanism as
 *    visibility). Deliberately plain up/down buttons rather than drag-and-drop: Hero
 *    UI's Dropdown.Menu (React Aria under the hood) is built for one click = one
 *    selection, and doesn't carry drag-reorder support — see FilterPrimitives.tsx's
 *    FacetDropdown for the same "plain custom content inside Dropdown.Popover, not
 *    Dropdown.Menu" pattern this borrows, for the identical reason (a row here needs a
 *    checkbox AND two independent buttons, which doesn't fit a Menu Item).
 *
 * Reordering is disabled while the search box has text — reordering a filtered subset
 * would move a column relative to others currently hidden by the filter, which is a
 * confusing thing to reason about. Clearing the search re-enables it. */
export function ColumnSettingsMenu({
  columns,
  hidden,
  onVisibilityChange,
  onOrderChange,
  onReset,
}: {
  /** Every column this table can show, already in the user's current effective
   * left-to-right order (index 0 = leftmost) — reorder buttons act on this array's
   * indices directly, so callers must pass the real order, not a filtered view of it. */
  columns: ColumnDef[];
  hidden: Set<string>;
  onVisibilityChange: (hidden: Set<string>) => void;
  onOrderChange: (orderedIds: string[]) => void;
  onReset: () => void;
}) {
  const [query, setQuery] = useState("");
  const isFiltering = query.trim().length > 0;
  const normalizedQuery = query.trim().toLowerCase();
  const visibleCount = columns.length - hidden.size;

  function toggle(id: string) {
    const next = new Set(hidden);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onVisibilityChange(next);
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= columns.length) return;
    const next = [...columns];
    const a = next[index];
    const b = next[target];
    if (!a || !b) return; // unreachable given the bounds check above — keeps TS happy under noUncheckedIndexedAccess
    next[index] = b;
    next[target] = a;
    onOrderChange(next.map((c) => c.id));
  }

  return (
    <Dropdown.Root>
      <Dropdown.Trigger className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border-2 border-border px-3 py-1.5 text-sm hover:bg-surface-secondary">
        Columns
        <span className="text-xs text-muted">
          ({visibleCount}/{columns.length})
        </span>
      </Dropdown.Trigger>
      <Dropdown.Popover className="w-80">
        <div className="flex flex-col gap-2 p-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search columns…"
            className="rounded-lg border-2 border-border bg-transparent px-2 py-1 text-xs outline-none focus:border-accent"
          />
          {isFiltering ? <p className="px-1 text-[11px] text-muted">Clear the search to reorder columns.</p> : null}
          <div className="flex max-h-80 flex-col gap-0.5 overflow-y-auto">
            {columns.map((col, index) => {
              if (normalizedQuery && !col.label.toLowerCase().includes(normalizedQuery)) return null;
              const isHidden = hidden.has(col.id);
              return (
                <div key={col.id} className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-xs hover:bg-surface-secondary">
                  <input
                    type="checkbox"
                    checked={!isHidden}
                    onChange={() => toggle(col.id)}
                    className="h-3.5 w-3.5 shrink-0"
                    aria-label={`Show ${col.label} column`}
                  />
                  <span className="flex-1 truncate">{col.label}</span>
                  <button
                    type="button"
                    disabled={isFiltering || index === 0}
                    onClick={() => move(index, -1)}
                    title="Move left"
                    aria-label={`Move ${col.label} column left`}
                    className="rounded px-1 text-muted hover:bg-border disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={isFiltering || index === columns.length - 1}
                    onClick={() => move(index, 1)}
                    title="Move right"
                    aria-label={`Move ${col.label} column right`}
                    className="rounded px-1 text-muted hover:bg-border disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    ↓
                  </button>
                </div>
              );
            })}
          </div>
          <button type="button" onClick={onReset} className="self-start text-xs text-accent hover:underline">
            Reset to default
          </button>
        </div>
      </Dropdown.Popover>
    </Dropdown.Root>
  );
}
