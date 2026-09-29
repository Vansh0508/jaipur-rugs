import { NextResponse } from "next/server";
import { DEMO_COOKIE } from "@/lib/demoAuth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(DEMO_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}
