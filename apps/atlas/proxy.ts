import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient, type CookieAdapter } from "@jaipur-rugs/auth";
import { env } from "./lib/env";

// Named `proxy` (not `middleware`) per Next.js 16 — see apps/hub/proxy.ts's comment.
//
// One auth system only — Supabase Auth via packages/auth, same as every other app.
// Atlas briefly had a second, Clerk-based login under /merchant/* for what were assumed
// to be external customers; consolidated back onto Supabase Auth 2026-09-01 once it
// became clear "merchant" actually means an internal Jaipur Rugs salesperson/territory
// head (B2B team), not an outside party — there was never a real reason for two login
// systems. See requireAtlasStaffAccess.ts's comment for the fuller authorization check
// this mirrors a lighter version of.
export default async function proxy(request: NextRequest): Promise<NextResponse> {
  // Lets the (shell) layout's requireAtlasStaffAccess() know which page it's gating —
  // needed only so /my-access can exempt itself from the "must already have access"
  // redirect further down (see isMyAccessPage below). Must be set on the REQUEST
  // headers (not the response's) to actually reach Server Components via headers() —
  // a layout has no other standard way to read the current path in the App Router.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);
  const response = NextResponse.next({ request: { headers: requestHeaders } });

  if (request.nextUrl.pathname.startsWith("/api/force-logout")) {
    return response;
  }

  // /signup needs the same unauthenticated-visitor exemption as /login below — a
  // brand-new person has no session by definition. Missed when /signup was added
  // (2026-09-02); caught because the page 307'd straight back to /login for everyone.
  if (request.nextUrl.pathname.startsWith("/signup")) {
    return response;
  }

  // /my-access is exempt from the isAuthorized redirect below (not from the session/
  // active-employee checks) — it's the one page whose whole job is letting someone with
  // NO access yet grant themselves a salesperson code, so it can't itself require access
  // to reach. See db/orders/010_salesperson_codes_self_service.sql.
  const isMyAccessPage = request.nextUrl.pathname.startsWith("/my-access");

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
    return isLoginPage ? response : NextResponse.redirect(new URL("/login", request.url));
  }

  const { data: employee } = await supabase
    .from("employees")
    .select("id, status, primary_role_id")
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
    .in("departments.code", ["production", "shipping", "sales", "management"])
    .maybeSingle();

  // Territory heads/B2B salespeople ("merchant" in this business's own vocabulary) hold
  // no department grant — they're scoped to specific ERP customer codes instead. See
  // requireAtlasStaffAccess.ts's fuller comment.
  const { data: anyCustomerCodeGrant } = await supabase
    .from("merchant_customer_codes")
    .select("id")
    .eq("employee_id", employee!.id)
    .limit(1)
    .maybeSingle();

  // Self-service salesperson codes (db/orders/010) — a plain salespeople, scoped to
  // whichever ERP salesperson code(s) they've added themselves from /my-access.
  const { data: anySalespersonCode } = await supabase
    .from("employee_salesperson_codes")
    .select("id")
    .eq("employee_id", employee!.id)
    .limit(1)
    .maybeSingle();

  const isAuthorized = hasOrdersReadAll || Boolean(anyAtlasGrant) || Boolean(anyCustomerCodeGrant) || Boolean(anySalespersonCode);
  if (isMyAccessPage) {
    return response;
  }
  if (!isAuthorized) {
    // 2026-09-10: this used to bounce to `env.hubUrl ?? "/login"`. Hub has never been
    // deployed anywhere reachable, so in production that's always "/login" — and for a
    // visitor already headed to /login (the normal case right after signing up, before
    // adding a sales code/department) it used to just render the login page again with
    // no explanation, since a prior fix (2026-09-02) special-cased isLoginPage to avoid
    // an infinite /login -> /login redirect. Net effect for a brand-new sales signup who
    // skipped the code field: sign-in "succeeds" every time, Atlas silently dumps them
    // back at the sign-in screen, and there was no page telling them why or how to fix
    // it — indistinguishable from sign-in being broken. Real fix: /my-access is exactly
    // the self-service page for this (exempted above), so send them there instead of
    // anywhere that's a dead end. Safe from the old loop by construction — /my-access
    // itself already returned above.
    return NextResponse.redirect(new URL("/my-access?welcome=1", request.url));
  }

  if (isLoginPage) {
    return NextResponse.redirect(new URL("/orders", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
