<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

---

# Feedback App — status and how it's managed

This section is ours, not Next's — its generator only rewrites content between the
`BEGIN:nextjs-agent-rules` / `END:nextjs-agent-rules` markers above (verified directly in
`generate-agent-files.js`: it does a scoped find-and-replace on that exact block, leaving
everything before and after untouched). Safe to extend below.

**For the full picture** — stack, DB schema, migrations, what to touch/not touch — see
[`README.md`](./README.md) in this same folder. This section is the shorter "what's
actually running and why" companion to that reference.

## What's live right now

- **Login** (`app/login/page.tsx`) — two tabs, **neither is Supabase Auth**. Employee:
  `employee_code` + phone number, matched against the `employees` table via the
  `employee-signin` edge function (phone matching is digit-normalized on the last 10
  digits — `employees.phone` has no enforced format, unlike guests). Guest: full name +
  E.164 phone, matched against (or inserted into) `guests` via `guest-signup`. Both paths
  create no `auth.users` row and no session — the browser just remembers the returned id
  in a plain cookie (`jr_employee_id` / `jr_guest_id`, `lib/authCookies.ts`). The employee
  path used to be real Supabase Auth (`signInWithPassword`); it was replaced mid-build —
  see `db/MIGRATIONS.md`'s "Employee login redesign" and "Guest tracking redesign" entries
  for the full reasoning and what each superseded.
- **Employee sign-in on an unrecognized code runs a recovery cascade**, not an immediate
  "create new?" offer (`db/MIGRATIONS.md`'s "Employee sign-in recovery cascade" entry has
  the full story, including why the first, simpler version was replaced the same day it
  was built). Order: try phone → try email → only then offer to create. Each step is a
  distinct typed error from `db-management-client` (`EmployeePhoneMatchPendingError` →
  `EmployeeNotFoundError` → `EmployeeEmailMatchPendingError`/`EmployeeEmailNotFoundError`)
  that the login form catches to show the right popup and drive `employeeSignIn`'s `action`
  param (`confirmPhoneMatch` / `lookupEmail` / `confirmEmailMatch` / `createNew`) — never
  call any of those speculatively; each is only reachable after the specific error above.
  A code that exists but has the wrong phone/status never enters this cascade — that's a
  real account's wrong credentials, not a recovery case.
  - The phone/email match steps patch **only fields that were genuinely missing**
    (`status` if not already active, `phone` if the matched row's was `null`) and **never**
    touch `employee_code` or overwrite anything already set. Their popups are confirm-only,
    no editable fields — an explicit product decision, not a shortcut.
  - The final create-new step still allocates `employee_code` server-side
    (`next_employee_code()`, same sequence `create-driver` uses) and sets `status: 'active'`
    immediately instead of the usual HR-flow `'invited'` — unchanged from before.
- **Access gate** (`proxy.ts`) — purely cookie-based: lets a request through if it carries
  *either* `jr_employee_id` *or* `jr_guest_id`. There is no Supabase session check at all
  in this app anymore (neither login path produces one). No Hub to redirect to yet, so
  unauthenticated requests bounce to this app's own `/login`.
- **Driver grid** (`app/drivers/page.tsx`, `components/DriverGrid.tsx`) — Server Component
  read via the shared RLS-scoped client, no `db-management` involved (reads never need
  it). 13 real drivers and 14 vehicles are seeded (`db/feedback/004_seed_drivers_and_vehicles.sql`).
  Cards: bordered container, image inset with padding, driver name below the image (not
  overlaid on it) — iterated a few times, current shape is the source of truth, not any
  earlier description in chat history.
- **Feedback modal** (`components/FeedbackModal.tsx`) — 2-step (date → rating/description),
  Hero UI v3 compound `Modal`/`Modal.Backdrop`/`Modal.Container`/`Modal.Dialog`. Sends
  whichever of `guestId`/`employeeId` the visitor's cookie holds.
- **Writes** — exclusively through `supabase/functions/{guest-signup,employee-signin,submit-feedback}`,
  called via `packages/db-management-client`, never a direct client insert. All deployed
  and live-tested against the real project (`db/MIGRATIONS.md` has exact versions/dates).
- **Driver photos** — `driver-photos`, a **public Supabase Storage bucket** — a deliberate,
  recorded override of the root `AGENTS.md`'s "self-hosted S3" default (see that file's
  Section 1). No photos are uploaded yet; the grid falls back to initials.

