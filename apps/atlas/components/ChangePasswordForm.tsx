"use client";

import { useState } from "react";
import { Button, TextField } from "@jaipur-rugs/ui-kit";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient.browser";

// Self-service password change for an already-signed-in account — the counterpart to
// the forgot-password flow on /login (LoginForm.tsx/reset-password's own page), added
// the same day, 2026-09-19, direct request: "reset password option in my account page."
//
// No "current password" field — Supabase's updateUser() only needs an active session to
// change a password, it doesn't re-verify the old one, and asking for it here would
// imply a check that never actually happens.
export function ChangePasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(false);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    const supabase = getBrowserSupabaseClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setPassword("");
    setConfirmPassword("");
    setSuccess(true);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl border-2 border-border p-5">
      <h2 className="text-sm font-semibold uppercase text-muted">Change your password</h2>
      <p className="text-xs text-muted">Takes effect immediately — you&apos;ll use the new password next time you sign in.</p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <TextField label="New password" type="password" value={password} onChange={setPassword} isRequired fullWidth />
        </div>
        <div className="flex-1">
          <TextField
            label="Confirm new password"
            type="password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            isRequired
            fullWidth
          />
        </div>
        <Button type="submit" isPending={submitting}>
          Update password
        </Button>
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {success ? <p className="text-sm text-success">Password updated.</p> : null}
    </form>
  );
}
