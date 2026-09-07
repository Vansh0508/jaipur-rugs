# Requests to other teams (NAV/ERP, IT) — running list

Things Atlas needs that this repo alone can't fix — someone outside this codebase has
to act (add a field to an API, fix upstream data, confirm a business rule). Kept here,
not buried in a migration comment, specifically so any future session — or Ayaan asking
directly — has one place to check instead of re-discovering the same gaps. Update this
file whenever a new one turns up or an existing one gets resolved; don't let it go stale.

Every item below was confirmed against real, live data before being listed — not
guessed. See the referenced date/finding for how each was verified.

## Open requests

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

  **Not yet built into Atlas** — Customer Service Zone itself is no longer the blocker
  (Atlas has read it directly from NAV since 2026-09-07, see Resolved below); still
  waiting on real email addresses for each name above (asked Ayaan directly, 2026-09-06
  — he'll provide once this table's format is confirmed understood, which it now is).
  Ayaan's explicit instruction, 2026-09-07: **don't build the automated routing yet** —
  he wants to confirm it with production once more first. What *is* built in the
  meantime is a much smaller, separate thing: a plain Follow Up Person column on the
  Orders table showing each order's real `follow_up_person` name (now populated
  directly from NAV), with the matching email (where a confirmed one exists — see
  `db/orders/014_follow_up_person_directory.sql`) available on hover/click-to-copy for
  manual use. Not automated routing, not sending anything — just making an email easier
  to find and copy by hand.

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
  - The database is genuinely live, fixing request #3's lag for good — the two orders
    proven missing from the public feed (`JR/SO/2627/07100`, `07110`) are both present
    here with real current statuses, and the newest order at the time was dated that
    same day.
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