## Real gotchas hit while building this — don't reintroduce them

- **`NEXT_PUBLIC_*` env vars must be static property access** (`process.env.NEXT_PUBLIC_X`),
  never `process.env[name]` through a helper. The dynamic form isn't inlined into the
  client bundle — it silently works server-side (where `process.env` is a real object) and
  silently breaks in the browser. `lib/env.ts` writes every getter out in full on purpose;
  don't refactor it into a loop or a generic `requireEnv(name)` helper.
- **`next/headers`'s `cookies()` is async** (Next 15+) — `lib/supabaseClient.server.ts`
  awaits it. A client component importing anything from a file that also imports
  `next/headers` fails to bundle at all, which is why the browser and server Supabase
  client factories are two separate files (`supabaseClient.browser.ts` /
  `supabaseClient.server.ts`) — don't merge them back into one.
- **This app uses `proxy.ts`, not `middleware.ts`** — Next 16 renamed the convention
  (same API, same behavior, `middleware` export renamed to `proxy`). Don't add a
  `middleware.ts` back; it's deprecated in this version.
- **Hero UI is v3** (`@heroui/react` + `@heroui/styles`), not v2 — compound components
  (`Modal.Backdrop`, `Select.Trigger`, `Tabs.Panel`, ...), **no `<Provider>` needed**, and
  styling comes from `@import "@heroui/styles"` in `app/globals.css`, not a scanned
  `tailwind.config.js` (there isn't one — Tailwind v4 is CSS-first). This is also why the
  original "stuck on tab selection" bug is structurally impossible now: v3's component
  CSS is a precompiled import, not something Tailwind has to discover by scanning
  `node_modules`.
- **`drivers` is readable by the `anon` role with no session at all** (guests need it),
  but only via a **column-level GRANT** — `phone` and `department_id` are deliberately
  excluded even though the RLS policy itself doesn't restrict columns. If you add a new
  sensitive column to `drivers`, it is anon-readable by default unless you extend that
  grant restriction (see `db/feedback/004_seed_drivers_and_vehicles.sql`).
- **Public Storage buckets bypass RLS for reads, not writes.** Uploading to
  `driver-photos` still needs either a service-role client (no admin UI does this yet) or
  a new RLS policy on `storage.objects` — don't assume "public" means client uploads work.
- **`employees.phone` has no enforced format** — the seeded row is a bare 10-digit
  domestic number, no country code. `employee-signin` matches on the last 10 digits after
  stripping non-digits, not exact string equality, and the employee login form uses a
  plain phone field (no country-code picker) — don't swap it for the guest tab's
  `PhoneInput` (which forces an E.164 `+` prefix) or matching will silently fail for every
  real employee.
- **`employees.email` is UNIQUE and NOT NULL** (unlike `guests`, which has no email column
  at all) — `employee-signin`'s create-on-not-found path collects it in the confirmation
  popup and pre-checks for a duplicate before allocating a code, mirroring
  `invite-employee`'s own check. Don't skip that pre-check if you touch this function; the
  raw unique-violation error is far less useful to show a real person.
- **`FEEDBACK.reviewer_auth_user_id` is vestigial for this app.** Neither login path
  produces a Supabase session anymore, so this column is never populated by
  `submit-feedback` going forward — `guest_id`/`employee_id` are what actually identify a
  reviewer now. It's kept in the schema (3-way CHECK, not dropped) only in case some other
  real-session integration needs it later; don't be surprised it's always null on new rows.

## Explicitly not done yet

- No admin UI for managing drivers/vehicles/photos in *this* app — that's
  `apps/admin/internal-portal`'s job (it exists and is a real, working app — cars, drivers,
  journeys, a dashboard, an admin auth gate — see its own `README.md`; it is **not** a
  Phase 2 placeholder, whatever an older version of this doc or its own README may say).
- No `roles`/`role_permissions` seeded in the team-members module — irrelevant to this
  app specifically now (neither login path is permission-gated), but relevant if this app
  ever needs role-based restriction of its own.
