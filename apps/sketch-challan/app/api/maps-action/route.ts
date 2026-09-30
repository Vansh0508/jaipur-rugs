import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { DEMO_COOKIE, getDemoSession } from "@/lib/demoAuth";
import { env } from "@/lib/env";
import { applyMapAction } from "@/lib/maps/choose";
import { updateMaps } from "@/lib/maps/mapsStore";
import type { MapAction } from "@/lib/maps/types";

// Tick / untick a map copy (rack management ticks, admin unticks). The same rules run in the browser first.
export async function POST(request: Request) {
  if (!env.demoMode) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const session = getDemoSession((await cookies()).get(DEMO_COOKIE)?.value);
  if (session?.role !== "admin" && session?.role !== "rack") return NextResponse.json({ error: "Only rack management and admins use the Maps screen." }, { status: 403 });
  const role = session.role;
  const action = await request.json() as MapAction;
  try {
    const state = await updateMaps((current) => {
      const next = applyMapAction(current, action, role, new Date().toISOString());
      return { state: next, result: next };
    });
    return NextResponse.json({ chosen: state.chosen ?? [] });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not save." }, { status: 400 });
  }
}
