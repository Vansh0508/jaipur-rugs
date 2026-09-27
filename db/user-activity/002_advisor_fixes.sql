-- Follow-up migration addressing the Supabase performance advisor's finding from
-- 001_login_sessions.sql (AGENTS.md Section 3.1 step 5 — "treat that check as a required
-- step, not a cleanup afterthought"). See MIGRATIONS.md for the advisor run this responds to.

-- PERFORMANCE (INFO): unindexed_foreign_keys — login_sessions.auth_user_id had no
-- covering index. (001_login_sessions.sql above has been updated in place to include
-- this index directly, so a fresh apply of this module doesn't need this file at all —
-- kept here only as the historical record of what was actually run against the live
-- project, same as team-members/002_advisor_fixes.sql's own precedent.)
create index if not exists login_sessions_auth_user_id_idx on login_sessions(auth_user_id);
