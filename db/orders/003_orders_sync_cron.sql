-- Orders module, file 3/3. Schedules the ERP sync (Section 5 of the build prompt: "a
-- scheduled, server-side sync ... that pulls the full feed on an interval and upserts").
-- Uses pg_cron + pg_net to call the deployed orders-sync Edge Function on a schedule,
-- entirely from a migration — no manual Dashboard cron setup required, and reviewable
-- the same way every other schema change is.
--
-- Extensions installed into `extensions`, not `public`, per the security advisor
-- guidance already applied to btree_gist in db/journeys/006_advisor_fixes.sql.
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;
grant usage on schema cron to postgres;

-- The function checks a shared secret header (ORDERS_SYNC_SECRET, see
-- supabase/functions/orders-sync/index.ts) rather than relying on verify_jwt — pg_net's
-- http_post has no natural end-user JWT to attach, and this endpoint should not be
-- reachable by the public internet at all. The secret itself is NOT committed here —
-- store it in Vault before this job can actually authenticate successfully:
--
--   select vault.create_secret('<the same value set as the orders-sync function's
--     ORDERS_SYNC_SECRET env var>', 'orders_sync_secret');
--
-- Until that secret exists, this job runs on schedule but every call gets a 401 from the
-- function — fails closed, not open. Same reasoning for the project URL: read from
-- `current_setting('app.settings.supabase_url', true)` if your project already defines
-- that GUC (several Supabase starter configs do); otherwise replace the literal below
-- with the live project's actual functions URL before running this migration — do not
-- assume a hostname the way AGENTS.md Section 10 already warns against assuming a
-- project by name.
select cron.schedule(
  'orders-sync-erp-feed',
  '*/30 * * * *', -- every 30 minutes; revisit once real sync duration/ERP load is known
  $$
  select net.http_post(
    url := 'https://matnispbauvvlnbsuzxq.supabase.co/functions/v1/orders-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-orders-sync-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'orders_sync_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);
