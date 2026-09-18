-- *** WRITTEN, NOT APPLIED — deliberately, per direct decision 2026-09-12. ***
-- Kept as a verified reference only: rather than add all 180 of these to the live
-- `orders` table (and have orders-sync.mjs pull all of them every 30 minutes) up front,
-- Ayaan chose a request-based model instead (see 022_column_requests.sql) — an employee
-- requests one specific field they actually want from the full catalog below (surfaced
-- in ColumnSettingsMenu.tsx's "Request a column" list), Ayaan reviews the request, and
-- only THAT column gets added — one `alter table ... add column` + one orders-sync.mjs
-- field, not all 180 at once. "No load on the server and database instead only that
-- column will be added which are required and requested by the user" — his own words.
--
-- So: do not run this file wholesale. When a real request is approved, copy that one
-- field's line out of it (name + type already verified below) into a proper new
-- `db/orders/0NN_<field>.sql` migration instead, and add the matching mapping to
-- orders-sync.mjs's SELECT + mapErpRowToOrder(). This file stays here as the
-- already-done verification work so that per-field lookup never has to be redone.
--
-- Full NAV field expansion — direct request, 2026-09-12: "ITS 200+ COLOUMNS" (referring
-- to a real reference spreadsheet, "NAV FORMAT.XLSX", listing 202 fields NAV can carry).
-- Cross-checked before writing a single line of this migration, not guessed:
--
-- 1. Diffed that 202-field spreadsheet against what orders-sync.mjs already pulls (42
--    fields) — 160 fields were unaccounted for.
-- 2. Rather than trust the spreadsheet's exact spelling, queried the LIVE
--    `NAV-002-Rug List - Main` view's real INFORMATION_SCHEMA.COLUMNS (read-only, no
--    writes) from the office server — the only machine with a route to it — confirmed
--    225 real columns exist there today. 158 of the spreadsheet's 160 unaccounted-for
--    fields matched a live column exactly; the other 2 ("Current Status Pending Days",
--    "Bunkar Sakhi2") don't exist in this view under that name and were left out rather
--    than guessed (one is very likely just NAV's own "Current Staus Pending Days" typo'd
--    field, already synced as current_status_pending_days).
-- 3. Also picked up 22 more real columns that exist in the live view but weren't even
--    in the reference spreadsheet, for the same reason — already confirmed real, no
--    added risk to include them too.
--
-- 158 + 22 = 180 new columns below, verified against the live view's real column list —
-- see that INFORMATION_SCHEMA query's own output (kept alongside the mapping this
-- migration was generated from) for the exact source. All nullable — orders-sync.mjs
-- (see its next update) backfills them on its next run; every row synced before that
-- keeps null for all of these until then, same as any newly-added column.
--
-- Naming: snake_case, camelCase/spaced NAV names split on word boundaries
-- (e.g. "LeadTimeZeroPrtyinDays" -> lead_time_zero_priority_in_days, spelled out for
-- readability rather than transliterated literally). No collisions with the 53 columns
-- `001_orders_core_schema.sql`/`013_nav_direct_fields.sql` already added — checked
-- programmatically before this file was written, not by eye.
--
-- Type mapping from the live view's real DATA_TYPE, not guessed from the field name:
-- nvarchar/varchar -> text, int -> integer, decimal/numeric -> numeric,
-- datetime -> date (matching every existing date column here — orders-sync.mjs always
-- CONVERTs a NAV datetime to a plain yyyy-mm-dd varchar before it reaches Postgres, same
-- as original_ex_factory_date/sales_order_date/etc. already do), tinyint -> boolean
-- (otn_cancelled, ring_set, artisan — the same tinyint-as-flag pattern
-- warehouse_shipment_created already uses).

