-- Adds columns for fields newly available now that orders-sync.mjs reads directly from
-- the NAV MSSQL database (`NAV-002-Rug List - Main` view) instead of the public
-- webapi.jaipurrugs.com feed — confirmed live 2026-09-07 that the database already has
-- all of these, they were just never exposed by the narrower public feed. See
-- ERP_AND_EXTERNAL_REQUESTS.md's "Major finding, 2026-09-07" section for how this was
-- verified (real connection, real column list, real freshness check against two
-- specific orders previously confirmed missing from the public feed).
--
-- Resolves requests #1 (Customer Service Zone), #2 (Original/Rev Ex India), and #6
-- (HSN/SAC No, Sales Line No_, Current Location) from that doc — not by NAV adding
-- anything, but by Atlas reading a source that already had them.

alter table public.orders
  add column if not exists customer_service_zone text,
  add column if not exists original_ex_india_date date,
  add column if not exists revised_ex_india_date date,
  add column if not exists hsn_sac_no text,
  add column if not exists sales_line_no integer,
  add column if not exists current_location text;

comment on column public.orders.customer_service_zone is
  'ARCHIVE / B2B / B2C / BIG BOX / EXHIBITION / GROUP CO. / JLI / MAKE2STOCK / SAMPLE / SUBSIDIARY — first input to the Follow-Up-Person routing table (see ERP_AND_EXTERNAL_REQUESTS.md request #4).';
comment on column public.orders.original_ex_india_date is
  'Distinct from original_ex_factory_date — confirmed genuinely different values in ~67% of populated rows (see ERP_AND_EXTERNAL_REQUESTS.md request #2). Exact business meaning vs. Ex Factory still unconfirmed with NAV.';
comment on column public.orders.revised_ex_india_date is
  'Distinct from revised_ex_factory_date — see original_ex_india_date''s comment.';
