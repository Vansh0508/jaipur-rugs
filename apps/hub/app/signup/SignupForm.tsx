"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, TextField } from "@jaipur-rugs/ui-kit";
import { employeeSignUp } from "@jaipur-rugs/db-management-client";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient.browser";

export function SignupForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const supabase = getBrowserSupabaseClient();
    try {
      // employee-signup creates the auth.users row itself (Admin API) and claims/creates
      // the matching employees row — it never establishes a session, so signing in right
      // after with the same credentials is what actually satisfies "auto-login on first
      // sign-up," not something implicit in the signup call.
      await employeeSignUp(supabase, { fullName, email, password });

      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setSubmitting(false);
        setError(signInError.message);
        return;
      }

      router.push("/onboarding");
      router.refresh();
    } catch (err) {
      setSubmitting(false);
      setError(err instanceof Error ? err.message : "Could not create your account. Please try again.");
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