alter table public.orders
  add column if not exists running_length numeric,
  add column if not exists due_date date,
  add column if not exists location_code text,
  add column if not exists status integer,
  add column if not exists production_order_line_no integer,
  add column if not exists production_width numeric,
  add column if not exists actual_rpo_creation_date date,
  add column if not exists actual_map_completion_date date,
  add column if not exists actual_store_issue_date date,
  add column if not exists actual_branch_issue_date date,
  add column if not exists actual_weaver_issue_date date,
  add column if not exists actual_off_loom_date date,
  add column if not exists actual_ho_receipt_date date,
  add column if not exists actual_repairing_issue_date date,
  add column if not exists actual_finishing_issue_date date,
  add column if not exists actual_carpet_finish_date date,
  add column if not exists revised_order_due_date date,
  add column if not exists purchase_order_no text,
  add column if not exists purchase_order_line_no integer,
  add column if not exists eta_in_days numeric,
  add column if not exists etc_in_days numeric,
  add column if not exists order_due_date date,
  add column if not exists carpet_weight numeric,
  add column if not exists actual_purchase_receipt_date date,
  add column if not exists purchase_due_date date,
  add column if not exists by_air text,
  add column if not exists design_remarks text,
  add column if not exists map_serial_no text,
  add column if not exists actual_length_in_ft numeric,
  add column if not exists actual_width_in_ft numeric,
  add column if not exists actual_sq_ft numeric,
  add column if not exists map_production_order_no text,
  add column if not exists planned_shipment_date date,
  add column if not exists design_inspection_remarks text,
  add column if not exists weaving_finishing_remarks text,
  add column if not exists type_of_order text,
  add column if not exists otn_cancelled boolean,
  add column if not exists finance_code text,
  add column if not exists sample_created_for text,
  add column if not exists customer_matching text,
  add column if not exists consignee text,
  add column if not exists center_name text,
  add column if not exists vendor_purchase text,
  add column if not exists sales_order_type text,
  add column if not exists packing_remarks text,
  add column if not exists catalog_code text,
  add column if not exists std_length numeric,
  add column if not exists std_width numeric,
  add column if not exists ground_color text,
  add column if not exists border_color text,
  add column if not exists prod_cubage numeric,
  add column if not exists item_category_code text,
  add column if not exists collection text,
  add column if not exists fiber_content text,
  add column if not exists posting_date date,
  add column if not exists outstanding_quantity numeric,
  add column if not exists weaver_name text,
  add column if not exists production_location text,
  add column if not exists custom text,
  add column if not exists us_design_name text,
  add column if not exists care_instruction text,
  add column if not exists old_item_code text,
  add column if not exists primary_style text,
  add column if not exists back_order_processing_date date,
  add column if not exists weaving_technique text,
  add column if not exists product_line_category text,
  add column if not exists current_status_date date,
  add column if not exists po_date date,
  add column if not exists first_order_date date,
  add column if not exists qs text,
  add column if not exists quality_detail text,
  add column if not exists quality_code text,
  add column if not exists size_group text,
  add column if not exists actual_ware_house_date date,
  add column if not exists ring_set boolean,
  add column if not exists product_group text,
  add column if not exists inventory_posting_group text,
  add column if not exists ppr_date date,
  add column if not exists for_map_pendency text,
  add column if not exists actual_length_ft_inch text,
  add column if not exists actual_width_ft_inch text,
  add column if not exists production_length numeric,
  add column if not exists remaining_work numeric,
  add column if not exists actual_length_cms numeric,
  add column if not exists actual_width_cms numeric,
  add column if not exists map_planning_date date,
  add column if not exists gaujratal_naama text,
  add column if not exists design_group text,
  add column if not exists loom_id text,
  add column if not exists weaver text,
  add column if not exists sub_vendor_no text,
  add column if not exists sub_vendor text,
  add column if not exists weaver_on_loom_date date,
  add column if not exists weaver_off_loom_date date,
  add column if not exists tufting_type text,
  add column if not exists qs_purchase text,
  add column if not exists primary_color_ground text,
  add column if not exists secondary_color_border text,
  add column if not exists abc_margin text,
  add column if not exists item_status_for_india_catalog text,
  add column if not exists moq_for_india_catalog integer,
  add column if not exists subcontracting_order_no text,
  add column if not exists type_of_sample text,
  add column if not exists development_by text,
  add column if not exists licenced_to text,
  add column if not exists production_bom_no text,
  add column if not exists item_status_for_us_catalog text,
  add column if not exists expected_receipt_date date,
  add column if not exists prod_item_description text,
  add column if not exists purch_item_description text,
  add column if not exists comment text,
  add column if not exists bunkar_sakhi text,
  add column if not exists indian_design_name text,
  add column if not exists job_card_printed text,
  add column if not exists quality_group_code text,
  add column if not exists gross_weight numeric,
  add column if not exists packing_length numeric,
  add column if not exists packing_width numeric,
  add column if not exists packing_height numeric,
  add column if not exists first_swapped_from text,
  add column if not exists designer text,
  add column if not exists secured text,
  add column if not exists shape_code text,
  add column if not exists remarks_for_production text,
  add column if not exists ptn_no text,
  add column if not exists production_delivery_date date,
  add column if not exists special_treatment text,
  add column if not exists program_matching_for_india_cat text,
  add column if not exists outdoor_indoor text,
  add column if not exists india_stock_catalog text,
  add column if not exists style_on_matching text,
  add column if not exists sample_info text,
  add column if not exists artisan boolean,
  add column if not exists hs_code_master text,
  add column if not exists map_item_no text,
  add column if not exists jls_code_jli text,
  add column if not exists type_of_business text,
  add column if not exists loom_village text,
  add column if not exists off_loom_date_for_sales date,
  add column if not exists primary_pattern_code text,
  add column if not exists branch_manager text,
  add column if not exists ramgarh_receipt_date date,
  add column if not exists design_status text,
  add column if not exists territory_head text,
  add column if not exists kanni_item text,
  add column if not exists finished_carpet_weight numeric,
  add column if not exists packed_by text,
  add column if not exists gr_color_family text,
  add column if not exists br_color_family text,
  add column if not exists matching_status text,
  add column if not exists teal_project text,
  add column if not exists intransit_location text,
  add column if not exists us_matching_status text,
  add column if not exists mzp_status text,
  add column if not exists mzp_status_date date,
  add column if not exists per_day_work numeric,
  add column if not exists per_day_work_for_zero_priority numeric,
  add column if not exists jli_sales_order_no text,
  add column if not exists jpr_number_878 text,
  add column if not exists pd_cad_name text,
  add column if not exists quote_no text,
  add column if not exists sf_comments text,
  add column if not exists rack_location text,
  add column if not exists order_packed_date date,
  add column if not exists image_available text,
  add column if not exists packing_date date,
  add column if not exists follow_up_team text,
  add column if not exists jli_sku_ranking text,
  add column if not exists creation_user_id text,
  add column if not exists std_cubage_in_mtr numeric,
  add column if not exists order_pack_status text,
  add column if not exists exclusive_territory text,
  add column if not exists exclusivity_remarks text,
  add column if not exists pile_height_in_mm text,
  add column if not exists first_ppr_date date,
  add column if not exists lead_time_zero_priority_in_days numeric,
  add column if not exists lead_time_other_priority_in_days numeric,
  add column if not exists aging_based_on_priority_changed integer,
  add column if not exists best_seller text,
  add column if not exists type_of_order_change_date date;

comment on column public.orders.status is
  'Raw NAV integer Status code (view column literally named "Status") — distinct from raw_current_status (NAV''s "Current Status" text) and stage_id (Atlas''s own resolved coarse stage). Meaning not yet confirmed with NAV; stored as-is rather than guessed at.';
comment on column public.orders.qs is
  'Raw NAV "QS" column — distinct from quick_ship (NAV''s "Quick Ship"). Meaning not yet confirmed with NAV.';
comment on column public.orders.comment is
  'Quoted-safe as a plain column name (not the SQL COMMENT command) — NAV''s own "Comment" field.';
