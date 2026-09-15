# Requests to other teams (NAV/ERP, IT) — running list

Things Atlas needs that this repo alone can't fix — someone outside this codebase has
to act (add a field to an API, fix upstream data, confirm a business rule). Kept here,
not buried in a migration comment, specifically so any future session — or Ayaan asking
directly — has one place to check instead of re-discovering the same gaps. Update this
file whenever a new one turns up or an existing one gets resolved; don't let it go stale.

Every item below was confirmed against real, live data before being listed — not
guessed. See the referenced date/finding for how each was verified.

## Open requests

### 9. `NAV-002-Rug List - Main` is a 2-hourly batch report, not a live view — and one real order's rug count doesn't reconcile
**Confirmed directly, 2026-09-15**: Ayaan asked Vansh to check with the ERP team whether
this view only populates some of the time. Vansh's answer (Slack, 2026-09-15): "The data
in db gets updated in real time. But the report collects data from a lot of tables. So,
it starts the collection every 2 hours." This matches what querying it directly turned
up the same day — a query against the view failed outright with `Invalid object name
'TEMP.RugsListTemp'`, because the view reads from a temporary staging table that this
2-hourly collection job rebuilds; catching it mid-rebuild throws, not just returns stale
data.

**Why this matters for Atlas**: `orders-sync.mjs` (and Atlas's own on-time/freshness
expectations generally) inherit up to ~2 hours of built-in latency from the source
report itself — no sync interval on Atlas's side can beat that. Worth setting the sync
cron interval with this in mind (running every 30 min to catch a report that only
changes every 2h is mostly wasted polling, though harmless). Also worth asking ERP
whether the collection job has any monitoring for a run that fails/hangs mid-rebuild —
right now a query landing in that window just errors with no indication to anyone.

