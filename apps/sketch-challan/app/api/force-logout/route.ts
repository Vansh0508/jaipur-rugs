import { NextResponse, type NextRequest } from "next/server";
import { getServerSupabaseClient } from "@/lib/supabaseClient.server";

export async function GET(request: NextRequest) {
  const supabase = await getServerSupabaseClient();
  await supabase.auth.signOut();
  const reason = request.nextUrl.searchParams.get("reason") ?? "not_authorized";
  return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(reason)}`, request.url));
}