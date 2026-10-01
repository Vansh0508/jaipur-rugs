-- jrgpt.artisan_activity : weaver/village activity from daily carpet output.
-- Source: nav_mirror."NAV-009- Daily Carpet Output Report All Locations 2017 Onwards"
-- NOTE: that source is a ROLLING window starting 2025-04 - it is current+previous FY only.
-- Answers: how many artisans have work, in which villages, is work steady.
create or replace view jrgpt.artisan_activity as
select
  "Posting Date"::date                     as output_date,
  nullif(btrim("Vendor Code"), '')         as weaver_code,
  nullif(btrim("Pay To Vendor"), '')       as weaver_name,
  nullif(btrim("Branch"), '')              as branch,
  nullif(btrim("Location Code"), '')       as location_code,
  nullif(btrim("Quality"), '')             as quality,
  nullif(btrim("Design"), '')              as design_code,
  nullif(btrim("Size"), '')                as size_code,
  "Quantity"::double precision             as rugs_produced,
  "Std Sq Ft"::double precision            as sqft,
  "Weaver On Loom Date"::date              as on_loom_date,
  "Weaver Off Loom Date"::date             as off_loom_date
from nav_mirror."NAV-009- Daily Carpet Output Report All Locations 2017 Onwards"
where "Posting Date" is not null;

comment on view jrgpt.artisan_activity is
'Daily carpet output by weaver and branch. ROLLING WINDOW - starts 2025-04, not 2017 despite the source name. Use for active-weaver counts and steadiness of work. There is NO wage or payment data anywhere in the warehouse, so income per artisan cannot be answered.';
