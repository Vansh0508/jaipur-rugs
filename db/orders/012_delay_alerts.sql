-- Orders module. Real business requirement, confirmed directly in a recorded meeting
-- with a sales team member (2026-09-05): "3 din the actual TAT tha, 4th din pe mail
-- bhejo" (the standard was 3 days, send the mail once it hits day 4 — i.e. the exact
-- moment private.stage_standard-equivalent logic already calls "breached", no extra
-- grace period needed) — recipients: the salesperson/merchant, the order's production
-- follow-up person, and the salesperson's own backend/ops contact ("Merchant, aur
-- Operations, Production, sabko jayega").
--
-- This table is the detection + de-dupe record, NOT the send itself — a script (see
-- apps/atlas/scripts/orders-delay-alerts.mjs) runs after every ERP sync, finds orders
-- that just crossed into "breached" and haven't already been alerted on TODAY, and
-- inserts one row per (order, day) here with the composed subject/body and whichever
-- recipients could actually be resolved to a real email address.
--
-- Two of the three recipients are NOT resolvable to a real email yet: `follow_up_person`
-- is a bare ERP name string (e.g. "Rushikesh, Prathmesh"), and there is no "sales
-- backend for this salesperson" mapping anywhere in this schema at all (checked before
-- writing this — confirmed absent). `recipients` records every intended recipient
-- either way (resolved email, or just the name flagged "no email on file") so the alert
-- is still useful to a human reading it even before that mapping exists. `sent_at`
-- stays null until a real send step is wired up (needs an email-sending service
-- connected first) — same "compose it, don't invent a fake send" posture the
-- live-preview prototype's own Alerts outbox used.

create table order_delay_alerts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  -- One alert per order per calendar day — the de-dupe key ("once per order per day",
  -- matching the live-preview prototype's own documented intent for the real version).
  alert_date date not null default current_date,
  stage_id uuid references stages(id),
  standard_days integer not null,
  pending_days integer not null,
  overdue_by_days integer not null,
  subject text not null,
  body text not null,
  -- [{ role: 'salesperson'|'follow_up_person'|'sales_backend', name: text,
  --    email: text | null }, ...] — email null means "no address on file yet," not "no
  -- recipient" — the alert still names who should have been told.
  recipients jsonb not null,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (order_id, alert_date)
);

create index order_delay_alerts_order_id_idx on order_delay_alerts(order_id);
create index order_delay_alerts_unsent_idx on order_delay_alerts(created_at) where sent_at is null;

alter table order_delay_alerts enable row level security;

-- Same visibility rule as order_stage_events/shipping_details: can you see the parent
-- order at all. No client write policy — service-role only (the orders-delay-alerts
-- script), same posture as every other write in this module.
create policy order_delay_alerts_select on order_delay_alerts for select to authenticated
  using (private.can_view_order(order_id));
