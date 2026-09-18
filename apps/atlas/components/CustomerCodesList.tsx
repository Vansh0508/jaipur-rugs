"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { removeOwnCustomerCode } from "@jaipur-rugs/db-management-client";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient.browser";

/** Renders the caller's own customer codes with a remove control on each — the undo for
 * AddCustomerCodesForm, added 2026-09-15. Same rationale as SalespersonCodesList. */
export function CustomerCodesList({ codes }: { codes: string[] }) {
  const router = useRouter();
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  async function handleRemove(code: string) {
    setPendingCode(code);
    setErrorCode(null);
    try {
      const supabase = getBrowserSupabaseClient();
      await removeOwnCustomerCode(supabase, code);
      router.refresh();
    } catch {
      setErrorCode(code);
    } finally {
      setPendingCode(null);
    }
  }

  if (!codes.length) {
    return <p className="text-sm text-muted">No customer codes added yet.</p>;
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
              aria-label={`Remove customer code ${code}`}
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
