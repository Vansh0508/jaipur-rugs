import { NextResponse, type NextRequest } from "next/server";
import { getServerSupabaseClient } from "@/lib/supabaseClient.server";

// A Server Component/layout can't clear cookies mid-render, so redirecting straight to
// /login from there while leaving the session cookie intact would let proxy.ts's own
// "authenticated + on /login -> bounce to /dashboard" rule immediately redirect right
// back in — an infinite loop. This Route Handler has cookie-write access, so it signs
// out (clearing the session cookie) and *then* redirects, so the next proxy.ts pass sees
// no session and lets the request land on /login cleanly.
export async function GET(request: NextRequest) {
  const supabase = await getServerSupabaseClient();
  await supabase.auth.signOut();

  const reason = request.nextUrl.searchParams.get("reason") ?? "not_authorized";
  return NextResponse.redirect(new URL(`/login?error=${reason}`, request.url));
}
