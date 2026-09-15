-- Real correctness bug caught by validate-on-time-status-port.mjs's first full run
-- (after 025/026's permission fixes finally let it execute at all): standard_days
-- matched on every single row checked — the stageStandard()/loomStandardDays() port is
-- right — but computed_on_time_status disagreed on a large fraction of rows, in two
-- consistent, explainable directions:
--
--   js=delayed, sql=late      (an order due exactly TODAY)
--   js=late,    sql=on_track  (an order due in the next few days)
--
-- Root cause: apps/atlas/lib/tat.ts's onTimeStatus() compares real INSTANTS —
-- `Date.now()` (the precise current moment, with time-of-day) against
-- `new Date("yyyy-mm-dd").getTime()` (always midnight UTC of that date) — not whole
-- calendar days. 024's private.orders_on_time_status() instead compared plain `date`
-- values (`current_date > v_target`), which is a whole day "behind" the JS version at
-- the boundary: at any moment after midnight UTC on the day something is due (i.e.
-- essentially always, since this runs during normal daytime hours), JS's `now` has
-- already passed that midnight instant and calls it delayed, while `current_date >
-- v_target` is false when the two DATEs are equal, so the SQL fell through to the
-- "late" check instead (or to on_track, when the "late" projection's own now-based
-- instant math meant JS's version was more aggressive than a whole-day comparison too).
--
-- Fix: replace both comparisons with real timestamptz arithmetic, matching Date.now()/
-- new Date(dateString) exactly — a bare `date` cast to timestamp is anchored to UTC
-- explicitly (via `AT TIME ZONE 'UTC'`) rather than trusting the session's configured
-- timezone to already be UTC.
create or replace function private.orders_on_time_status(
  p_promised_delivery_date date,
  p_revised_ex_factory_date date,
  p_is_terminal boolean,
  p_stage_standard_days numeric
) returns text
language plpgsql
stable
as $$
declare
  v_target date;
  v_target_ts timestamptz;
begin
  if p_is_terminal then
    return 'on_track';
  end if;
  v_target := coalesce(p_revised_ex_factory_date, p_promised_delivery_date);
  if v_target is null then
    return 'unknown';
  end if;
  -- SQL Server DateTime.MinValue leaking through as "1753-01-01" — same guard
  -- displayDate.ts/orders-sync.mjs already apply everywhere else this app touches dates.
  if extract(year from v_target) < 1900 then
    return 'unknown';
  end if;

  -- Midnight UTC of v_target, matching new Date("yyyy-mm-dd").getTime() in JS exactly —
  -- explicitly anchored to UTC rather than relying on the session timezone already
  -- being UTC (`date::timestamp` is a naive/zoneless midnight; `AT TIME ZONE 'UTC'`
  -- is what actually pins it there).
  v_target_ts := (v_target::timestamp) AT TIME ZONE 'UTC';

  if current_timestamp > v_target_ts then
    return 'delayed';
  end if;
  if p_stage_standard_days is not null
     and (current_timestamp + (p_stage_standard_days::int || ' days')::interval) > v_target_ts then
    return 'late';
  end if;
  return 'on_track';
end;
$$;
