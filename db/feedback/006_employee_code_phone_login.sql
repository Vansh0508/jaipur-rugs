-- Employee login redesign: no more Supabase Auth (email/password) for the Feedback App's
-- employee tab — matched against employees.employee_code + employees.phone instead,
-- mirroring the guest-tracking redesign exactly (see 003_guest_tracking_only.sql). No
-- auth.users row, no session — the app remembers "this browser is employee X" with a
-- plain cookie, same mechanism as guests.

alter table feedback add column employee_id uuid references employees(id);
create index feedback_employee_id_idx on feedback(employee_id);

-- Was a 2-way XOR (reviewer_auth_user_id, guest_id); now exactly one of three.
-- reviewer_auth_user_id is kept in the schema (still meaningful for any other real
-- Supabase-Auth-based integration later) but is no longer populated by this app's
-- submit-feedback calls going forward.
alter table feedback drop constraint feedback_reviewer_xor_guest;
alter table feedback add constraint feedback_reviewer_exactly_one check (
  (
    (case when reviewer_auth_user_id is not null then 1 else 0 end) +
    (case when guest_id is not null then 1 else 0 end) +
    (case when employee_id is not null then 1 else 0 end)
  ) = 1
);
