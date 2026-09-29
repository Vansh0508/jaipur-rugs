import { loadRows } from "@/lib/demoStore";
import { env } from "@/lib/env";
import { listSketchChallans } from "@/lib/queries/challans";
import { getServerSupabaseClient } from "@/lib/supabaseClient.server";
import { requireSketchChallanAccess } from "@/lib/auth/requireSketchChallanAccess";
import { SketchChallanWorkspace } from "@/components/SketchChallanWorkspace";
import { cookies } from "next/headers";
import { DEMO_COOKIE, getDemoSession } from "@/lib/demoAuth";
import { redirect } from "next/navigation";
import { rowsForSketcher } from "@/lib/domain/assignments";
import { loadMaps } from "@/lib/maps/mapsStore";
import { RackView } from "@/components/RackView";

export default async function HomePage() {
  if (env.demoMode) {
    const session = getDemoSession((await cookies()).get(DEMO_COOKIE)?.value);
    if (!session) redirect("/login");
    // Maps are for Admin and the rack management login only; rack management sees nothing else.
    if (session.role === "rack") return <RackView initialMaps={await loadMaps()} name={session.name} />;
    // Filter on the server so other sketchers' rows never reach a sketcher's browser.
    const stored = await loadRows();
    const rows = session.role === "sketcher" ? rowsForSketcher(stored, session.sketcherName ?? "") : stored;
    const maps = session.role === "admin" ? await loadMaps() : { orders: [] };
    return <SketchChallanWorkspace initialChallans={rows} initialMaps={maps} user={{ ...session, role: session.role }} demoMode />;
  }
  // Supabase mode: the role comes from the Hub role bindings (RLS already limits a sketcher's rows). Saving from
  // the screens is not wired to the Edge Functions yet, so the workspace opens read-only (db/sketch-challan/README.md).
  const supabase = await getServerSupabaseClient();
  const access = await requireSketchChallanAccess(supabase);
  const role = access.roleKeys.includes("sketching_manager") ? "manager" : access.roleKeys.includes("admin") ? "admin" : "sketcher";
  const challans = await listSketchChallans(supabase);
  const user = { name: access.fullName, role, sketcherName: role === "admin" ? undefined : access.fullName } as const;
  return <SketchChallanWorkspace initialChallans={challans} initialMaps={{ orders: [] }} user={user} demoMode={false} />;
}
