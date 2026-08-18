-- Orphaned debris from the earlier superseded schema attempt (see MIGRATIONS.md): this
-- trigger inserted into public.profiles on every new auth.users row, but that table was
-- dropped by drop_rd_webapp_schema_for_foundation_rebuild. Left in place, it broke ANY
-- new-user creation (e.g. the guest-signup edge function's original phone-based
-- admin.createUser call, surfaced as "Database error creating new user") and would
-- equally have broken future employee provisioning. Not part of this repo's design at
-- all — removing it. Unrelated to the guest-tracking redesign in
-- db/feedback/003_guest_tracking_only.sql, applied in the same session for the same reason.

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists internal.handle_new_user();
