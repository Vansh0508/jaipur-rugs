"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, TextField } from "@jaipur-rugs/ui-kit";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient.browser";

// Same Supabase Auth users as every other app (AGENTS.md Section 5 — one shared org,
// one shared session cookie scoped to .jaipurrugs.com). This form doesn't create
// accounts — staff sign up once via Hub; signing in here just proves the same identity
// on Atlas's own subdomain (or on localhost during dev, where the cookie can't be shared
// across ports at all).
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

    // proxy.ts re-verifies Atlas authorization server-side on the very next request this
    // navigation triggers, and redirects to the Hub launcher if this account has no
    // reason to be in Atlas at all.
    router.push("/orders");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <TextField label="Email" type="email" value={email} onChange={setEmail} isRequired autoFocus fullWidth />
      <TextField label="Password" type="password" value={password} onChange={setPassword} isRequired fullWidth />
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <Button type="submit" isPending={submitting} fullWidth>
        Sign in
      </Button>
    </form>
  );
}
