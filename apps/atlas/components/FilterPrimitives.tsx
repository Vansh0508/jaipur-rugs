"use client";

import { useState } from "react";
import { Dropdown } from "@jaipur-rugs/ui-kit";

// Extracted 2026-09-10 from OrdersFilterPanel.tsx so RugLensFilterPanel can reuse the
// exact same filter controls (and their already-tuned UX) instead of redefining them.
//
// FacetCheckboxList (a bare checkbox list inside a sidebar-portaled `<form>`) became
// FacetDropdown the same day, once filters moved out of the sidebar into a bar above
// each table: same real checkboxes (still unambiguous — "confusing if it got selected
// or not" was the original complaint about a native `<select multiple>`, direct
// feedback 2026-09-05), same >6-options search box, now built on Hero UI's real
// Dropdown (selectionMode="multiple") instead of a plain `<form>` submit, so each facet
// is its own compact dropdown button rather than a whole vertical panel.
export type FilterOption = { value: string; label: string };

/** Checkbox-style multi-select filter dropdown. `selected` is the value actually
 * applied (from the URL); a local `pending` selection tracks in-progress checkbox
 * clicks so nothing re-queries the server on every click — `onApply` fires once, with
 * the final set, when the dropdown closes (matches how the old sidebar form's one
 * "Apply filters" button batched every field at once, just per-field now instead of
 * all-at-once). */
export function FacetDropdown({
  label,
  options,
  selected,
  onApply,
}: {
  label: string;
  options: FilterOption[];
  selected: string[];
  onApply: (values: string[]) => void;
}) {
  const [pending, setPending] = useState<Set<string>>(new Set(selected));
  const [query, setQuery] = useState("");
  const visible = query ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase())) : options;

  return (
    <Dropdown.Root
      onOpenChange={(open: boolean) => {
        if (open) {
          setPending(new Set(selected));
          setQuery("");
        } else {
          onApply([...pending]);
        }
      }}
    >
      <Dropdown.Trigger className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border-2 border-border px-3 py-1.5 text-sm hover:bg-surface-secondary">
        {label}
        {selected.length ? <span className="text-xs text-accent">({selected.length})</span> : null}
      </Dropdown.Trigger>
      <Dropdown.Popover className="w-64">
        <div className="flex flex-col gap-2 p-2">
          {options.length > 6 ? (
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${label.toLowerCase()}…`}
              className="rounded-lg border-2 border-border bg-transparent px-2 py-1 text-xs outline-none focus:border-accent"
            />
          ) : null}
          {visible.length ? (
            <Dropdown.Menu
              aria-label={label}
              selectionMode="multiple"
              shouldCloseOnSelect={false}
              selectedKeys={pending}
              onSelectionChange={(keys) =>
                setPending(keys === "all" ? new Set(options.map((o) => o.value)) : new Set([...keys].map(String)))
              }
              className="flex max-h-48 flex-col gap-0.5 overflow-y-auto"
              items={visible}
            >
              {(item: FilterOption) => (
                <Dropdown.Item id={item.value} textValue={item.label} className="flex items-center gap-2 px-1.5 py-1 text-xs">
                  <Dropdown.ItemIndicator type="checkmark" />
                  <span className="truncate">{item.label}</span>
                </Dropdown.Item>
              )}
            </Dropdown.Menu>
          ) : (
            <p className="px-1.5 py-1 text-xs text-muted">No matches</p>
          )}
          {pending.size ? (
            <button
              type="button"
              onClick={() => setPending(new Set())}
              className="self-start text-xs text-accent hover:underline"
            >
              Clear
            </button>
          ) : null}
        </div>
      </Dropdown.Popover>
    </Dropdown.Root>
  );
}

/** A single-value field is already a dropdown by nature (one native `<select>`, not a
 * checkbox list) — kept as a plain `<select>` rather than moved onto Hero UI's Dropdown,
 * same reasoning FilterPrimitives.tsx's own header comment gives for search/date
 * fields: not everything in the bar needs to be checkbox-shaped. `onApply` fires
 * directly on change now (2026-09-10) — this used to rely on a surrounding
 * `<form method="get">`'s submit button; now that filters live in their own bar instead
 * of a submitted form, each control applies itself. */
export function SingleSelect({ label, options, selected, onApply }: {
  label: string;
  options: FilterOption[];
  selected?: string;
  onApply: (value: string | undefined) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="font-medium uppercase text-muted whitespace-nowrap">{label}</span>
      <select
        value={selected ?? ""}
        onChange={(e) => onApply(e.target.value || undefined)}
        className="rounded-lg border-2 border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:border-accent"
      >
        <option value="">Any</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
