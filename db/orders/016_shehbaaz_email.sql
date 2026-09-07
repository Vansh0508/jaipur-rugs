-- Real email confirmed directly by production during a live meeting, 2026-09-07 —
-- spelled out on the call, resolving the one remaining gap in the Follow Up Person
-- routing directory (was 9 of 10 confirmed; now 10 of 10).
insert into public.follow_up_person_directory (name, email)
values ('Shehbaaz', 'shabaz.a@jaipurrugs.com')
on conflict (name) do update set email = excluded.email, updated_at = now();
