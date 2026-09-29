import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient, type CookieAdapter } from "@jaipur-rugs/auth";
import { env } from "./lib/env";
import { DEMO_COOKIE, getDemoSession } from "./lib/demoAuth";

// API calls get a JSON 401 (the screens show its message); pages go to the login page.
function signIn(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/")) return NextResponse.json({ error: "Your sign-in has expired. Sign in again." }, { status: 401 });
  return NextResponse.redirect(new URL("/login", request.url));
}

export default async function proxy(request: NextRequest) {
  if (env.demoMode) {
    if (request.nextUrl.pathname.startsWith("/login") || request.nextUrl.pathname.startsWith("/api/demo-login") || request.nextUrl.pathname.startsWith("/api/demo-logout")) return NextResponse.next();
    if (!getDemoSession(request.cookies.get(DEMO_COOKIE)?.value)) return signIn(request);
    return NextResponse.next();
  }
  const headers = new Headers(request.headers);
  const response = NextResponse.next({ request: { headers } });
  if (request.nextUrl.pathname.startsWith("/login") || request.nextUrl.pathname.startsWith("/api/force-logout")) return response;
  const adapter: CookieAdapter = {
    get: (name) => request.cookies.get(name)?.value,
    set: (name, value, options) => response.cookies.set(name, value, options),
    remove: (name, options) => response.cookies.set(name, "", { ...options, maxAge: 0 }),
  };
  const supabase = createSupabaseServerClient(env.supabaseUrl, env.supabaseAnonKey, adapter, env.rootDomain, env.secureCookies);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return signIn(request);
  const { data: employee } = await supabase.from("employees").select("id,status,primary_role_id").eq("auth_user_id", user.id).maybeSingle();
  if (!employee || employee.status !== "active") return NextResponse.redirect(new URL("/api/force-logout?reason=not_authorized", request.url));
  const today = new Date().toISOString().slice(0, 10);
  const { data: assigned } = await supabase.from("employee_roles").select("role_id,valid_to").eq("employee_id", employee.id).lte("valid_from", today);
  const roleIds = [employee.primary_role_id, ...((assigned ?? []) as { role_id: string; valid_to: string | null }[])
    .filter((row) => !row.valid_to || row.valid_to >= today).map((row) => row.role_id)].filter(Boolean) as string[];
  const { data: bindings } = roleIds.length
    ? await supabase.from("sketch_challan_role_bindings").select("role_id").in("role_id", roleIds).limit(1)
    : { data: [] };
  if (!bindings?.length) return NextResponse.redirect(new URL("/api/force-logout?reason=not_authorized", request.url));
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
