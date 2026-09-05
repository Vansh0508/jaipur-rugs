import Link from "next/link";
import { getServerSupabaseClient } from "@/lib/supabaseClient.server";
import { listDelayAlerts } from "@/lib/queries/alerts";

interface Recipient {
  role: string;
  name: string;
  email: string | null;
}

// The delay-alert outbox — real business requirement confirmed directly in a recorded
// meeting with a sales team member (2026-09-05): once an order's current stage runs
// longer than its standard TAT, whoever's responsible should be told, automatically,
// not by someone remembering to check. The actual email-send step isn't wired up yet
// (needs a real email service connected — see db/orders/012_delay_alerts.sql's
// comment); until then, every alert this catches lands here so it's still usable —
// someone can read it and forward it by hand in the meantime, same as the live-preview
// prototype's own dry-run Alerts outbox did.
export default async function AlertsPage() {
  const supabase = await getServerSupabaseClient();
  const alerts = await listDelayAlerts(supabase);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Alerts</h1>
        <p className="text-sm text-muted">
          Orders whose current stage has run longer than its standard turnaround time — {alerts.length} shown.
          Not sent by email yet (see note below); read the recipients and body, and forward by hand for now.
        </p>
      </div>

      {!alerts.length ? (
        <p className="rounded-xl border-2 border-border p-8 text-center text-sm text-muted">
          No delay alerts right now.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {alerts.map((alert) => {
            const recipients = (alert.recipients as unknown as Recipient[]) ?? [];
            return (
              <div key={alert.id} className="flex flex-col gap-2 rounded-xl border-2 border-border p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-foreground">{alert.subject}</p>
                  {alert.orders ? (
                    <Link href={`/orders/${alert.order_id}`} className="text-sm text-accent hover:underline">
                      Open order →
                    </Link>
                  ) : null}
                </div>
                <p className="text-xs text-muted">
                  {alert.standard_days}d standard · {alert.pending_days}d so far · {alert.overdue_by_days}d over ·{" "}
                  {new Date(alert.created_at).toLocaleString()}
                </p>
                <div className="flex flex-wrap gap-2">
                  {recipients.map((r, i) => (
                    <span
                      key={i}
                      className={
                        "rounded-full border-2 px-2 py-0.5 text-xs " +
                        (r.email ? "border-border text-foreground" : "border-danger/40 text-danger")
                      }
                    >
                      {r.role}: {r.name}
                      {r.email ? "" : " (no email on file)"}
                    </span>
                  ))}
                  <span className="rounded-full border-2 border-danger/40 px-2 py-0.5 text-xs text-danger">
                    sales backend: not resolvable yet
                  </span>
                </div>
                <pre className="whitespace-pre-wrap rounded-lg bg-surface-secondary p-3 text-xs text-foreground">{alert.body}</pre>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
