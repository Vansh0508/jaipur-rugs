"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, TextField } from "@jaipur-rugs/ui-kit";
import { addOwnSalespersonCodes } from "@jaipur-rugs/db-management-client";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient.browser";
import { parseCodeList } from "@/lib/parseCodeList";

// Self-service, always the caller's own account (see salesperson-codes-add's comment).
// No approval step (explicit product decision, 2026-09-02) — a submitted code is live
// immediately, not a pending request.
export function AddSalespersonCodesForm() {
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
      await addOwnSalespersonCodes(supabase, codes);
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
      <h2 className="text-sm font-semibold uppercase text-muted">Add a sales code</h2>
      <p className="text-xs text-muted">
        Takes effect immediately — you&apos;ll see every order under this code the next time you load Orders.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <TextField
            label="Sales code(s)"
            placeholder="e.g. SALES-0039 — or paste a whole list, any format"
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
