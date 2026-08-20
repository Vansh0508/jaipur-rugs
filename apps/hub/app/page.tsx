import { redirect } from "next/navigation";

// proxy.ts already resolved auth/onboarding state before any request reaches here — the
// shell layout (app/(shell)/layout.tsx) does the real re-check when /profile renders.
// This route has no content of its own; "home" is the profile page.
export default function RootPage() {
  redirect("/profile");
}
