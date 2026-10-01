-- jrgpt.fg_stock : finished-goods rugs in stock, with ageing, across ALL locations.
-- Source: nav_mirror."View-0450-Aging of Showroom Carpet Inventory"
-- (despite the name it is not showroom-only - LOCType separates showroom/warehouse/etc)
create or replace view jrgpt.fg_stock as
select
  nullif(btrim("Serial No_"), '')      as serial_no,
  nullif(btrim("Item No_"), '')        as item_code,
  nullif(btrim("Design Code"), '')     as design_code,
  nullif(btrim("Size Code"), '')       as size_code,
  nullif(btrim("Shape Code"), '')      as shape_code,
  nullif(btrim("Item Description"), '')as item_description,
  nullif(btrim("LOCType"), '')         as location_type,
  nullif(btrim("Location Code"), '')   as location_code,
  nullif(btrim("LOCName"), '')         as location_name,
  "LocEntryDate"::date                 as entered_location_on,
  "AginginDays"::int                   as ageing_days,
  case when "AginginDays" < 90  then 'a under 90d'
       when "AginginDays" < 180 then 'b 90-180d'
       when "AginginDays" < 365 then 'c 180-365d'
       else 'd over 1 year' end        as ageing_band
from nav_mirror."View-0450-Aging of Showroom Carpet Inventory";

comment on view jrgpt.fg_stock is
'Finished rugs in stock with ageing days per serial, across all locations (not just showrooms - use location_type). This is the answer source for "how much finished stock is sitting beyond N days".';
