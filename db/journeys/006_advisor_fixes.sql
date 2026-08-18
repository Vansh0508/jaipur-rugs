-- Journeys module, file 6/6. Follow-up migration addressing Supabase advisor findings
-- from 001_vehicles_and_drivers_extensions.sql..005_journeys_rls.sql (AGENTS.md Section
-- 3.1 step 5 — required, not optional). Performance advisor findings were all INFO-level
-- "unused index" on a schema with no real query traffic yet — expected, matching the
-- precedent already recorded in db/MIGRATIONS.md, no action needed. Security advisor
-- findings addressed below.

-- SECURITY (WARN): extension_in_public — btree_gist was installed in `public` (its
-- default). Supabase projects already provision a dedicated `extensions` schema for
-- exactly this. Relocating is safe for objects already using it (existing exclude
-- constraints resolve operator classes by OID at definition time, not by re-resolving
-- search_path on every use — same reasoning as moving RLS helper functions between
-- schemas without touching the policies that reference them).
alter extension btree_gist set schema extensions;

-- SECURITY (WARN): function_search_path_mutable — private.set_journey_date_range and
-- private.validate_stop_guest_action (both trigger functions, 002) were created without
-- a pinned search_path, unlike every other helper function in this module.
alter function private.set_journey_date_range() set search_path = public, pg_temp;
alter function private.validate_stop_guest_action() set search_path = public, pg_temp;

-- SECURITY (WARN): anon/authenticated_security_definer_function_executable —
-- create_journey/update_journey's own `revoke all ... from public` (003) did not strip
-- anon/authenticated's access, because Supabase's default privileges for the `public`
-- schema grant EXECUTE on new functions directly to anon/authenticated/service_role at
-- creation time — a separate mechanism from the PUBLIC pseudo-role, so revoking from
-- PUBLIC alone doesn't touch it. These functions must stay in `public` (not `private`)
-- since they're called via `.rpc()` from a service-role Edge Function client, and
-- PostgREST only exposes RPC routes for schemas in its exposed-schemas list (`private`
-- isn't one) — so the fix is an explicit revoke from the two roles directly, not a schema
-- move.
revoke execute on function public.create_journey(jsonb) from anon, authenticated;
revoke execute on function public.update_journey(uuid, jsonb) from anon, authenticated;
