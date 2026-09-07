-- Follow Up Person display switched from NAV's raw orders.follow_up_person text to a
-- computed value (Customer Service Zone x Order Priority x Quality-type routing table —
-- see apps/atlas/lib/followUpPerson.ts). Explicit instruction, 2026-09-07: "dont take
-- NAV data for follow up person. refer to only [Ex India.xlsx]" — that sheet is where
-- the routing table itself comes from, confirmed to exactly match what was already
-- documented in ERP_AND_EXTERNAL_REQUESTS.md request #4.
--
-- The directory's name set changes accordingly: 014's seed was keyed to the 10 raw NAV
-- follow_up_person text values (SURENDRA DHAKAD, VISHNU PRASAD NAGAR, ...); this table
-- now needs the 10 canonical routing-table names instead (Surendra, Mariyam, ...).
-- Re-matched against the same company directory — 9 of 10 confirmed real emails now
-- (up from 6 of 10 against the old NAV-text name set). "Shehbaaz" is the one remaining
-- gap: no match found in the company directory under that or a "Shahbaz" spelling after
-- several search passes — see ERP_AND_EXTERNAL_REQUESTS.md request #4.
delete from public.follow_up_person_directory;

insert into public.follow_up_person_directory (name, email) values
  ('Surendra', 'surendra.d@jaipurrugs.com'),
  ('Mariyam', 'mariyam.k@jaipurrugs.com'),
  ('Avinash Kumar', 'avinash.k@jaipurrugs.com'),
  ('Chandan Bind', 'chandan.b@jaipurrugs.com'),
  ('Avinash Joshi', 'avinash.j@jaipurrugs.com'),
  ('Parthmesh', 'prathamesh.k@jaipurrugs.com'),
  ('Khusboo', 'khushboo.m@jaipurrugs.com'),
  ('Pramod Kumar Mourya', 'pramod.m@jaipurrugs.com'),
  ('narendra', 'narendra.d@jaipurrugs.com');
