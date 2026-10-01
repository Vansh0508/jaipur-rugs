-- Conference module, file 3. A free-text description on each room, used to say where the
-- room is ("2nd floor, Admin block — next to reception"). Shown under the venue in both
-- booking forms (Internal Portal and employee portal) and as "Location" in the booking status
-- emails (supabase/functions/_shared/bookingEmails.ts).
--
-- Optional (existing rooms have none), capped like the other free-text fields. No RLS change:
-- conference_rooms' existing admin-only select policy covers every column, and the employee
-- portal only ever sees it through conference-availability (active rooms' id, name, capacity,
-- description — the description is about the room, not about anyone's meeting).

alter table conference_rooms
  add column description text check (description is null or length(description) <= 500);

comment on column conference_rooms.description is
  'Where the room is / what it is, e.g. "2nd floor, Admin block". Shown in the booking forms and booking emails.';
