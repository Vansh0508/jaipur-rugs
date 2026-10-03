import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient, type CookieAdapter } from "@jaipur-rugs/auth";
import { env } from "./lib/env";

/**
 * Named `proxy`, not `middleware`, per Next.js 16 — same as apps/hub/proxy.ts.
 *
 * The session is always refreshed, so `currentEmployee()` works in every route and pins
 * save the moment someone is signed in. Only the REDIRECT is gated, by JRGPT_REQUIRE_AUTH:
 * off on localhost so the app opens without a mailbox, on once hosted. That keeps the
 * plumbing identical in both modes, so nothing gets retrofitted when the flag flips.
 *
 * The dual check is deliberate and matches AGENTS.md Section 5: a valid session proves
 * "signed in", never "allowed here". Hub owns who is an active employee; JRGPT re-checks it.
 */
export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request: { headers: request.headers } });

  const cookieAdapter: CookieAdapter = {
    get: (name) => request.cookies.get(name)?.value,
    set: (name, value, options) => response.cookies.set(name, value, options),
    remove: (name, options) => response.cookies.set(name, "", { ...options, maxAge: 0 }),
  };

  const supabase = createSupabaseServerClient(
    env.supabaseUrl,
    env.supabaseAnonKey,
    cookieAdapter,
    env.rootDomain,
    env.secureCookies,
  );

  // Always refresh — this is what keeps the shared cookie alive across hub/analytics/jrgpt.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!env.requireAuth) return response;

  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith("/login")) return response;

  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  // Signed in is not the same as allowed. An inactive or unknown employee is sent back to
  // Hub, which is where access is actually granted.
  const { data: employee } = await supabase
    .from("employees")
    .select("id, status")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!employee || employee.status !== "active") {
    return NextResponse.redirect(new URL("/login?reason=not_authorized", request.url));
  }

  return response;
}

export const config = {
  // Everything except Next's own assets. API routes ARE included: they must not be an
  // unauthenticated side door once the gate is on.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
