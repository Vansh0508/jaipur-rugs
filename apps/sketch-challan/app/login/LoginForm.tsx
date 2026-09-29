"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, TextField } from "@jaipur-rugs/ui-kit";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient.browser";

export function LoginForm({ demoMode = false }: { demoMode?: boolean }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    if (demoMode) {
      const response = await fetch("/api/demo-login", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }),
      });
      if (!response.ok) {
        const body = await response.json() as { error?: string };
        setSubmitting(false); setError(body.error ?? "Could not sign in.");
        return;
      }
      router.push("/"); router.refresh();
      return;
    }
    const { error: signInError } = await getBrowserSupabaseClient().auth.signInWithPassword({ email: username, password });
    if (signInError) {
      setSubmitting(false);
      setError(signInError.message);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <TextField label={demoMode ? "Username" : "Email"} type={demoMode ? "text" : "email"} value={username} onChange={setUsername} isRequired autoFocus fullWidth />
      <TextField label="Password" type="password" value={password} onChange={setPassword} isRequired fullWidth />
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <Button type="submit" isPending={submitting} fullWidth>Sign in</Button>
    </form>
  );
}
