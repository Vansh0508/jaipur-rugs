"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, TextField } from "@jaipur-rugs/ui-kit";
import { employeeSignUp } from "@jaipur-rugs/db-management-client";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient.browser";

/**
 * Wraps the shared `employee-signup` Edge Function — the same one Atlas and Hub sign up
 * through, so an account created here is the org-wide one, not a CAD-Layout-only login.
 *
 * Simpler than Atlas's equivalent on purpose: Atlas has to collect a department and
 * sales/customer codes because its order visibility is scoped by them. CAD Layout is open
 * to any active employee (see lib/auth/requireCadLayoutAccess.ts), so name + email +
 * password is genuinely all that's needed — the function creates the row `status: 'active'`
 * (and flips an existing `invited` row to active), which is exactly what this app gates on.
 */
export function SignupForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!fullName.trim()) {
      setError("Please enter your full name.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      const supabase = getBrowserSupabaseClient();
      await employeeSignUp(supabase, { email, password, fullName: fullName.trim() });

      // employee-signup never establishes a session itself (see its own comment) — sign in
      // immediately with the same credentials, the same way Atlas and Hub do.
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setSubmitting(false);
        setError("Account created, but automatic sign-in failed — try signing in manually.");
        return;
      }

      router.push("/new");
      router.refresh();
    } catch (err) {
      setSubmitting(false);
      setError(err instanceof Error ? err.message : "Could not create the account.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <TextField label="Full name" value={fullName} onChange={setFullName} isRequired autoFocus fullWidth />
      <TextField label="Email" type="email" value={email} onChange={setEmail} isRequired fullWidth />
      <TextField label="Password" type="password" value={password} onChange={setPassword} isRequired fullWidth />
      <TextField
        label="Confirm password"
        type="password"
        value={confirmPassword}
        onChange={setConfirmPassword}
        isRequired
        fullWidth
      />
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <Button type="submit" isPending={submitting} fullWidth>
        Create account
      </Button>
    </form>
  );
}
