import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient, type CookieAdapter } from "@jaipur-rugs/auth";
import { env } from "./lib/env";

// Named `proxy` (not `middleware`) per Next.js 16 — see apps/admin/internal-portal/proxy.ts's
// comment for why. Three checks, same dual-check philosophy as Internal Portal's own gate
// (AGENTS.md Section 5): session -> active employee -> onboarding complete. Unlike Internal
// Portal, Hub *is* the thing unauthenticated/incomplete users get sent to (there's no
// launcher above it), so /login and /signup are real destinations, not placeholders.
export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request: { headers: request.headers } });

  // Let force-logout run unimpeded — it's the only way an authenticated-but-unauthorized
  // session actually gets cleared. Re-running the checks below against this same path
  // would just redirect right back to itself.
  if (request.nextUrl.pathname.startsWith("/api/force-logout")) {
    return response;
  }

  const cookieAdapter: CookieAdapter = {
    get: (name) => request.cookies.get(name)?.value,
    set: (name, value, options) => response.cookies.set(name, value, options),
    remove: (name, options) => response.cookies.set(name, "", { ...options, maxAge: 0 }),
  };

  const supabase = createSupabaseServerClient(env.supabaseUrl, env.supabaseAnonKey, cookieAdapter, env.rootDomain);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isAuthPage = pathname.startsWith("/login") || pathname.startsWith("/signup");
  const isOnboardingPage = pathname.startsWith("/onboarding");

  if (!user) {
    return isAuthPage ? response : NextResponse.redirect(new URL("/login", request.url));
  }

  const { data: employee } = await supabase
    .from("employees")
    .select("id, status, onboarding_completed_at")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const isActiveEmployee = Boolean(employee) && employee!.status === "active";
  if (!isActiveEmployee) {
    return NextResponse.redirect(new URL("/api/force-logout?reason=not_authorized", request.url));
  }

  const onboardingComplete = Boolean(employee!.onboarding_completed_at);

  if (!onboardingComplete) {
    return isOnboardingPage ? response : NextResponse.redirect(new URL("/onboarding", request.url));
  }

  if (isAuthPage || isOnboardingPage) {
    return NextResponse.redirect(new URL("/profile", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
