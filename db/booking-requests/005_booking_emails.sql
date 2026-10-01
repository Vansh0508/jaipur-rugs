-- Booking-requests module, file 5. Status emails for conference and journey bookings.
--
-- Six emails, sent by the Edge Functions (supabase/functions/_shared/bookingEmails.ts) right
-- after the write they describe — never by the apps, which can't see employees' addresses
-- (the employee portal has no session at all):
--   conference_request_sent / journey_request_sent  — an employee sent a request (pending)
--   conference_confirmed    / journey_confirmed     — a request was approved, or an admin
--                                                     booked / planned it directly
--   conference_rejected     / journey_rejected      — a request was rejected
-- Recipient: the employee the booking is for (a request's requester; for an admin-planned
-- journey, each employee passenger). All active employees have an email on file.
--
-- Sending is best-effort: a failed or unconfigured send never undoes or blocks the booking.
-- Every attempt is written to BOOKING_EMAIL_LOG (sent / failed with the error / skipped when
-- no SMTP settings exist yet), so a missing email can be traced. Admin-read only; written only
-- by the Edge Functions (service role) — no write policy.
--
-- SMTP settings live in Supabase Vault as one JSON secret named 'booking_smtp_config'
-- ({ host, port, user, pass, from, fromName, portalUrl? }), loaded from the gitignored
-- supabase/functions/.env — never in this file or in git. get_booking_smtp_config() is the only
-- way to read it: `public` so a service-role Edge Function can .rpc() it, with EXECUTE for
-- service_role only (same pattern as get_atlas_slack_webhook_url, db/user-activity/003).

create type booking_email_event as enum (
  'conference_request_sent',
  'conference_confirmed',
  'conference_rejected',
  'journey_request_sent',
  'journey_confirmed',
  'journey_rejected'
);

create type booking_email_status as enum ('sent', 'failed', 'skipped');

create table booking_email_log (
  id uuid primary key default gen_random_uuid(),
  event booking_email_event not null,
  employee_id uuid references employees(id),
  recipient text,
  subject text not null,
  status booking_email_status not null,
  error text check (error is null or length(error) <= 2000),
  conference_booking_request_id uuid references conference_booking_requests(id) on delete set null,
  journey_request_id uuid references journey_requests(id) on delete set null,
  conference_booking_id uuid references conference_bookings(id) on delete set null,
  journey_id uuid references journeys(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Every FK indexed (unindexed_foreign_keys advisor); created_at for the newest-first log view.
create index booking_email_log_employee_id_idx on booking_email_log (employee_id);
create index booking_email_log_conference_booking_request_id_idx on booking_email_log (conference_booking_request_id);
create index booking_email_log_journey_request_id_idx on booking_email_log (journey_request_id);
create index booking_email_log_conference_booking_id_idx on booking_email_log (conference_booking_id);
create index booking_email_log_journey_id_idx on booking_email_log (journey_id);
create index booking_email_log_created_at_idx on booking_email_log (created_at desc);

alter table booking_email_log enable row level security;

create policy booking_email_log_select_admin on booking_email_log for select to authenticated
  using ((select private.is_internal_portal_admin((select private.current_employee_id()))));

create function public.get_booking_smtp_config()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select decrypted_secret::jsonb from vault.decrypted_secrets where name = 'booking_smtp_config';
$$;

revoke execute on function public.get_booking_smtp_config() from public, anon, authenticated;
grant execute on function public.get_booking_smtp_config() to service_role;
