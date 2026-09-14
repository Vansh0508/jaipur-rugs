"use client";

import { useState } from "react";
import { requestOrdersColumn } from "@jaipur-rugs/db-management-client";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient.browser";
import { REQUESTABLE_NAV_FIELDS } from "@/lib/requestableNavFields";

/** Self-service "Request a Column" — moved here from OrdersTable.tsx's settings
 * dropdown, 2026-09-14 (direct request: "in my access page they can request the
 * coloumns to the admin from a search and dropdown option there"). Browse the full
 * ~180-field NAV catalog that ISN'T in Atlas's `orders` table yet
 * (lib/requestableNavFields.ts, verified live against the real NAV-002 view — see
 * db/orders/021_nav_full_field_expansion.sql's header) and ask for one — lands in
 * orders_column_requests for an admin to approve/decline on this same page (see
 * ColumnRequestAdminList.tsx below), and only approved fields actually get built in,
 * one at a time — see db/orders/022_column_requests.sql's header for why that stays a
 * real dev step rather than something a click can safely automate. */
export function RequestColumnForm() {
  const [query, setQuery] = useState("");
  const [requested, setRequested] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<string | null>(null);
  const normalizedQuery = query.trim().toLowerCase();
  const visible = normalizedQuery
    ? REQUESTABLE_NAV_FIELDS.filter((f) => f.toLowerCase().includes(normalizedQuery))
    : REQUESTABLE_NAV_FIELDS;

  async function handleRequest(navFieldName: string) {
    setPending(navFieldName);
    try {
      const supabase = getBrowserSupabaseClient();
      await requestOrdersColumn(supabase, navFieldName);
      setRequested((prev) => new Set(prev).add(navFieldName));
    } catch {
      // Swallowed — the button just stays clickable so the person can retry, matching
      // this app's other lightweight self-service forms' no-fuss error handling.
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border-2 border-border p-5">
      <div>
        <h2 className="text-sm font-semibold uppercase text-muted">Request a Column</h2>
        <p className="mt-1 text-sm text-muted">
          Not in the Orders table&apos;s Columns list yet? These are real fields NAV can carry that Atlas
          doesn&apos;t track today — search, request one, and it goes to an admin to approve.
        </p>
      </div>
      <select
        value=""
        onChange={(e) => {
          if (e.target.value) handleRequest(e.target.value);
        }}
        className="rounded-lg border-2 border-border bg-transparent px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
      >
        <option value="" disabled>
          Pick a field to request…
        </option>
        {REQUESTABLE_NAV_FIELDS.filter((f) => !requested.has(f)).map((field) => (
          <option key={field} value={field}>
            {field}
          </option>
        ))}
      </select>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Or search NAV fields…"
        className="rounded-lg border-2 border-border bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted outline-none focus:border-accent"
      />
      <div className="flex max-h-64 flex-col gap-0.5 overflow-y-auto">
        {visible.length === 0 ? (
          <p className="px-1 py-2 text-sm text-muted">No matches.</p>
        ) : (
          visible.map((field) => {
            const isRequested = requested.has(field);
            const isPending = pending === field;
            return (
              <div key={field} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-secondary">
                <span className="flex-1 truncate text-foreground">{field}</span>
                {isRequested ? (
                  <span className="text-xs font-medium text-success">Requested ✓</span>
                ) : (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleRequest(field)}
                    className="shrink-0 rounded-lg border-2 border-border px-2 py-0.5 text-xs text-accent hover:bg-accent/10 disabled:opacity-50"
                  >
                    {isPending ? "Requesting…" : "Request"}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
