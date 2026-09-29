import { NextResponse } from "next/server";
import { authenticateDemo, DEMO_COOKIE, demoCookieValue, hasDemoAccounts } from "@/lib/demoAuth";
import { env } from "@/lib/env";

export async function POST(request: Request) {
  if (!env.demoMode) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const body = await request.json() as { username?: string; password?: string };
  if (!hasDemoAccounts()) return NextResponse.json({ error: "No logins are set up on this server yet (data/demo-accounts.json)." }, { status: 503 });
  const session = authenticateDemo(body.username ?? "", body.password ?? "");
  if (!session) return NextResponse.json({ error: "Incorrect username or password." }, { status: 401 });
  const response = NextResponse.json({ session });
  // Secure only over https: on a plain-http office server (http://192.168.x.x) browsers drop Secure cookies, so a
  // build-time flag left at its default would make every login bounce back to /login.
  const https = new URL(request.url).protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
  response.cookies.set(DEMO_COOKIE, demoCookieValue(session.username), { httpOnly: true, sameSite: "lax", path: "/", secure: https && env.secureCookies });
  return response;
}
