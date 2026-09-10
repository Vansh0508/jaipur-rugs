"use client";

import { useState } from "react";

// Extracted 2026-09-10 from OrdersFilterPanel.tsx so RugLensFilterPanel can reuse the
// exact same filter controls (and their already-tuned UX) instead of redefining them —
// no behavior changed from the original OrdersFilterPanel versions.
//
// Real checkboxes, not a native <select multiple> — a checked/unchecked box is
// unambiguous; the native multi-select's highlight-on-select was "confusing if it got
// selected or not" (direct feedback, 2026-09-05). Each option list over 6 options gets
// its own small search box that filters the visible rows client-side (React state, not
// a form field) — the same role the old tool's searchable combo-dropdown played for long
// lists like Design/Size. Checkboxes still carry a plain `name`/`value` so the
// surrounding `<form method="get">` submits exactly the way a `<select multiple>` would
// — no submit handler needed.
export type FilterOption = { value: string; label: string };

export function FacetCheckboxList({ name, label, options, selected }: {
  name: string;
  label: string;
  options: FilterOption[];
  selected: string[];
}) {
  const [query, setQuery] = useState("");
  const visible = query
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase text-muted">
        {label}
        {selected.length ? ` (${selected.length})` : ""}
      </span>
      {options.length > 6 ? (
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${label.toLowerCase()}…`}
          className="rounded-lg border-2 border-border bg-transparent px-2 py-1 text-xs outline-none focus:border-accent"
        />
      ) : null}
      <div className="flex max-h-36 flex-col gap-0.5 overflow-y-auto rounded-lg border-2 border-border p-1">
        {visible.length ? (
          visible.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-surface-secondary">
              <input type="checkbox" name={name} value={opt.value} defaultChecked={selected.includes(opt.value)} />
              <span className="truncate">{opt.label}</span>
            </label>
          ))
        ) : (
          <p className="px-1.5 py-1 text-xs text-muted">No matches</p>
        )}
      </div>
    </div>
  );
}

export function SingleSelect({ name, label, options, selected }: {
  name: string;
  label: string;
  options: FilterOption[];
  selected?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="font-medium uppercase text-muted">{label}</span>
      <select
        name={name}
        defaultValue={selected ?? ""}
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
