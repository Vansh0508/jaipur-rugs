import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient, type CookieAdapter } from "@jaipur-rugs/auth";
import { env } from "./lib/env";

// Named `proxy` (not `middleware`) per Next.js 16 — the file convention was renamed to
// better reflect its purpose; behavior and API are unchanged.
//
// Stricter than feedback-app's proxy.ts: internal-portal has no guest path at all, and a
// valid session only proves "logged in," never "authorized for THIS app" (AGENTS.md
// Section 5). So on top of the session check, every gated request also re-verifies the
// caller is an active employee holding a department_access_grants row on the 'admin'
// department at access_level 'admin' — the same primitive as
// private.is_internal_portal_admin (db/journeys/003_journey_admin_helpers_and_write_functions.sql).
//
// There's no Hub launcher to bounce back to yet, so unauthenticated/unauthorized users
// land on this app's own /login instead — swap to a Hub redirect once apps/hub exists.
export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request: { headers: request.headers } });

  // Let the force-logout route itself run unimpeded — it's the only way an
  // authenticated-but-unauthorized session actually gets cleared. Re-running the checks
  // below against this same path would just redirect right back to itself.
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

  const isLoginPage = request.nextUrl.pathname.startsWith("/login");

  if (!user) {
    return isLoginPage ? response : NextResponse.redirect(new URL("/login", request.url));
  }

  const { data: employee } = await supabase
    .from("employees")
    .select("id, status")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const isActiveEmployee = Boolean(employee) && employee!.status === "active";

  let isAuthorized = false;
  if (isActiveEmployee) {
    const { data: grant } = await supabase
      .from("department_access_grants")
      .select("id, departments!inner(code)")
      .eq("employee_id", employee!.id)
      .eq("access_level", "admin")
      .eq("departments.code", "admin")
      .maybeSingle();
    isAuthorized = Boolean(grant);
  }

  if (!isAuthorized) {
    return NextResponse.redirect(new URL("/api/force-logout?reason=not_authorized", request.url));
  }

  if (isLoginPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
