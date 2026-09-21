"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, TextField } from "@jaipur-rugs/ui-kit";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient.browser";

/** Handles a Supabase Auth recovery link and lets the visitor set a new password.
 * Defensively covers both real link shapes Supabase can send, since which one this
 * project's Auth email template actually uses isn't something to guess at:
 *   1. A `?code=` query param (PKCE) — must be exchanged for a session explicitly;
 *      nothing does this automatically on page load.
 *   2. An `#access_token=...&type=recovery` URL hash (implicit flow) — the underlying
 *      supabase-js client parses this itself on initialization and fires a real
 *      "PASSWORD_RECOVERY" auth event once it does; no hash-parsing code needed here,
 *      just listening for that event.
 * Whichever one actually establishes a session, the visitor lands on the same "set a
 * new password" form either way. */
export function ResetPasswordForm({ code }: { code?: string }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const supabase = getBrowserSupabaseClient();
    let settled = false;

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        settled = true;
        setReady(true);
      }
    });

    async function establishSession() {
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
          settled = true;
          setReady(true);
          return;
        }
      }
      // Already resolved (a re-render, or the hash-based case landed before this ran)?
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        settled = true;
        setReady(true);
        return;
      }
      // Give onAuthStateChange a moment for the hash-based case before calling it dead —
      // that one resolves asynchronously on the client's own initialization, not
      // necessarily before this effect's first tick.
      setTimeout(() => {
        if (!settled) {
          setLinkError("This reset link is invalid or has expired. Request a new one from the sign-in page.");
        }
      }, 1500);
    }
    establishSession();

    return () => sub.subscription.unsubscribe();
  }, [code]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (password.length < 8) {
      setFormError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setFormError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    const supabase = getBrowserSupabaseClient();
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (error) {
      setFormError(error.message);
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-foreground">Your password has been reset. You can sign in with it now.</p>
        <Button onPress={() => router.push("/login")} fullWidth>
          Go to sign in
        </Button>
      </div>
    );
  }

  if (linkError) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-danger">{linkError}</p>
        <Button onPress={() => router.push("/login")} fullWidth variant="secondary">
          Back to sign in
        </Button>
      </div>
    );
  }

  if (!ready) {
    return <p className="text-center text-sm text-muted">Checking your reset link…</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <TextField label="New password" type="password" value={password} onChange={setPassword} isRequired autoFocus fullWidth />
      <TextField
        label="Confirm new password"
        type="password"
        value={confirmPassword}
        onChange={setConfirmPassword}
        isRequired
        fullWidth
      />
      {formError ? <p className="text-sm text-danger">{formError}</p> : null}
      <Button type="submit" isPending={submitting} fullWidth>
        Set new password
      </Button>
    </form>
  );
}
