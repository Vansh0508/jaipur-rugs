"use client";

import { useState } from "react";
import { Dropdown } from "@jaipur-rugs/ui-kit";
import { requestOrdersColumn } from "@jaipur-rugs/db-management-client";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient.browser";
import { REQUESTABLE_NAV_FIELDS } from "@/lib/requestableNavFields";

/** "Request a column" — browse the full ~180-field NAV catalog that ISN'T in Atlas's
 * `orders` table yet (see lib/requestableNavFields.ts's own comment) and ask for one.
 * Direct decision, 2026-09-12: rather than add all of them up front, a request here logs
 * a row in orders_column_requests for Ayaan to review; only fields someone actually
 * wants get added, one at a time — see db/orders/022_column_requests.sql.
 *
 * Deliberately separate from ColumnSettingsMenu — that one shows/reorders columns that
 * already exist; this one is for the ones that don't, a different action (a request, not
 * an immediate change) with a different result (nothing changes on screen today), so
 * folding it into the same dropdown risked people not noticing the distinction. Same
 * "plain custom content inside Dropdown.Popover, not Dropdown.Menu" pattern as that
 * component and FilterPrimitives.tsx's FacetDropdown, for the same reason (a row here
 * needs its own request button/status, not a Menu Item's single-selection behavior). */
export function RequestColumnMenu() {
  const [query, setQuery] = useState("");
  const [requested, setRequested] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<string | null>(null);
  const normalizedQuery = query.trim().toLowerCase();
  const visible = normalizedQuery
    ? REQUESTABLE_NAV_FIELDS.filter((f) => f.toLowerCase().includes(normalizedQuery))
    : REQUESTABLE_NAV_FIELDS;

  async function handleRequest(navFieldName: string) {
    setPending(navFieldName);
    setErrorField(null);
    try {
      const supabase = getBrowserSupabaseClient();
      await requestOrdersColumn(supabase, navFieldName);
      setRequested((prev) => new Set(prev).add(navFieldName));
    } catch {
      setErrorField(navFieldName);
    } finally {
      setPending(null);
    }
  }

  return (
    <Dropdown.Root onOpenChange={(open: boolean) => { if (open) { setQuery(""); setErrorField(null); } }}>
      <Dropdown.Trigger className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border-2 border-border px-3 py-1.5 text-sm hover:bg-surface-secondary">
        Request a column
      </Dropdown.Trigger>
      <Dropdown.Popover className="w-96">
        <div className="flex flex-col gap-2 p-2">
          <p className="px-1 text-[11px] text-muted">
            Not in the Columns list yet? These are real fields NAV can carry that Atlas doesn&apos;t track today —
            request one and it goes to Ayaan to review.
          </p>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search NAV fields…"
            className="rounded-lg border-2 border-border bg-transparent px-2 py-1 text-xs outline-none focus:border-accent"
          />
          <div className="flex max-h-80 flex-col gap-0.5 overflow-y-auto">
            {visible.length === 0 ? (
              <p className="px-1.5 py-1 text-xs text-muted">No matches.</p>
            ) : (
              visible.map((field) => {
                const isRequested = requested.has(field);
                const isPending = pending === field;
                const hasError = errorField === field;
                return (
                  <div key={field} className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-xs hover:bg-surface-secondary">
                    <span className="flex-1 truncate">{field}</span>
                    {isRequested ? (
                      <span className="text-success">Requested ✓</span>
                    ) : (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleRequest(field)}
                        className="rounded-lg border-2 border-border px-2 py-0.5 text-accent hover:bg-accent/10 disabled:opacity-50"
                      >
                        {isPending ? "Requesting…" : hasError ? "Retry" : "Request"}
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </Dropdown.Popover>
    </Dropdown.Root>
  );
}
