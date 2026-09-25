"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { resolveColumnRequest } from "@jaipur-rugs/db-management-client";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient.browser";
import type { ColumnRequestWithRequester } from "@/lib/queries/orders";
import { displayDate } from "@/lib/displayDate";

/** Admin Approve/Decline for pending "add this NAV column" requests — direct request,
 * 2026-09-14 ("admin will approve it"): there was no real approve action before this,
 * just a plain list. Approving records the decision immediately but does NOT make the
 * field live on its own — see orders-resolve-column-request's own comment for why
 * actually adding it still needs a real migration + an orders-sync.mjs update, not
 * something this button can safely automate for a live, every-30-minute ERP sync.
 * `router.refresh()` after each action re-runs the server component's queries, so an
 * approved/declined request drops out of this list (and, for approvals, would show up
 * in the "approved, not yet built" list if this page renders one) without a full reload. */
export function ColumnRequestAdminList({ requests }: { requests: ColumnRequestWithRequester[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);

  async function handleDecision(requestId: string, decision: "approved" | "declined") {
    setPendingId(requestId);
    setErrorId(null);
    try {
      const supabase = getBrowserSupabaseClient();
      await resolveColumnRequest(supabase, { requestId, decision });
      router.refresh();
    } catch {
      setErrorId(requestId);
    } finally {
      setPendingId(null);
    }
  }

  if (!requests.length) {
    return <p className="text-sm text-muted">No pending requests.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {requests.map((req) => {
        const isPending = pendingId === req.id;
        return (
          <li
            key={req.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border-2 border-border px-3 py-2 text-sm"
          >
            <div>
              <span className="font-medium text-foreground">{req.nav_field_name}</span>
              <span className="ml-2 text-xs text-muted">
                requested by {req.requester_name ?? "unknown"} · {displayDate(req.created_at)}
              </span>
              {errorId === req.id ? <div className="text-xs text-danger">Couldn&apos;t save — try again.</div> : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleDecision(req.id, "approved")}
                className="rounded-lg border-2 border-success/40 px-2.5 py-1 text-xs font-medium text-success hover:bg-success/10 disabled:opacity-50"
              >
                {isPending ? "…" : "Approve"}
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleDecision(req.id, "declined")}
                className="rounded-lg border-2 border-border px-2.5 py-1 text-xs font-medium text-muted hover:bg-surface-secondary disabled:opacity-50"
              >
                {isPending ? "…" : "Decline"}
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
