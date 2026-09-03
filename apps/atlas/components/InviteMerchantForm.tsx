"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, TextField } from "@jaipur-rugs/ui-kit";
import { grantCustomerCodes } from "@jaipur-rugs/db-management-client";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient.browser";
import { parseCodeList } from "@/lib/parseCodeList";

// "Merchant" here means a territory head/B2B salesperson (Ayaan's correction,
// 2026-09-01) — an existing employee, not someone this form creates an account for.
// They must already have signed up via Hub/employee-signup; this only grants them
// visibility into specific ERP customer codes.
export function InviteMerchantForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [customerNosRaw, setCustomerNosRaw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const customerNos = parseCodeList(customerNosRaw);
    if (!customerNos.length) {
      setError("Enter at least one customer number.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const supabase = getBrowserSupabaseClient();
      await grantCustomerCodes(supabase, { employeeEmail: email, customerNos });
      setEmail("");
      setCustomerNosRaw("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not grant this access.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-xl border-2 border-border p-5">
      <h2 className="text-sm font-semibold uppercase text-muted">Grant customer-code access</h2>
      <p className="text-xs text-muted">The employee must already have a Jaipur Rugs staff account (signed up via Hub).</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField label="Employee email" type="email" value={email} onChange={setEmail} isRequired />
        <TextField
          label="Customer No.(s)"
          placeholder="34836, 7333 — or paste a whole pasted list, any format"
          value={customerNosRaw}
          onChange={setCustomerNosRaw}
          isRequired
        />
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <div>
        <Button type="submit" isPending={submitting}>
          Grant access
        </Button>
      </div>
    </form>
  );
}
