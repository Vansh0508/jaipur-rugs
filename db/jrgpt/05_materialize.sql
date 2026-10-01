-- The two derived views are aggregations over millions of rows (products 12.3s, customers 4.9s).
-- That is far too slow for an interactive answer, so they are materialised.
-- MUST be refreshed after nav_mirror re-syncs: see jrgpt/refresh_jrgpt.sh
drop materialized view if exists jrgpt.products_mv;
create materialized view jrgpt.products_mv as select * from jrgpt.products;
create unique index if not exists products_mv_pk on jrgpt.products_mv (design_code);

drop materialized view if exists jrgpt.customers_mv;
create materialized view jrgpt.customers_mv as select * from jrgpt.customers;
create unique index if not exists customers_mv_pk on jrgpt.customers_mv (customer_code);

-- indexes on the two big base views' underlying tables are not possible (views),
-- so heavy filters should go through the materialised copies where available.
