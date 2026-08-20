-- Advisor follow-up for 006_hub_onboarding_and_admin.sql (AGENTS.md Section 3.1 step 5).
-- security advisor flagged next_employee_code with a mutable search_path — same finding,
-- same fix, as next_driver_code's own follow-up (db/journeys/008_driver_code_helper_fixes.sql).
alter function public.next_employee_code() set search_path = public, pg_temp;
revoke execute on function public.next_employee_code() from anon, authenticated;
