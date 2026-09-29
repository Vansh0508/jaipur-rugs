import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { DEMO_COOKIE, getDemoSession } from "@/lib/demoAuth";
import { env } from "@/lib/env";
import { applyMapAction } from "@/lib/maps/actions";
import { updateMaps } from "@/lib/maps/mapsStore";
import type { MapAction } from "@/lib/maps/types";

export async function POST(request: Request) {
  if (!env.demoMode) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const session = getDemoSession((await cookies()).get(DEMO_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Sign in again." }, { status: 401 });
  const action = await request.json() as MapAction;
  try {
    const order = await updateMaps((state) => {
      const current = state.orders.find((item) => item.id === action.id);
      if (!current) throw new Error("Order not found. Reload the page.");
      const next = applyMapAction(current, action, session, new Date().toISOString(), state.orders);
      return { state: { ...state, orders: state.orders.map((item) => item.id === next.id ? next : item) }, result: next };
    });
    return NextResponse.json({ order });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save." }, { status: 400 });
  }
}
