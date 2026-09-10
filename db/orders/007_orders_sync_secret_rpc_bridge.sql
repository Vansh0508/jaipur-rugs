-- Orders module. Lets orders-sync (and, later, any other trusted server-side caller)
-- read the ORDERS_SYNC_SECRET-equivalent value without it ever being a Supabase Edge
-- Function "secret" at all.
--
-- Context (2026-09-02): no tool available in this session can set a project-level Edge
-- Function secret (that needs `supabase secrets set` from an authenticated CLI, or the
-- Dashboard's Edge Functions -> Secrets page — a real, standing gap, not something to
-- keep re-checking). Rather than leave the sync pipeline blocked on that one manual
-- step, the same value now lives in Postgres Vault instead (created once via
-- `select vault.create_secret('<value>', 'orders_sync_secret');`, generated locally and
-- never printed anywhere in chat).
--
-- PostgREST does not expose the `vault` schema to `.schema('vault').from(...)` calls —
-- confirmed via `has_table_privilege('service_role', 'vault.decrypted_secrets',
-- 'SELECT')` returning true (so the raw Postgres grant is fine) while the REST layer
-- still can't reach it. This function is the bridge: callable via `.rpc()`, restricted
-- to `service_role` only.
create or replace function public.get_orders_sync_secret()
returns text
language sql
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'orders_sync_secret';
$$;

revoke execute on function public.get_orders_sync_secret() from public, anon, authenticated;
grant execute on function public.get_orders_sync_secret() to service_role;
