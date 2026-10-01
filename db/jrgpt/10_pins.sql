-- JRGPT pinned cards.
--
-- The one thing JRGPT writes. Everything else it does is a read against the NAV mirror,
-- which is a different database entirely and stays read-only; pins are app state and so
-- belong here, in the shared project, next to `employees`.
--
-- Keyed to employees.id rather than auth.users.id: it is the identity every other module
-- already uses, and it survives the auth decision either way.

create type jrgpt_pin_kind as enum ('tile', 'answer');

create table jrgpt_pins (
  id           uuid primary key default gen_random_uuid(),
  employee_id  uuid not null references employees (id) on delete cascade,
  kind         jrgpt_pin_kind not null,
  -- 'open_book' for a tile, 'Q18' for a library answer. Deliberately not a foreign key:
  -- the question library is versioned in the app, not in the database.
  entry_id     text not null,
  label        text not null,
  position     integer not null default 0,
  created_at   timestamptz not null default now(),
  -- pinning the same card twice is a no-op, not a duplicate row
  unique (employee_id, kind, entry_id)
);

create index jrgpt_pins_employee_idx on jrgpt_pins (employee_id, position);

comment on table jrgpt_pins is
  'Cards a user pinned to their JRGPT home screen. Chat is how you ask; pinning is how it becomes your dashboard.';

alter table jrgpt_pins enable row level security;

-- A pin is private to the person who made it. No permission grants anyone else''s pins —
-- there is no "read all pins" case, so none is written.
create policy jrgpt_pins_select on jrgpt_pins for select to authenticated
  using (employee_id = private.current_employee_id());

create policy jrgpt_pins_insert on jrgpt_pins for insert to authenticated
  with check (employee_id = private.current_employee_id());

create policy jrgpt_pins_update on jrgpt_pins for update to authenticated
  using (employee_id = private.current_employee_id())
  with check (employee_id = private.current_employee_id());

create policy jrgpt_pins_delete on jrgpt_pins for delete to authenticated
  using (employee_id = private.current_employee_id());
