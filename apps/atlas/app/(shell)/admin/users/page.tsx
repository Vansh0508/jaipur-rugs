import { redirect } from "next/navigation";
import { getServerSupabaseClient } from "@/lib/supabaseClient.server";
import { requireAtlasStaffAccess } from "@/lib/auth/requireAtlasStaffAccess";
import { listUserActivity, summarizeUserActivity } from "@/lib/queries/userActivity";
import { DashboardStat } from "@/components/DashboardStat";

// Admin-only sign-in/session analytics (db/user-activity/001_login_sessions.sql). Unlike
// Merchants/RugLens (RLS alone decides what a non-admin sees), this hard-redirects
// non-admins — staff activity data reads differently from "your list came back empty."
export default async function UserManagementPage() {
  const supabase = await getServerSupabaseClient();
  const access = await requireAtlasStaffAccess(supabase);
  if (!access.isAdmin) {
    redirect("/dashboard");
  }

  const rows = await listUserActivity(supabase);
  const summary = summarizeUserActivity(rows);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">User Management</h1>
        <p className="text-sm text-muted">
          Who&rsquo;s signed in to Atlas, when, and how long they&rsquo;ve spent — every active employee who can sign
          in, not just admins.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardStat label="Users tracked" value={summary.totalUsers} />
        <DashboardStat label="Online now" value={summary.onlineNow} />
        <DashboardStat label="Active in last 7 days" value={summary.activeLast7Days} />
        <DashboardStat label="Avg. session length" value={Math.round(summary.avgSessionSeconds / 60)} suffix=" min" />
      </div>

      <div className="overflow-x-auto rounded-xl border-2 border-border">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b-2 border-border text-xs uppercase text-muted">
              <th className="px-4 py-3 font-medium">Employee</th>
              <th className="px-4 py-3 font-medium">Department</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Last sign-in</th>
              <th className="px-4 py-3 font-medium">Last active</th>
              <th className="px-4 py-3 font-medium">Sessions</th>
              <th className="px-4 py-3 font-medium">Total time</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.employeeId} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <div className="font-medium text-foreground">{row.fullName}</div>
                  <div className="text-xs text-muted">{row.employeeCode}</div>
                </td>
                <td className="px-4 py-3">{row.departmentName ?? "—"}</td>
                <td className="px-4 py-3">
                  {row.isOnline ? (
                    <span className="inline-flex items-center gap-1.5 text-success">
                      <span className="h-2 w-2 rounded-full bg-success" />
                      Online
                    </span>
                  ) : (
                    <span className="text-muted">Offline</span>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(row.lastSignInAt)}</td>
                <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(row.lastActiveAt)}</td>
                <td className="px-4 py-3">{row.totalSessions}</td>
                <td className="px-4 py-3">{formatDuration(row.totalSeconds)}</td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td className="px-4 py-6 text-center text-muted" colSpan={7}>
                  No active employees with sign-in access yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatDateTime(value: string | null): string {
  if (!value) return "Never";
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(totalSeconds: number): string {
  if (totalSeconds <= 0) return "—";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.round((totalSeconds % 3600) / 60);
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}
