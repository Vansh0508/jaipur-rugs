import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { applyAction, type ChallanAction } from "@/lib/domain/actions";
import { rowsForSketcher } from "@/lib/domain/assignments";
import { DEMO_COOKIE, getDemoSession } from "@/lib/demoAuth";
import { updateRows } from "@/lib/demoStore";
import { env } from "@/lib/env";

export async function POST(request: Request) {
  if (!env.demoMode) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const session = getDemoSession((await cookies()).get(DEMO_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Sign in again." }, { status: 401 });
  // Rack management only looks at the Maps screen; it never touches challans.
  if (session.role === "rack") return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const user = { ...session, role: session.role };
  const action = await request.json() as ChallanAction;
  try {
    const row = await updateRows((rows) => {
      const current = rows.find((item) => item.id === action.id);
      if (!current) throw new Error("Challan not found. Reload the page.");
      const next = applyAction(current, action, user, new Date().toISOString());
      return { rows: rows.map((item) => item.id === next.id ? next : item), result: next };
    });
    // A sketcher only ever gets back their own slice of the row.
    const visible = session.role === "sketcher" ? rowsForSketcher([row], session.sketcherName ?? "")[0] : row;
    return NextResponse.json({ row: visible });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save." }, { status: 400 });
  }
}
