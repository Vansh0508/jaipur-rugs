import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient, type CookieAdapter } from "@jaipur-rugs/auth";
import { env } from "./lib/env";

// Named `proxy` (not `middleware`) per Next.js 16. Same posture as
// apps/admin/internal-portal/proxy.ts: a valid session only proves "logged in"; every
// gated request also re-verifies the caller is an ACTIVE employee. There's no department
// or role gate for plain use (PRD Section 8.5) — admin-only surfaces re-check the
// `cad_layout.admin` permission themselves in the shell layout / route handlers.
export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request: { headers: request.headers } });

  if (request.nextUrl.pathname.startsWith("/api/force-logout")) {
    return response;
  }

  // /signup: a brand-new person has no session by definition, so it needs the same
  // unauthenticated-visitor exemption /login gets below. (Atlas shipped /signup without
  // this and the page 307'd straight back to /login for everyone.)
  if (request.nextUrl.pathname.startsWith("/signup")) {
    return response;
  }

  // /reset-password: a visitor arriving from the emailed recovery link IS technically
  // authenticated the moment the page exchanges its code for a session — getUser() below
  // would succeed — but the active-employee check has nothing to do with "can this person
  // set a new password", and would force-logout them (e.g. no employee row yet) before
  // they ever see the form. Exempt unconditionally, same reasoning as /signup.
  if (request.nextUrl.pathname.startsWith("/reset-password")) {
    return response;
  }

  const cookieAdapter: CookieAdapter = {
    get: (name) => request.cookies.get(name)?.value,
    set: (name, value, options) => response.cookies.set(name, value, options),
    remove: (name, options) => response.cookies.set(name, "", { ...options, maxAge: 0 }),
  };

  const supabase = createSupabaseServerClient(env.supabaseUrl, env.supabaseAnonKey, cookieAdapter, env.rootDomain, env.secureCookies);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoginPage = request.nextUrl.pathname.startsWith("/login");

  if (!user) {
    if (isLoginPage) return response;
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "not authenticated" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { data: employee } = await supabase
    .from("employees")
    .select("id, status")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!employee || employee.status !== "active") {
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "not authorized" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/api/force-logout?reason=not_authorized", request.url));
  }

  if (isLoginPage) {
    return NextResponse.redirect(new URL("/new", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
