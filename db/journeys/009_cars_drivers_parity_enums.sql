-- Journeys module, file 9. Cars/drivers parity with the standalone Admin-Driver-App
-- (driver-app-new, separate Supabase project) — widens the three enums that app's admin
-- portal uses more states for. Column-level mapping was checked first: every car/driver
-- column that app has already exists here under another name (plate -> registration_number,
-- brand -> make, name -> full_name, avatar_url -> photo_path); only the enum value sets
-- were short.
--
-- Kept in its own migration, separate from 010: Postgres forbids *using* a newly added
-- enum value in the same transaction that adds it, and 010 is written against these values.
-- Additive only — no existing value is renamed or removed, so every current row, the
-- feedback-app, and every deployed Edge Function keep working unchanged.

-- CARS. 'accidental' = off the road after an accident (distinct from scheduled
-- 'maintenance'). 'inactive' = soft-delete / decommissioned: journeys and feedback hold FKs
-- to vehicles with no cascade, so a car with any history can never be hard-deleted — the
-- portal's "delete" sets this instead (same meaning as drivers' existing 'inactive').
-- driver-app-new's 'busy' is already covered by 'on_trip'.
alter type vehicle_status add value if not exists 'accidental';
alter type vehicle_status add value if not exists 'inactive';

-- FUEL. driver-app-new's 11 options, snake_cased to match the existing lowercase values
-- ('Electric' is the existing 'ev'; 'Electric + Petrol' follows that as 'ev_petrol').
alter type fuel_type add value if not exists 'cng';
alter type fuel_type add value if not exists 'hybrid';
alter type fuel_type add value if not exists 'lpg';
alter type fuel_type add value if not exists 'biodiesel';
alter type fuel_type add value if not exists 'hydrogen';
alter type fuel_type add value if not exists 'petrol_cng';
alter type fuel_type add value if not exists 'petrol_lpg';
alter type fuel_type add value if not exists 'ev_petrol';

-- DRIVERS. driver-app-new's 'available' = 'active'; its 'occupied' is derived from
-- journeys at read time (not stored) in both apps, so it gets no value here. 'on_leave'
-- matches employees' existing snake_case spelling. Only 'active' drivers stay visible to
-- the Feedback App's guests (drivers_select_active_anon is unchanged) — a driver on leave
-- or suspended is deliberately hidden from the rating grid.
alter type driver_status add value if not exists 'on_leave';
alter type driver_status add value if not exists 'suspended';
