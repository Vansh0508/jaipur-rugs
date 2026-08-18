-- Journeys module, file 8. Advisor follow-up for 007: pin search_path (consistent with
-- every other helper in this module) and restrict EXECUTE to service_role only, matching
-- create_journey/update_journey's treatment even though this one isn't SECURITY DEFINER
-- (the advisor didn't flag the anon/authenticated grant here since it's not a definer
-- function, but there's no reason a public client should be able to burn driver_code_seq
-- values outside of an actual driver creation).
alter function public.next_driver_code() set search_path = public, pg_temp;
revoke execute on function public.next_driver_code() from anon, authenticated;
