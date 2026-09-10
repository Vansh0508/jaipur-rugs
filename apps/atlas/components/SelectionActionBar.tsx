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
export function SelectionActionBar({
  count,
  onCopy,
  onExport,
  onClear,
}: {
  count: number;
  onCopy: () => Promise<boolean>;
  onExport: () => void;
  onClear: () => void;
}) {
  const [status, setStatus] = useState<string | null>(null);

  async function handleCopy() {
    const ok = await onCopy();
    setStatus(
      ok
        ? `Copied ${count} row${count === 1 ? "" : "s"} — paste into Excel/email.`
        : "Couldn't copy — try selecting fewer rows or a different browser.",
    );
    setTimeout(() => setStatus(null), 3000);
  }

  if (!count) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-2 z-20 flex justify-center px-4">
      <div className="pointer-events-auto flex max-w-full items-center gap-3 rounded-lg border-2 border-border bg-surface px-4 py-2.5 shadow-[0_8px_24px_-6px_rgba(0,0,0,0.25)]">
        <span className="shrink-0 text-sm font-medium text-foreground">{count} selected</span>
        <Button variant="secondary" size="sm" onPress={handleCopy}>
          Copy
        </Button>
        <Button variant="secondary" size="sm" onPress={onExport}>
          Export to Excel
        </Button>
        {status ? <span className="truncate text-xs text-muted">{status}</span> : null}
        <button type="button" onClick={onClear} className="shrink-0 text-sm text-accent hover:underline">
          Clear
        </button>
      </div>
    </div>
  );
}
