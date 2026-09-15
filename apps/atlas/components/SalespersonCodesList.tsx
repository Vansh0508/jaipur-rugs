"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { removeOwnSalespersonCode } from "@jaipur-rugs/db-management-client";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient.browser";

/** Renders the caller's own sales codes with a remove control on each — the undo for
 * AddSalespersonCodesForm, added 2026-09-15. Before this, a code added by mistake
 * (someone else's code, a malformed duplicate) had no way to come back off the account. */
export function SalespersonCodesList({ codes }: { codes: string[] }) {
  const router = useRouter();
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  async function handleRemove(code: string) {
    setPendingCode(code);
    setErrorCode(null);
    try {
      const supabase = getBrowserSupabaseClient();
      await removeOwnSalespersonCode(supabase, code);
      router.refresh();
    } catch {
      setErrorCode(code);
    } finally {
      setPendingCode(null);
    }
  }

  if (!codes.length) {
    return <p className="text-sm text-muted">No sales codes added yet.</p>;
  }

  return (
    <ul className="flex flex-wrap gap-2">
      {codes.map((code) => {
        const isPending = pendingCode === code;
        return (
          <li
            key={code}
            className="flex items-center gap-2 rounded-lg border-2 border-border px-3 py-1.5 text-sm text-foreground"
          >
            <span>{code}</span>
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleRemove(code)}
              aria-label={`Remove sales code ${code}`}
              className="text-muted hover:text-danger disabled:opacity-50"
            >
              {isPending ? "…" : "✕"}
            </button>
            {errorCode === code ? <span className="text-xs text-danger">Couldn&apos;t remove — try again.</span> : null}
          </li>
        );
      })}
    </ul>
  );
}
