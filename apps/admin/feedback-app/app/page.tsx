import { redirect } from "next/navigation";

// The middleware is the real auth gate (AGENTS.md Section 5) — this route is just the
// landing redirect; unauthenticated users get bounced to /login by the middleware itself.
export default function RootPage() {
  redirect("/drivers");
}
