// Best-effort Slack post via the `atlas_slack_webhook_url` Vault secret (see
// db/user-activity/003_slack_notifications.sql — the URL itself is never in this repo,
// only its name; `get_atlas_slack_webhook_url()` is service-role-only, matching how every
// other write function here already reads a service-role client rather than a trusted
// app-side secret).
//
// Never throws: a Slack outage, a revoked webhook, or a missing secret must not fail the
// real operation (account creation, sign-in) this is just announcing. Callers should
// `await` it after their real write has already succeeded, never before.
// deno-lint-ignore no-explicit-any
export async function notifySlack(supabaseAdmin: any, text: string): Promise<void> {
  try {
    const { data: webhookUrl } = await supabaseAdmin.rpc("get_atlas_slack_webhook_url");
    if (!webhookUrl) return;
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch {
    // Best-effort only — see header comment.
  }
}
