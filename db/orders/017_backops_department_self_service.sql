-- Orders module. Registers "Back Ops" as a real department (requested directly,
-- 2026-09-10) and lets anyone self-declare into it at sign-up, same self-service
-- mechanism 011 added for Management/Production.
--
-- Deliberately DIFFERENT from Management/Production/Sales in one crucial way: Back Ops
-- is NOT added to has_blanket_orders_access() or can_view_order()'s blanket department
-- list. Back Ops staff each cover a different customer code (or a few) -- e.g. Rahul
-- Sharma / London / 34836 from the pilot (see 006/README) -- not "see everything," and
-- the explicit ask this time was "don't give all four customer codes to everyone, let
-- them add" their own. So joining this department only marks org placement; actual
-- order visibility still comes from each person's own employee_salesperson_codes /
-- merchant_customer_codes rows, added via salesperson-codes-add /
-- customer-codes-add (see the new customer-codes-add Edge Function, this session --
-- the missing customer-code counterpart to 010's salesperson-codes-add: the schema and
-- RLS already supported a customer-code-scoped employee via merchant_customer_codes,
-- but no self-service endpoint existed to let a person add themselves to it, so a
-- pasted customer code silently went nowhere useful).
--
-- join-department's self-service allow-list gains "backops" in the same change
-- (supabase/functions/join-department) -- no schema change needed for that part.

insert into departments (name, code) values ('Back Ops', 'backops')
on conflict (code) do nothing;
