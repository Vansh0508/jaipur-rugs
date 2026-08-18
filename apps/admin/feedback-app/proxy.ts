import { NextResponse, type NextRequest } from "next/server";
import { GUEST_ID_COOKIE, EMPLOYEE_ID_COOKIE } from "./lib/authCookies";

// Named `proxy` (not `middleware`) per Next.js 16 — the file convention was renamed to
// better reflect its purpose; behavior and API are unchanged.
//
// Neither guests nor employees are Supabase Auth users in this app (see
// supabase/functions/{guest-signup,employee-signin}) — both log in via a plain
// match-or-create/match-only lookup and are remembered by a cookie, not a session. So
// this cookie check is the *entire* access gate; there's no real Supabase session path
// left to also check. There's no Hub launcher to bounce back to yet, so unauthenticated
// requests land on this app's own /login instead — swap to a Hub redirect once apps/hub
// exists.
export function proxy(request: NextRequest) {
  const isAuthenticated = Boolean(
    request.cookies.get(GUEST_ID_COOKIE)?.value || request.cookies.get(EMPLOYEE_ID_COOKIE)?.value,
  );

  const isLoginPage = request.nextUrl.pathname.startsWith("/login");

  if (!isAuthenticated && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (isAuthenticated && isLoginPage) {
    return NextResponse.redirect(new URL("/drivers", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
