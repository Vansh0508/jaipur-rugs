"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, TextField } from "@jaipur-rugs/ui-kit";
import { addOwnCustomerCodes } from "@jaipur-rugs/db-management-client";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient.browser";
import { parseCodeList } from "@/lib/parseCodeList";

// The customer-code counterpart to AddSalespersonCodesForm, added 2026-09-10 alongside
// registering "Back Ops" as a real department. Same self-service posture: always the
// caller's own account, no approval step, effective immediately. Use this for an ERP
// customer number (e.g. "24523", "34836") — the sales-code form above it is for a
// salesperson code (e.g. "SALES-0039") instead; pasting a customer number into that one
// silently went nowhere, which is the bug this was built to fix.
export function AddCustomerCodesForm() {
  const router = useRouter();
  const [codesRaw, setCodesRaw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const codes = parseCodeList(codesRaw);
    if (!codes.length) {
      setError("Enter at least one code.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const supabase = getBrowserSupabaseClient();
      await addOwnCustomerCodes(supabase, codes);
      setCodesRaw("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add this code.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl border-2 border-border p-5">
      <h2 className="text-sm font-semibold uppercase text-muted">Add a customer code</h2>
      <p className="text-xs text-muted">
        For an ERP customer number, not a sales code — e.g. 24523 or 34836. Takes effect immediately.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <TextField
            label="Customer code(s)"
            placeholder="e.g. 34836 — or paste a whole list, any format"
            value={codesRaw}
            onChange={setCodesRaw}
            isRequired
            fullWidth
          />
        </div>
        <Button type="submit" isPending={submitting}>
          Add
        </Button>
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </form>
  );
}
