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

  // Forgot-password mode — added 2026-09-19, direct request. Swaps the same card over
  // to ForgotPasswordForm rather than a separate route, so "back to sign in" is just
  // flipping this flag, no navigation/loading state to manage.
  const [showForgotPassword, setShowForgotPassword] = useState(false);

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

  if (showForgotPassword) {
    return <ForgotPasswordForm onBack={() => setShowForgotPassword(false)} initialEmail={email} />;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <TextField label="Email" type="email" value={email} onChange={setEmail} isRequired autoFocus fullWidth />
      <TextField label="Password" type="password" value={password} onChange={setPassword} isRequired fullWidth />
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <Button type="submit" isPending={submitting} fullWidth>
        Sign in
      </Button>
      <button
        type="button"
        onClick={() => setShowForgotPassword(true)}
        className="self-center text-sm text-accent hover:underline"
      >
        Forgot password?
      </button>
    </form>
  );
}

/** Sends a real Supabase Auth recovery email — same mechanism, same 5-app shared user
 * base as sign-in itself (AGENTS.md Section 5), nothing Atlas-specific to configure.
 * Deliberately reports success even when Supabase itself would report "no user found
 * for that email" (resetPasswordForEmail's own response never distinguishes the two,
 * by design — an error here would let anyone probe which emails have accounts). The
 * link in that email points at /reset-password?next=/orders on this same origin. */
function ForgotPasswordForm({ onBack, initialEmail }: { onBack: () => void; initialEmail: string }) {
  const [email, setEmail] = useState(initialEmail);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const supabase = getBrowserSupabaseClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSubmitting(false);

    // A real send failure (bad request, rate limit) is worth showing — "no account with
    // that email" is not (see header comment), and Supabase's own response already
    // doesn't distinguish the two cases in resetError.
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-foreground">
          If an account exists for <span className="font-medium">{email}</span>, we&apos;ve sent a link to reset the
          password. Check that inbox — it can take a minute to arrive.
        </p>
        <button type="button" onClick={onBack} className="self-center text-sm text-accent hover:underline">
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <p className="text-sm text-muted">Enter your email and we&apos;ll send you a link to reset your password.</p>
      <TextField label="Email" type="email" value={email} onChange={setEmail} isRequired autoFocus fullWidth />
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <Button type="submit" isPending={submitting} fullWidth>
        Send reset link
      </Button>
      <button type="button" onClick={onBack} className="self-center text-sm text-accent hover:underline">
        Back to sign in
      </button>
    </form>
  );
}
