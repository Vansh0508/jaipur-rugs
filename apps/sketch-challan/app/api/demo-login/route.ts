import { NextResponse } from "next/server";
import { authenticate, DEMO_COOKIE, demoCookieValue, hasDemoAccounts } from "@/lib/demoAuth";
import { env } from "@/lib/env";

export async function POST(request: Request) {
  if (!env.demoMode) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const body = await request.json() as { username?: string; password?: string };
  if (!hasDemoAccounts()) return NextResponse.json({ error: "No logins are set up on this server yet (data/demo-accounts.json)." }, { status: 503 });
  let session;
  try { session = await authenticate(String(body.username ?? ""), String(body.password ?? "")); }
  catch { return NextResponse.json({ error: "The sign-in server isn't answering. Try again in a minute." }, { status: 503 }); }
  if (session === "no-access") return NextResponse.json({ error: "Your account isn't set up for Sketch Challan yet. Ask the admin to add you." }, { status: 403 });
  if (!session) return NextResponse.json({ error: env.authUrl && !env.authEmailDomain ? "Incorrect email or password." : env.authEmailDomain ? "Incorrect employee code or password." : "Incorrect username or password." }, { status: 401 });
  const response = NextResponse.json({ session });
  // Secure only over https: on a plain-http office server (http://192.168.x.x) browsers drop Secure cookies, so a
  // build-time flag left at its default would make every login bounce back to /login.
  const https = new URL(request.url).protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
  response.cookies.set(DEMO_COOKIE, demoCookieValue(session.username), { httpOnly: true, sameSite: "lax", path: "/", secure: https && env.secureCookies });
  return response;
}
