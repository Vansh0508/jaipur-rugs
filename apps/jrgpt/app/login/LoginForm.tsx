"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, TextField } from "@jaipur-rugs/ui-kit";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient.browser";

/**
 * Email + password, the same credentials as Hub — the session cookie is shared, so signing
 * in here signs you in across every app. Account creation is deliberately NOT here: Hub
 * owns the `employees` record and the onboarding flow, and duplicating that would create a
 * second source of truth for who works at the company.
 */
export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const supabase = getBrowserSupabaseClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setSubmitting(false);
      setError(signInError.message);
      return;
    }

    // proxy.ts re-checks active employee status on the very next request, so there is no
    // client-side branching to duplicate here.
    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <TextField label="Email" type="email" value={email} onChange={setEmail} isRequired autoFocus fullWidth />
      <TextField label="Password" type="password" value={password} onChange={setPassword} isRequired fullWidth />
      {error ? <p className="text-small text-danger">{error}</p> : null}
      <Button type="submit" isPending={submitting} fullWidth>
        Sign in
      </Button>
    </form>
  );
}
