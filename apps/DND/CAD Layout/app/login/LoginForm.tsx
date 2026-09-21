"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, TextField } from "@jaipur-rugs/ui-kit";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient.browser";

// Same Supabase Auth users as every other app in the org (AGENTS.md Section 5) — an
// account made here works on Atlas and Hub too, and vice versa.
export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Swaps this same card over rather than navigating, so "back to sign in" is just a flag
  // flip — same approach as Atlas's login page.
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

    router.push("/new");
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
      <p className="self-center text-sm text-muted">
        No account yet?{" "}
        <Link href="/signup" className="text-accent hover:underline">
          Create one
        </Link>
      </p>
    </form>
  );
}

/**
 * Sends a real Supabase Auth recovery email — same mechanism and same shared user base as
 * sign-in itself, nothing app-specific to configure. Reports success even when no account
 * exists for that address: `resetPasswordForEmail` deliberately doesn't distinguish the
 * two, and surfacing the difference would let anyone probe which emails have accounts.
 * The emailed link lands on /reset-password on this same origin.
 */
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

    // A real send failure (bad request, rate limit) is worth showing; "no account with
    // that email" is not — and Supabase's response doesn't distinguish them anyway.
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
