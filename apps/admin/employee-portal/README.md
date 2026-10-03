# Employee Portal

`apps/admin/employee-portal` — where employees **request** a journey or a conference room.
There is **no login** (product decision, 2026-09-30): the portal opens straight on Journey
Booking. Every request waits for an Internal Portal admin to approve or reject it
(`apps/admin/internal-portal` → Dashboard, Journeys, Conference → Requests tab).

## What it does

| Section | Same view as | Differences |
|---|---|---|
| **Journey Booking** (`/journey-booking`) | Internal Portal's New journey builder | No car or driver (the admin assigns them when approving). Guests are typed in (name + phone), never searched; employee passengers are found by exact employee ID. A "Note for the admin team" field. |
| **Conference Booking** (`/conference-booking`) | Internal Portal's conference calendar (Day / Week / Month / Timeline) | Shows only *when* each room is taken — no event names or who booked. Click a free slot to request it. No resizing, no Bookings / Rooms tabs. |

Both forms ask for **your employee ID** (looked up as you type, remembered on the device).
That's how a request says who it's from — a label an admin sees and judges, not a login.

## How it talks to the database

It never reads a table and holds no session and no service-role key. Everything goes through
four Edge Functions via `packages/db-management-client`, all `verify_jwt = false`:

| Function | Returns / does |
|---|---|
| `employee-lookup-by-code` | One **active** employee by exact code: name, code, department. |
| `conference-availability` | Active rooms + busy `(room, start, end)` ranges. No names. |
| `conference-request-create` | A pending `conference_booking_requests` row. |
| `journey-request-create` | A pending `journey_requests` row (trip validated server-side). |

Schema, RLS and the approval functions: `db/booking-requests/` (ERD in
`booking-requests-schema.mmd`). An approval creates the real booking / journey in one
transaction, through the same rules as an admin-entered one.

**Accepted risk of "no login":** anyone who can open the portal can send a request in any
active employee's name, and can confirm an employee code → name + department. Mitigations:
nothing happens without an admin's approval, no phone numbers or other people's meeting
details are ever returned, name search isn't offered (exact code only), and each employee
code can have at most 10 open requests of each kind. Host it on the internal network.

## Local development

```bash
pnpm install                                   # from the repo root
cp .env.example .env.local                     # fill in the Supabase URL + publishable key
pnpm --filter @jaipur-rugs/employee-portal dev # http://localhost:3002/bookings
```

The shell is the standard department app shell (department-app-shell skill), copied from
`apps/admin/internal-portal` — minus the user menu, since there's no one signed in. The
calendar views, the builder's model/fields and a few shared components are copies of the
Internal Portal's (each file says so at the top); the shell chrome is now in five apps, which is
past the point the skill suggests promoting it into `packages/ui-kit`.
