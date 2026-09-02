import { redirect } from "next/navigation";

// There was never a page at "/" itself — only /login, /signup, and the (shell) routes
// under /orders etc. An unauthenticated visit to "/" is caught by proxy.ts and bounced
// to /login before it gets here, but a signed-in visit to bare "/" (typing the server's
// IP directly, an old bookmark) passed every proxy check and then had nothing to render
// at all, showing Next's built-in 404 page instead of taking the person anywhere useful.
// Confirmed live 2026-09-02. This page exists purely to send a signed-in visit
// somewhere real; proxy.ts's own authorization check runs again on the way to /orders,
// so this doesn't widen access.
export default function RootPage() {
  redirect("/orders");
}
