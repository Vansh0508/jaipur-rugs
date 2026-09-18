import { redirect } from "next/navigation";
import { getServerSupabaseClient } from "@/lib/supabaseClient.server";
import { requireCadLayoutAccess } from "@/lib/auth/requireCadLayoutAccess";

interface UsageRow {
  employee_id: string;
  full_name: string;
  email: string;
  layouts_count: number;
  layouts_last_30_days: number;
  last_layout_at: string | null;
}

// Admin-only "who is using the tool and how much" (PRD 4.2 item 7). Reads
// cad_layout_usage_view (db/cad-layout/001) — until that migration is applied the query
// fails and the page says so instead of rendering an empty table.
export default async function AdminUsagePage() {
  const supabase = await getServerSupabaseClient();
  const employee = await requireCadLayoutAccess(supabase);
  if (!employee.isAdmin) redirect("/new");

  const { data, error } = await supabase
    .from("cad_layout_usage_view")
    .select("employee_id, full_name, email, layouts_count, layouts_last_30_days, last_layout_at")
    .order("layouts_count", { ascending: false });
  const rows = (data ?? []) as UsageRow[];

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Usage</h1>
        <p className="mt-1 text-sm text-muted">Layouts generated per designer, across everyone.</p>
      </div>
      {error ? (
        <p className="rounded-lg border-2 border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          Usage data isn&apos;t available yet: {error.message}. The cad-layout database module has to be applied first
          (db/cad-layout/001_cad_layout_schema.sql).
        </p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted">No layouts saved yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-2 py-1">Designer</th>
              <th className="px-2 py-1">Email</th>
              <th className="px-2 py-1 text-right">Total</th>
              <th className="px-2 py-1 text-right">Last 30 days</th>
              <th className="px-2 py-1">Last layout</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.employee_id} className="border-t border-border">
                <td className="px-2 py-2 font-medium text-foreground">{r.full_name}</td>
                <td className="px-2 py-2 text-muted">{r.email}</td>
                <td className="px-2 py-2 text-right tabular-nums">{r.layouts_count}</td>
                <td className="px-2 py-2 text-right tabular-nums">{r.layouts_last_30_days}</td>
                <td className="px-2 py-2 text-muted">{r.last_layout_at ? new Date(r.last_layout_at).toLocaleString() : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
