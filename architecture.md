# architecture.md — Module Tracker

**Created 2026-08-22** as part of the `orders` module / `apps/atlas` build — `AGENTS.md`
had referenced this file since before it existed in-repo ("once those exist in-repo").
This is a first pass: it backfills the modules already shipped (sourced from
`db/MIGRATIONS.md` and each app's own `UPDATE.md`/`README.md`) and adds `orders`/`atlas`
in full. The DB scoring matrix `AGENTS.md` §10 also references is still not captured
here — that's a separate open item, not something this pass invented data for.

## Module Tracker

| DB module (`db/<module>/`) | Frontend app(s) | Status |
|---|---|---|
| `team-members` | `apps/hub` | Applied, advisor-clean. Schema + RLS + onboarding/admin extensions live. Edge functions (`employee-signup`, `employee-signin`, `invite-employee`, `update-employee`, `update-own-profile`, `upload-employee-avatar`) written; deploy status not re-verified by this pass — check `db/MIGRATIONS.md`. |
| `feedback` | `apps/admin/feedback-app` | Applied, advisor-clean. Employee/guest driver-feedback flow, non-Supabase-Auth identify pattern for both audiences. |
| `journeys` | `apps/admin/internal-portal` | Applied, advisor-clean, browser-verified end-to-end (see `UPDATE.md`). Cars/Drivers/Journeys with double-booking guarantees; Edge Functions deployed and live-tested. |
| `orders` | `apps/atlas` | **Schema (`001`–`006`) + all 10 Edge Functions applied and deployed, advisor-clean, smoke-tested; live on the internal deploy server** (`http://192.168.0.18:3001`) — see `db/MIGRATIONS.md`'s "Orders module — still pending" section and `apps/atlas/README.md`. One Edge Function secret (`ORDERS_SYNC_SECRET`) still needs to be set via Supabase CLI/Dashboard — no MCP tool in this session can push project secrets. Unified salesperson/production/shipping/sales order visibility, replacing the standalone `Track JR Orders` tool. First to use a plain data-driven reference table (`stages`) instead of a Postgres enum for a status-like field, deliberately, per its own spec. One auth system throughout (Supabase Auth) — briefly had a second, Clerk-based login for "merchants" before `006` (2026-09-01) corrected that assumption: those are internal territory heads/B2B salespeople, not external customers, so they're just employees rows scoped by `merchant_customer_codes`. `004` adds a workflow layer (structured work requests, milestones, an append-only audit log, and the real named production-escalation chain) replacing the order@/mzpreview@ email relay — every part of it was prototyped and load-tested against the live ERP feed in a local tool before being written as a migration. Pilot scope confirmed: London (customer `34836`) — not yet seeded; separately, Dinesh Choudhary (territory head, 72 real customer codes) is seeded but not yet linked to an account. |

## Per-module notes worth keeping here (not duplicated from MIGRATIONS.md)

- **`team-members`** is the foundation every other module's RLS helpers build on
  (`current_employee_id()`, `employee_has_permission()`, `department_access_grants`).
  Any new module needing "does this employee have access to X" should extend this
  vocabulary (a new permission key, a new department row) rather than inventing a
  parallel one — `orders` follows this (see below).
- **`journeys`** established the "no INSERT/UPDATE RLS policy, every write goes through
  a service-role Edge Function that re-checks authorization itself" pattern that
  `orders` also uses throughout.
- **`orders`** is cross-functional by design (merchant + production + shipping + sales +
  admin all read the same tables) rather than owned by one department, which is why it
  lives under `apps/atlas` at the top level rather than nested under a department folder
  the way `apps/admin/*` is.

## Open items

- The DB scoring matrix (module build-priority ordering) — `AGENTS.md` §10, still not
  captured as its own document here.
- Edge Function deployment status for `team-members`/`feedback` modules should be
  re-confirmed against the live project rather than assumed current from this file.
