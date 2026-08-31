import { NextResponse, type NextRequest } from "next/server";
import { getServerSupabaseClient } from "@/lib/supabaseClient.server";

// Same reasoning as apps/hub's force-logout route: a Server Component can't clear
// cookies mid-render, so this Route Handler signs out (clearing the session cookie) and
// *then* redirects, avoiding the "authenticated + on /login -> bounce forward" loop.
export async function GET(request: NextRequest) {
  const supabase = await getServerSupabaseClient();
  await supabase.auth.signOut();

  const reason = request.nextUrl.searchParams.get("reason") ?? "not_authorized";
  return NextResponse.redirect(new URL(`/login?error=${reason}`, request.url));
}
