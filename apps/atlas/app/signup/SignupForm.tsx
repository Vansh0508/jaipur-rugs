"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, TextField } from "@jaipur-rugs/ui-kit";
import { employeeSignUp } from "@jaipur-rugs/db-management-client";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient.browser";

// A real, working sign-up page directly on Atlas — the login page's original "Create
// your account via Hub" link pointed at Hub (apps/hub), which has never actually been
// deployed anywhere reachable, so that link 404'd for everyone. Rather than keep
// working around that by hand (a PowerShell one-liner calling employee-signup
// directly) every time someone new needs an account, this wraps the same
// already-existing employee-signup function in a real form. Creating an account here
// doesn't grant Atlas access by itself — an admin still has to add a department grant,
// salesperson_code, or customer-code grant afterward (see requireAtlasStaffAccess.ts) —
// it just means nobody needs a terminal to get that far.
export function SignupForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

      // proxy.ts re-verifies Atlas authorization on the very next request and bounces
      // to the Hub launcher if this brand-new account has no reason to be in Atlas yet
      // (no department/salesperson/customer-code grant) — expected for anyone who just
      // signed up and hasn't been granted access yet.
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
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <Button type="submit" isPending={submitting} fullWidth>
        Create account
      </Button>
    </form>
  );
}
