-- Sketch Challan due-date reminders, run by pg_cron inside the database, so no service-role key is needed
-- anywhere (replaces the old apps/sketch-challan/scripts/maintenance.ts). Same pattern as db/orders/003.
-- WRITTEN 2026-09-28. NOT APPLIED. Requires 001-003.

-- pg_cron's control file fixes its own schema; naming another one fails on a fresh project.
create extension if not exists pg_cron;
grant usage on schema cron to postgres;

-- Reminds 3, 1 and 0 days before the due date (India time). Only active challans that still have work open:
-- on-hold challans get none (README section 10), nor do challans whose every part is approved.
-- Recipients: the Sketching Manager and the current holder of each open part. dedupe_key makes re-runs safe.
create function private.sketch_challan_due_reminders()
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_count integer;
begin
  with due as (
    select c.id, c.production_order_no, c.due_date, (c.due_date - v_today) as days_left
    from sketch_challans c
    where c.status = 'active' and c.due_date is not null and (c.due_date - v_today) in (3, 1, 0)
      and (not exists (select 1 from sketch_challan_tasks t where t.challan_id = c.id)
        or exists (select 1 from sketch_challan_tasks t where t.challan_id = c.id and t.status <> 'completed'))
  ), recipients as (
    select d.id, d.production_order_no, d.due_date, d.days_left, m.holder as recipient
      from due d cross join private.sketch_challan_role_holders('sketching_manager') as m(holder)
    union
    select d.id, d.production_order_no, d.due_date, d.days_left, t.current_sketcher_id
      from due d join sketch_challan_tasks t on t.challan_id = d.id and t.status <> 'completed'
  )
  insert into sketch_challan_notifications (recipient_employee_id, challan_id, notification_type, title, message, dedupe_key)
  select recipient, id, 'reminder', 'Sketch Challan due reminder',
    case when days_left = 0 then production_order_no || ' is due today.'
      else production_order_no || ' is due in ' || days_left || case when days_left = 1 then ' day.' else ' days.' end end,
    'due:' || id || ':' || recipient || ':' || due_date || ':' || days_left
  from recipients
  on conflict (dedupe_key) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- 09:00 India time (03:30 UTC) every day.
select cron.schedule('sketch-challan-due-reminders', '30 3 * * *', $$select private.sketch_challan_due_reminders()$$);