**RESOLVED — the actual discrepancy that started this investigation, 2026-09-15.** The
merchant was right: this PO has **21 real rugs, not 12** — a real, structural gap in
what `NAV-002-Rug List - Main` (the view Atlas's whole sync is built on) even includes,
not a timing/staleness issue.

Full reconciliation for Sales Order `JR/SO/2627/03956` / Customer PO
`AS#|STORE|SEA|PO/26-27/130|JAKOB|LV-48` (customer 35787):
- **12 rugs made it into Atlas** (via the Rug List view, same 12 Supabase has). Ashish
  Sharma's manual count (Slack, 2026-09-15: "Total 12, 9 Dispatched, 1 In Progress, 2 in
  Making") matches these 12 exactly, cross-checked against
  `NAV-011- Posted Whse Shipment Packing List` (a **different** NAV view — has a real
  `[OTN No_]` + `[Posting Date]` + `[Sales Shipment No]`, unlike the Rug List view which
  has no shipped/dispatched status at all — dispatched rugs just silently disappear
  from it): 8 shipped together 2026-08-27 + 1 shipped 2026-09-10 = the 9 dispatched;
  `OTN-2259168` never shipped = the 1 in progress; `OTN-2259158`/`2259169` still "At
  Loom" = the 2 in making. Every number ties out.
- **9 more rugs never appeared in Atlas at all**: `OTN-2294175` through `2294183`,
  shipped together in one shipment (`SLSHIP2627/10593`) on 2026-08-31 — found only in
  the Posted Whse Shipment Packing List, under this exact same Customer PO. Checked
  directly: these 9 OTNs have **zero rows, ever**, in `NAV-002-Rug List - Main` (queried
  by OTN No_ directly, no date/status filter) and zero rows in Supabase under any PO.
  From creation to dispatch, Atlas's sync source never saw them.

**One honest caveat, raised by Ayaan and worth taking seriously**: Atlas's own tracking
only starts on 2026-09-02 (earliest row in `orders`), and didn't read this NAV view
*directly* until 2026-09-07 (before that, a different, narrower public feed — see the
"Resolved" entry below on requests #1/#2/#3/#6). These 9 rugs shipped 2026-08-31 — only
2 days before Atlas existed at all, and 7 days before the direct-view sync did. So this
could be either (a) a real structural gap — these 9 never appear in this view, full
stop — or (b) a timing gap — Atlas simply started watching too late to catch them
before they aged out of the view. Weak evidence against (b): the 8 rugs that *did* make
it in were shipped 2026-08-27 (older than these 9) and were *still* in the view as late
as 2026-09-07 (11 days post-shipment) — if dispatched rugs generally linger that long,
these 9 (only 2-7 days old when Atlas started looking) should have too. But this isn't
proof either way — there's no way to query what the view showed on a past date; it has
no history.

**Ask (still open):** ERP/Dinesh's team — check whether these 9 OTNs ever appeared in
`NAV-002-Rug List - Main` at any point (they'd have logs/history Atlas doesn't), to
settle which of the two explanations above is actually true. If it's (a), this likely
recurs on other POs too and is worth a real fix on the view itself; if it's (b), it's a
one-time gap from Atlas's own rollout window and not an ongoing concern.

**Built on Atlas's own side, 2026-09-15 (`db/orders/029_dispatch_tracking.sql` +
`orders-sync.mjs`)** — this does NOT answer the "why did 9 rugs never appear" question
above, but it does fix the underlying display problem for every order Atlas already
knows about: a real "Dispatched" stage, sourced from `NAV-011- Posted Whse Shipment
Packing List` (confirmed as the right report via Ashish Sharma's manual count above),
plus real courier tracking info where NAV has one (a separate AWB-tracking view,
`View-0462...` — only ~5-9% of shipments ever get a real trackable number; most are a
domestic transfer via a regional transporter with no public tracking site, which is
handled honestly — see that migration's own comment). Also checked broadly while
building this: NAV's own `JRCPL Live$Shipping Agent` table resolves codes like "MH-004"
to real names ("BLUE DART EXPRESS LIMITED") — the tracking link only appears for the
three couriers with a confirmed-real public tracking page (FedEx/Blue Dart/DHL); a real
tracking number from a smaller regional transporter shows as plain text, not a fake
link, per direct decision, 2026-09-15.

### 4. "Follow Up Person" is blank for most real orders
**Ask:** NAV/ERP team (Dinesh's team) — populate this field for every order at the
source, per the real routing rule described below, so Atlas doesn't need a fallback
guess.
**Why:** Atlas is currently using an interim regex-based guess (construction-family →
person) ported from the pre-Atlas tool, which is known to be a simplification. Real
routing table, confirmed directly by Ayaan (2026-09-05), keyed on Customer Service Zone
+ Order Priority (0 vs. not-0) + quality type, with two universal overrides:
  - Current stage = Purchase → **always** Pramod Kumar Mourya, regardless of anything else.
  - Quality is an "Ultra Pro" type → **always** narendra, regardless of zone.
  - Otherwise, look up by zone + priority + Knotted-vs-Tufted:

    | Zone | Priority | Knotted → | Tufted → |
    |---|---|---|---|
    | Sample | >0 | Surendra | Avinash Kumar |
    | Sample | =0 | Mariyam | Chandan Bind |
    | Make2Stock | any | Surendra | Avinash Kumar |
    | JLI | >0 | Avinash Joshi | Avinash Kumar |
    | JLI | =0 | Parthmesh | Shehbaaz |
    | JLI | =0, customer 1081 | Mariyam | Chandan Bind |
    | Big Box | >0 | Surendra | Avinash Kumar |
    | Big Box | =0 | Mariyam | Chandan Bind |
    | B2B | >0 | Khusboo | Avinash Kumar |
    | B2B | =0 | Mariyam | Chandan Bind |
    | B2C | any | Parthmesh | Shehbaaz |
    | Exhibition | >0 | Surendra | Avinash Kumar |
    | Exhibition | =0 | Mariyam | Chandan Bind |
    | Subsidiary | any | Parthmesh | Shehbaaz |
    | Archive | any | Surendra | Avinash Kumar |
    | Group Co. | — | *(Ayaan to fill in manually)* | *(Ayaan to fill in manually)* |

  **Not yet built into Atlas as an automated alert** — Ayaan's explicit instruction,
  2026-09-07: **don't build the automated routing/alert-sending yet** — he wants to
  confirm it with production once more first.

  **What *is* built, 2026-09-07:** a Follow Up Person column on the Orders table,
  computed live from this exact routing table — ported directly from Ayaan's own
  reference sheet ("Ex India.xlsx", Sheet2, confirmed to match this section exactly) —
  with the matching email available on hover/click-to-copy. **All 10 names now have a
  real, confirmed email** (`db/orders/015_follow_up_person_directory_routing_names.sql`
  + `016_shehbaaz_email.sql` — "Shehbaaz" was the last gap, spelled out and confirmed
  directly by production in a live meeting: `shabaz.a@jaipurrugs.com`). Explicit
  instruction: compute from Zone/Priority/Quality, **not** from NAV's raw
  `orders.follow_up_person` text — see `apps/atlas/lib/followUpPerson.ts`. Display/copy
  only, not automated routing or sending.

  **Still an open gap, but partially answered, 2026-09-07:** the routing table only
  defines rules for "Knotted" and "Tufted" quality types. In the same production
  meeting, Handloom and Flat-weave were confirmed to route **the same as whichever
  person Tufted routes to** for that zone/priority — not yet reflected in
  `lib/followUpPerson.ts` (pending an explicit go-ahead to change it, same as the
  automated-alert pause above). Still genuinely unresolved: "GROUP CO." zone (the
  sheet's own row literally says "Will update manual" — 19 real orders) and ~243 orders
  with no Customer Service Zone set at all.

### 8. Design and PPC stage-standard days need one clarified number each
**Ask:** Ayaan / production — a single number for each, not a range or a mixed case.
**Why:** production's own edits to `Atlas_Current_TAT_Rules.xlsx`'s Status-based TAT tab
came back as text that can't be safely turned into one number: Design's priority-0
override says "7 for rug 3 days for swatches" (two different cases in one cell — rug vs
swatch — but swatches already get their own flat 15-day standard elsewhere, so it's
unclear which case this even applies to), and PPC's says "1-2 Days" (a range). Left
unchanged in `lib/stageTat.ts` rather than guessed.
**Confirmed:** read directly from Ayaan's own edited copy of that file, 2026-09-07.

### 9. The NAV database views themselves still lag real NAV by a few hours
**Ask:** whoever manages NAV/these views — how often do `NAV-002-Rug List - Main` and
`NAV-002-Rug List - ERP` actually refresh, and is there a faster, more truly-live source
to read from instead if same-day visibility matters?
**Why:** two real orders, confirmed directly by Ayaan — `JR/SO/2627/07353` (punched
10:30 AM today) and `JR/SO/2627/07363` (processed just now) — are both completely
absent from *both* database views, checked directly at 12:27 PM the same day (NAV's own
server clock). This isn't an Atlas problem: this was queried straight against NAV,
bypassing Atlas's sync entirely, and the gap is already there at the source. Ayaan
separately confirmed the same ceiling (`07344`) in the actual Rug List tool itself, so
this is a shared limitation across every NAV-based view available, not specific to
Atlas's queries.
**Also revises Resolved request #3 below**: switching Atlas to read the database
directly (instead of the old public API feed) was a real, measured improvement — it
fixed the *specific* stale-snapshot problem confirmed back then (two orders missing for
days, an unchanging newest-order ceiling across repeated fetches). It did not make the
data perfectly real-time. There's still a real, multi-hour gap between an order being
punched/processed in NAV and it appearing in either view — smaller than the old public
feed's lag, but not zero.
**Confirmed:** live queries against both NAV views directly, 2026-09-10, cross-checked
against Ayaan's own direct knowledge of both orders' real punch/process times, and
against the actual Rug List tool showing the same ceiling.

### 5. Unmapped ERP status text silently falls into "Other"
**Ask:** NAV/ERP team — any order status text that doesn't match Atlas's known
stage-mapping list quietly lands in a generic "Other" bucket instead of being flagged.
Not a one-time bug — will keep recurring as new/unusual status text appears in NAV.
**Also tracked as an Asana task** (see MIGRATIONS.md's Atlas section / Asana "AI
Projects" > Ayaan).

### 7. "Vishnu Prasad Nagar" (Follow Up Person) has no company email on record
**Ask:** whoever maintains the company email directory
(darpan.jaipurrugs.com/storage/email-ext-list) — is there a real email for this person
under a different spelling, or do they genuinely not have a company email account?
**Why:** confirmed live 2026-09-07 — of the 10 distinct real values in
`orders.follow_up_person`, this is the **second-most common by volume** (7,962 of
~46,000 order lines) but the only one of the top 5 with no match anywhere in the
directory (checked by name, and by pulling the full Production & SCM department roster
directly — genuinely absent, not a search-thoroughness issue). Three much lower-volume
names (Gopal Lal Meena — 123, Nishant Singh — 2, Mambhu — 1) are also unmatched, but
Vishnu Prasad Nagar is the one actually worth asking about.
**Confirmed:** searched the live company directory directly, multiple passes (exact
name, partial/surname, full department roster) — 2026-09-07.

## Still open on Atlas's own side (not a department ask, but blocked on it)

- **Sales-backend-per-salesperson mapping** — the third delay-alert recipient
  ("Operations"/backend contact for each salesperson) has no mapping anywhere in this
  schema at all, and no equivalent roster was provided (unlike Follow-Up-Person above).
  Needs either a small admin-maintained roster or a self-service path, once decided.
- **`authorization`, `remark`, `expected_ready_date`** — these `orders` columns exist
  but nothing populates them anymore (confirmed 2026-09-07: none of "Authorization",
  "Remark", or "Expected Ready Date" exist under those names in the NAV database either
  — see Resolved below). Not currently blocking anything, but worth a real decision:
  drop the columns, or find out from NAV what (if anything) they should actually map to.

## Resolved

- **2026-09-07 — real TAT numbers and two bugs, from a live walkthrough with
  production:**
  - Handloom and Dhurrie/flat-weave now get a real 12-day Loom standard (same as
    Tufted) — previously Handloom was a guessed flat 8 days and flat-weave had no
    standard at all (relying on a purely date-driven interim rule, now removed).
  - Zero-priority Knotted orders now use a real, exact per-quality rate
    ("Zero Priority Per Day Standard Work.xlsx", 44 qualities) instead of a coarse
    4-tier guess by knot-count alone — confirmed the two disagree for several real
    qualities (e.g. "8/8" is really 3, not the tiered guess of 2).
  - Order Process, Stores, Branch, In Transit, Repair, and Finishing standards all
    updated from production's direct edits to `Atlas_Current_TAT_Rules.xlsx`. Design and
    PPC intentionally left unchanged — see request #8.
  - **New "Late" status**, distinct from "Delayed": previously "On Time" only checked
    whether today had already passed Rev Ex Factory, which could show "On track" for an
    order that's already unable to make that date given how long its current stage
    normally takes. Now: if (today + this stage's standard days) would land past Rev Ex
    Factory, it shows "Late" — a projection, not yet a literal fact like "Delayed".
  - **Fixed a real "Days in Stage" bug**: it only ever counted days in the current
    *sub-status* (e.g. "At Stores"), not the order's real age — a real example showed
    "3 days" for an order that had actually been around 34-39 days. Added a "Total Days"
    column (today minus Sales Order Date) alongside it.

- **2026-09-07 — requests #1 (Customer Service Zone), #2 (Original/Rev Ex India), #3
  (feed lag), and #6 (HSN/SAC No, Sales Line No_, Current Location):** all resolved the
  same way — Atlas's sync (`orders-sync.mjs`) now reads the real NAV MSSQL database
  directly (`NAV-002-Rug List - Main` view, server `192.168.0.41` — credentials
  deliberately never written to this repo or git; they live in a local, **un-rotatable**
  file outside git, treated with more care than any other secret here) instead of the
  public `webapi.jaipurrugs.com/api/ERP/rug-list` feed.

  Confirmed directly, live, before switching:
  - Every field requests #1, #2, and #6 asked for already existed in this database —
    it was never a "NAV needs to add data" problem, only "the public feed exposes a
    narrower 34-column projection of data NAV already has in full." Added to `orders`
    as `customer_service_zone`, `original_ex_india_date`, `revised_ex_india_date`,
    `hsn_sac_no`, `sales_line_no`, `current_location`
    (`db/orders/013_nav_direct_fields.sql`).
  - The database is genuinely more live than the public feed was — the two orders
    proven missing from the public feed (`JR/SO/2627/07100`, `07110`) are both present
    here with real current statuses, and the newest order at the time was dated that
    same day. **Update, 2026-09-10 — not a complete fix**: a real multi-hour lag still
    exists in these same database views, confirmed directly with two different orders.
    See request #9 below — better than the old feed, not fully solved.
  - **Correction to an earlier claim in this file:** request #6 previously said "Ground
    Color"/"Border Color" were just a different label for `GR Color Name`/`BR Color
    Name`. Checked directly against the real database — they're genuinely different:
    Ground/Border Color are color **codes** (e.g. `0204-23`), GR/BR Color Name are the
    color **names** (e.g. `Fog`). Not added to `orders` yet since nothing asked for them
    specifically, but they're real, available, distinct data if ever needed.
  - `Authorization`, `Remark`, and `Expected Ready Date` still don't exist under those
    names anywhere in the NAV database either (checked the same day) — these 3 columns
    stay unpopulated (explicitly `null`, not guessed) regardless of source; see "Still
    open on Atlas's own side" above.
  - A real, unrelated engineering snag surfaced and was fixed along the way: Node's
    `mssql`/`tedious` driver refuses an encrypted connection when the server is
    addressed by a raw IP (Node enforces RFC 6066 — TLS's SNI extension can't be an
    IP-literal), which this server is (`192.168.0.41`, no hostname). `orders-sync.mjs`
    now tries encrypted first and falls back to unencrypted specifically for this known
    failure (logged loudly, not silent) — safe here since `MSSQL_TRUST_SERVER_CERTIFICATE
    =true` already meant certificate identity wasn't being validated anyway, and this
    address is internal-office-LAN-only, never internet-facing.

  **Note:** this only works from a machine with network access to the office LAN — the
  public Hostinger VPS deployment has no route to `192.168.0.41`, so `orders-sync.mjs`
  can only run on/from the office network now, same constraint as the old
  service-role-key requirement already implied.
