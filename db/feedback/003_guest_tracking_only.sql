-- Guest tracking redesign (product decision, applied 2026-08-18): guests are NOT
-- Supabase Auth users at all — no auth.users row, no session, ever. guest-signup is pure
-- phone-match-or-create data entry for tracking purposes. FEEDBACK now accepts either an
-- employee (reviewer_auth_user_id) or a guest (guest_id) reviewer — exactly one of the
-- two, never both/neither. Guests read the driver directory with no session at all
-- (anon role), since there's no other access gate for them by design.
--
-- Supersedes the original 001_feedback_schema.sql design where GUESTS.auth_user_id
-- linked 1:1 to a real (if server-issued) Supabase Auth phone identity — that identity
-- was never actually reachable in practice (its admin.createUser call surfaced
-- "Database error creating new user" from an unrelated stale trigger, see
-- db/team-members/003_drop_stale_auth_trigger.sql) and the product decision made it moot
-- anyway: guests were never meant to be real accounts, just tracked data entries.

-- Guests have no session at all now — the old self-select policy (keyed on auth.uid())
-- is meaningless and blocks dropping the column it depends on. No SELECT policy remains
-- on guests for any client role: it's pure internal tracking data, written and read only
-- by the service-role edge functions.
drop policy if exists guests_select_self on guests;

alter table guests drop column auth_user_id;

alter table feedback alter column reviewer_auth_user_id drop not null;
alter table feedback add column guest_id uuid references guests(id);
alter table feedback add constraint feedback_reviewer_xor_guest
  check (
    (reviewer_auth_user_id is not null and guest_id is null)
    or (reviewer_auth_user_id is null and guest_id is not null)
  );

create index feedback_guest_id_idx on feedback(guest_id);

-- Guests read the driver directory with no session (anon role) — driver name/photo
-- isn't sensitive, and this app has no other access gate for guests by design.
create policy drivers_select_active_anon on drivers
  for select to anon
  using (status = 'active');
