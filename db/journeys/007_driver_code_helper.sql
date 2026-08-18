-- Journeys module, file 7. Small addition discovered while writing create-driver:
-- supabase-js has no first-class way to read a bare `nextval()` from a service-role
-- client (PostgREST only exposes tables/views/RPC functions, not arbitrary SQL) — wrap it
-- in a tiny public RPC, service_role-only, matching create_journey/update_journey's
-- restricted-grant pattern.
create function public.next_driver_code()
returns text
language sql
as $$
  select 'DRV-' || lpad(nextval('driver_code_seq')::text, 3, '0');
$$;

revoke all on function public.next_driver_code() from public;
grant execute on function public.next_driver_code() to service_role;
