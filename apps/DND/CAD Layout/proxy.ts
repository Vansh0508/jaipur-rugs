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
