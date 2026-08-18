import { redirect } from "next/navigation";

// proxy.ts is the real auth gate (AGENTS.md Section 5) — this route is just the landing
// redirect; unauthenticated users get bounced to /login by proxy.ts itself.
export default function RootPage() {
  redirect("/dashboard");
}
