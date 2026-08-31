"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, TextField } from "@jaipur-rugs/ui-kit";
import { inviteMerchant } from "@jaipur-rugs/db-management-client";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient.browser";

// Does not create a Clerk account — see merchants-invite's own comment. The merchant
// simply signs in/up at /merchant/login with this same email, and
// merchants-link-clerk-account matches them to the row this creates.
export function InviteMerchantForm() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [customerNosRaw, setCustomerNosRaw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const customerNos = customerNosRaw
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
    if (!customerNos.length) {
      setError("Enter at least one customer number, comma-separated.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const supabase = getBrowserSupabaseClient();
      await inviteMerchant(supabase, { displayName, primaryContactEmail: email, customerNos });
      setDisplayName("");
      setEmail("");
      setCustomerNosRaw("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add this merchant.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-xl border-2 border-border p-5">
      <h2 className="text-sm font-semibold uppercase text-muted">Add merchant</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <TextField label="Display name" value={displayName} onChange={setDisplayName} isRequired />
        <TextField label="Contact email" type="email" value={email} onChange={setEmail} isRequired />
        <TextField
          label="Customer No.(s)"
          placeholder="34836, 7333"
          value={customerNosRaw}
          onChange={setCustomerNosRaw}
          isRequired
        />
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <div>
        <Button type="submit" isPending={submitting}>
          Add merchant
        </Button>
      </div>
    </form>
  );
}
