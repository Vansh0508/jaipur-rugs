import { NextResponse, type NextRequest } from "next/server";
import { getServerSupabaseClient } from "@/lib/supabaseClient.server";

// A Server Component can't clear cookies mid-render; this handler signs out (clearing the
// session cookie) and then redirects, so the next proxy.ts pass lands on /login cleanly
// instead of bouncing an authenticated-but-unauthorized session back and forth.
export async function GET(request: NextRequest) {
  const supabase = await getServerSupabaseClient();
  await supabase.auth.signOut();

  const reason = request.nextUrl.searchParams.get("reason") ?? "not_authorized";
  return NextResponse.redirect(new URL(`/login?error=${reason}`, request.url));
}
