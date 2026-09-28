import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If Supabase environment variables are missing, don't break developer flow
  if (!supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // IMPORTANT: getUser() securely verifies the JWT token with the Supabase Auth server
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isLoginPage = pathname.startsWith("/login");
  const isAuthCallback = pathname.startsWith("/auth/callback");
  const isPublicApi =
    pathname.startsWith("/api/bom") ||
    pathname.startsWith("/api/benchmarks") ||
    pathname.startsWith("/api/design-series");

  // If unauthenticated and trying to access protected routes, redirect to /login
  if (!user && !isLoginPage && !isAuthCallback && !isPublicApi) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // A valid Supabase Auth session is not enough on its own — only employees who
  // are actually on the org's employee directory (Hub's `employees` table, shared
  // across the whole org's Supabase project) and currently active may use the app.
  // This is a real employee's own row (RLS: auth_user_id = auth.uid()), not a
  // separate whitelist — see AGENTS.md Section 3, RLS is the only access boundary.
  if (user && !isLoginPage && !isAuthCallback && !isPublicApi) {
    const { data: employee, error: employeeError } = await supabase
      .from("employees")
      .select("status")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    // Fail closed only on a clear answer (no row / inactive), not on a transient
    // query error — an outage shouldn't lock every employee out of the app.
    if (!employeeError && employee?.status !== "active") {
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("blocked", "1");
      return NextResponse.redirect(url);
    }
  }

  // If authenticated and trying to access /login, redirect to main app /
  if (user && isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
