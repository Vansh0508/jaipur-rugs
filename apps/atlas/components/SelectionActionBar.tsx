"use client";

import { useState } from "react";
import { Button } from "@jaipur-rugs/ui-kit";

/** Floating bulk-action bar shown once at least one row is selected — replaces the old
 * inline top toolbar ("Select" → "N selected / Copy selected / Cancel") on both
 * OrdersTable.tsx and RugLensTable.tsx, 2026-09-10, now that selection itself is native
 * Hero UI Table selection (`selectionMode="multiple"`) rather than a hand-rolled
 * `selectMode` boolean + manual checkbox column. Shared here since the behavior (and
 * the copy/export plumbing feeding it) is identical between the two tables.
 *
 * Positioned `absolute` at the bottom of whichever `relative`-positioned container the
 * caller renders it in (the table's own wrapper), not fixed to the viewport — so it
 * floats over the table area specifically, the "bottom cell popup" asked for. */
export interface SelectionQuantityPicker {
  value: number | "all";
  options: (number | "all")[];
  /** Total rows matching the current filters — shown next to "All" so the option reads
   * as "All (1,234)", not a mystery unlabeled choice. */
  totalCount: number;
  onChange: (value: number | "all") => void;
}

export function SelectionActionBar({
  count,
  onCopy,
  onExport,
  onClear,
  quantityPicker,
  error,
}: {
  count: number;
  onCopy: () => Promise<boolean>;
  onExport: () => void | Promise<void>;
  onClear: () => void;
  /** Only relevant to "Select All" (a manual, individually-checked selection is always
   * exactly what's checked, nothing to choose) — see OrdersTable.tsx's own comment on
   * why this exists: added 2026-09-17, direct request, since Copy/Export used to only
   * ever operate on whatever the on-screen page size happened to hold. Undefined hides
   * the picker entirely (e.g. RugLensTable, which doesn't use this yet). */
  quantityPicker?: SelectionQuantityPicker;
  /** Surfaced from a failed fetch when the quantity picker needed to grab more rows
   * than were already on screen — distinct from the plain copy-failed status message
   * below, which is about the clipboard API itself, not fetching. */
  error?: string | null;
}) {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleCopy() {
    setBusy(true);
    try {
      const ok = await onCopy();
      setStatus(
        ok
          ? `Copied ${count} row${count === 1 ? "" : "s"} — paste into Excel/email.`
          : "Couldn't copy — try selecting fewer rows or a different browser.",
      );
      setTimeout(() => setStatus(null), 3000);
    } finally {
      setBusy(false);
    }
  }

  async function handleExport() {
    setBusy(true);
    try {
      await onExport();
    } finally {
      setBusy(false);
    }
  }

  if (!count) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-2 z-20 flex justify-center px-4">
      <div className="pointer-events-auto flex max-w-full flex-wrap items-center gap-3 rounded-lg border-2 border-border bg-surface px-4 py-2.5 shadow-[0_8px_24px_-6px_rgba(0,0,0,0.25)]">
        <span className="shrink-0 text-sm font-medium text-foreground">{count} selected</span>
        {quantityPicker ? (
          <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted">
            <span>of</span>
            <select
              value={String(quantityPicker.value)}
              onChange={(e) => quantityPicker.onChange(e.target.value === "all" ? "all" : Number(e.target.value))}
              className="cursor-pointer rounded border border-border bg-surface px-1.5 py-1 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
            >
              {quantityPicker.options.map((opt) => (
                <option key={opt} value={opt}>
                  {opt === "all" ? `All (${quantityPicker.totalCount.toLocaleString()})` : opt}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <Button variant="secondary" size="sm" onPress={handleCopy} isDisabled={busy}>
          Copy
        </Button>
        <Button variant="secondary" size="sm" onPress={handleExport} isDisabled={busy}>
          Export to Excel
        </Button>
        {busy ? <span className="text-xs text-muted">Fetching…</span> : null}
        {error ? <span className="truncate text-xs text-danger">{error}</span> : null}
        {!error && status ? <span className="truncate text-xs text-muted">{status}</span> : null}
        <button type="button" onClick={onClear} className="shrink-0 text-sm text-accent hover:underline">
          Clear
        </button>
      </div>
    </div>
  );
}
