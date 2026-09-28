"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, TextField } from "@jaipur-rugs/ui-kit";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient.browser";

/**
 * Handles a Supabase Auth recovery link and lets the visitor set a new password. Ported
 * from apps/atlas/app/reset-password/ResetPasswordForm.tsx — it already covers both link
 * shapes Supabase can send, which isn't something to re-derive:
 *   1. A `?code=` query param (PKCE) — must be exchanged for a session explicitly;
 *      nothing does this automatically on page load.
 *   2. An `#access_token=...&type=recovery` URL hash (implicit flow) — supabase-js parses
 *      this itself on initialization and fires a "PASSWORD_RECOVERY" auth event once it
 *      does, so this just listens for that rather than parsing the hash.
 * Whichever one establishes the session, the visitor lands on the same form either way.
 */
export function ResetPasswordForm({ code, urlError, urlErrorDescription }: { code?: string; urlError?: string; urlErrorDescription?: string }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(
    // Supabase sends the recovery link's own failure here rather than to /reset-password
    // succeeding — e.g. `?error=access_denied&error_code=otp_expired` for an expired link,
    // or (the suspected cause as of 2026-09-28) a `redirect_to` the project's Auth ->
    // URL Configuration -> Redirect URLs allow-list doesn't include, which Supabase
    // reports as `?error=requested_path_is_invalid`. Surfacing the real message here beats
    // everyone guessing from a generic timeout.
    urlError ? (urlErrorDescription ? decodeURIComponent(urlErrorDescription.replace(/\+/g, " ")) : `Reset link error: ${urlError}`) : null,
  );
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // The implicit-flow failure case arrives as a URL *hash* (`#error=...`), which is
    // never sent to the server and so can't come in as a prop — only visible here.
    if (typeof window !== "undefined" && window.location.hash.includes("error=")) {
      const hashParams = new URLSearchParams(window.location.hash.slice(1));
      const hashError = hashParams.get("error_description") || hashParams.get("error");
      if (hashError) setLinkError(decodeURIComponent(hashError.replace(/\+/g, " ")));
    }
  }, []);

  useEffect(() => {
    if (urlError) return; // already showing the real reason; don't overwrite with the generic one
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
      // that resolves asynchronously on the client's own initialization, not necessarily
      // before this effect's first tick.
      setTimeout(() => {
        if (!settled) {
          setLinkError("This reset link is invalid or has expired. Request a new one from the sign-in page.");
        }
      }, 1500);
    }
    establishSession();

    return () => sub.subscription.unsubscribe();
  }, [code, urlError]);

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
