"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, TextField, Select } from "@jaipur-rugs/ui-kit";
import {
  employeeSignUp,
  addOwnSalespersonCodes,
  joinOwnDepartment,
  type SelfServiceDepartmentCode,
} from "@jaipur-rugs/db-management-client";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient.browser";
import { parseCodeList } from "@/lib/parseCodeList";

// A real, working sign-up page directly on Atlas — the login page's original "Create
// your account via Hub" link pointed at Hub (apps/hub), which has never actually been
// deployed anywhere reachable, so that link 404'd for everyone. Rather than keep
// working around that by hand (a PowerShell one-liner calling employee-signup
// directly) every time someone new needs an account, this wraps the same
// already-existing employee-signup function in a real form.
//
// Department picker added 2026-09-05 — self-service, no admin step needed for any of
// these three: Sales reveals the sales-code field (unchanged, see
// db/orders/010_salesperson_codes_self_service.sql — there's no reliable way to derive
// a name<->code mapping from the ERP feed, so a person types in their own already-known
// code); Management/Production instead call join-department, which grants blanket
// order-visibility ("see everything, same as admin, no customer-code binding" — explicit
// product decision) at the lowest access level, never admin-level capability. NAV/QC
// Review/Shipping aren't offered yet ("will come in later stage," same decision).
// Picking nothing at all still creates a working account — it just won't see any
// orders in Atlas until a department or code is added, from here or later from
// /my-access.
type SignupDepartment = "" | SelfServiceDepartmentCode | "sales";

const DEPARTMENT_OPTIONS = [
  { id: "management", label: "Management" },
  { id: "sales", label: "Sales" },
  { id: "production", label: "Production" },
];

export function SignupForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [department, setDepartment] = useState<SignupDepartment>("");
  const [salespersonCodesRaw, setSalespersonCodesRaw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      const supabase = getBrowserSupabaseClient();
      await employeeSignUp(supabase, { email, password, fullName });

      // employee-signup never establishes a session itself (see its own comment) —
      // sign in immediately with the same credentials, same as Hub's flow.
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setSubmitting(false);
        setError("Account created, but automatic sign-in failed — try signing in manually.");
        return;
      }

      // Best-effort from here on — the account already exists and is signed in, so a
      // failure in either of these shouldn't undo the sign-up; worst case, they add the
      // same thing later from /my-access instead.
      if (department === "sales") {
        const codes = parseCodeList(salespersonCodesRaw);
        if (codes.length) {
          try {
            await addOwnSalespersonCodes(supabase, codes);
          } catch {
            // swallowed deliberately — see comment above.
          }
        }
      } else if (department === "management" || department === "production") {
        try {
          await joinOwnDepartment(supabase, department);
        } catch {
          // swallowed deliberately — see comment above.
        }
      }

      // proxy.ts re-verifies Atlas authorization on the very next request and bounces
      // to the Hub launcher if this brand-new account has no reason to be in Atlas yet
      // (no department/salesperson-code/customer-code grant) — expected for anyone who
      // picked nothing and hasn't been granted access yet.
      router.push("/orders");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create this account.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <TextField label="Full name" value={fullName} onChange={setFullName} isRequired autoFocus fullWidth />
      <TextField label="Email" type="email" value={email} onChange={setEmail} isRequired fullWidth />
      <TextField label="Password" type="password" value={password} onChange={setPassword} isRequired fullWidth />
      <Select
        label="Department"
        items={DEPARTMENT_OPTIONS}
        value={department || null}
        onChange={(value) => setDepartment((value as SignupDepartment) ?? "")}
        placeholder="Choose your department"
        fullWidth
      />
      {department === "sales" ? (
        <TextField
          label="Your sales code(s)"
          placeholder="e.g. SALES-0039 — or paste a whole list"
          value={salespersonCodesRaw}
          onChange={setSalespersonCodesRaw}
          fullWidth
        />
      ) : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <Button type="submit" isPending={submitting} fullWidth>
        Create account
      </Button>
    </form>
  );
}
