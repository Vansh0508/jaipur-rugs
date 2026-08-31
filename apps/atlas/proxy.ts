import { NextResponse, type NextRequest } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { createSupabaseServerClient, type CookieAdapter } from "@jaipur-rugs/auth";
import { env } from "./lib/env";

// Named `proxy` (not `middleware`) per Next.js 16 — see apps/hub/proxy.ts's comment.
//
// Atlas is the first app in this repo with two independent auth systems in one proxy:
// staff (Supabase Auth via packages/auth, same as every other app) under everything
// except /merchant/*, and merchants (Clerk, AGENTS.md's recorded override) under
// /merchant/*. clerkMiddleware() has to wrap the whole handler for Clerk's auth()/
// useAuth() to work anywhere in the app — it does NOT redirect anything on its own
// unless a route explicitly calls auth.protect(), so the staff branch below runs exactly
// as it would if Clerk weren't involved at all.
//
// KNOWN VALIDATION GAP: written against Clerk's documented Next.js App Router
// middleware API; this session had no way to actually run `next dev`/`next build`
// against it (see AGENTS.md's recorded override for the full list of things that need
// a real deploy to confirm, including Clerk's SDK compatibility with this repo's
// Next ^16.3.1).
const isMerchantRoute = createRouteMatcher(["/merchant(.*)"]);

export default clerkMiddleware(async (_clerkAuth, request: NextRequest) => {
  if (isMerchantRoute(request)) {
    // Clerk's own components (<SignedIn>/<SignedOut>/redirectToSignIn in
    // app/merchant/(shell)/layout.tsx) handle the actual gate for this branch — nothing
    // further needed here.
    return NextResponse.next();
  }

  return staffProxy(request);
});

async function staffProxy(request: NextRequest): Promise<NextResponse> {
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
    return isLoginPage ? response : NextResponse.redirect(new URL("/login", request.url));
  }

  const { data: employee } = await supabase
    .from("employees")
    .select("id, status, salesperson_code, primary_role_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const isActiveEmployee = Boolean(employee) && employee!.status === "active";
  if (!isActiveEmployee) {
    return NextResponse.redirect(new URL("/api/force-logout?reason=not_authorized", request.url));
  }

  // Coarse "any reason to be in Atlas at all" check, mirroring
  // lib/auth/requireAtlasStaffAccess.ts's fuller version (which the (shell) layout also
  // runs — AGENTS.md Section 5's dual-check). Kept intentionally light here: middleware
  // runs on every request, so this skips the department_access_grants join and only
  // rules out the unambiguous "definitely not authorized" case (no salesperson code and
  // no permission row at all); the layout's fuller check is the real gate.
  const { data: permissionRow } = await supabase.from("permissions").select("id").eq("key", "orders.read.all").maybeSingle();
  let hasOrdersReadAll = false;
  if (permissionRow && employee!.primary_role_id) {
    const { data: viaPrimaryRole } = await supabase
      .from("role_permissions")
      .select("id")
      .eq("role_id", employee!.primary_role_id)
      .eq("permission_id", permissionRow.id)
      .maybeSingle();
    hasOrdersReadAll = Boolean(viaPrimaryRole);
  }
  const { data: anyAtlasGrant } = await supabase
    .from("department_access_grants")
    .select("id, departments!inner(code)")
    .eq("employee_id", employee!.id)
    .in("departments.code", ["production", "shipping", "sales"])
    .maybeSingle();

  const isAuthorized = hasOrdersReadAll || Boolean(anyAtlasGrant) || Boolean(employee!.salesperson_code);
  if (!isAuthorized) {
    return NextResponse.redirect(env.hubUrl ?? new URL("/login", request.url));
  }

  if (isLoginPage) {
    return NextResponse.redirect(new URL("/orders", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
