-- Backs Slack notifications for two admin-requested events (Ayaan, 2026-09-28): a new
-- Atlas account being created, and an existing employee logging in. Both are posted from
-- Edge Function code (employee-signup, login-sessions-start), not from Postgres — this
-- migration only adds the plumbing that lets those functions read the webhook URL
-- without it ever being committed to the repo.
--
-- The webhook URL itself lives in Supabase Vault (`vault.create_secret`, run directly via
-- execute_sql — NOT in this file, so it never touches git) under the name
-- 'atlas_slack_webhook_url'. This function is the only way to read it back out.
--
-- Deliberately `public`, not `private` (unlike every other internal helper in this repo)
-- — `private` schema functions aren't reachable via PostgREST's RPC endpoint at all, but
-- this DOES need to be callable via the service-role client's `.rpc()` from an Edge
-- Function. Safety comes from the grants below instead: EXECUTE is revoked from
-- `anon`/`authenticated` and granted only to `service_role`, so an ordinary
-- (RLS-scoped) client — even a signed-in admin — gets a permission error calling this,
-- while a service-role Edge Function (which authenticates to PostgREST as the
-- `service_role` Postgres role) can.
create function get_atlas_slack_webhook_url()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'atlas_slack_webhook_url';
$$;

revoke execute on function get_atlas_slack_webhook_url() from public;
revoke execute on function get_atlas_slack_webhook_url() from anon;
revoke execute on function get_atlas_slack_webhook_url() from authenticated;
grant execute on function get_atlas_slack_webhook_url() to service_role;
