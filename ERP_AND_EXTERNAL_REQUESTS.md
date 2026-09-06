# Requests to other teams (NAV/ERP, IT) — running list

Things Atlas needs that this repo alone can't fix — someone outside this codebase has
to act (add a field to an API, fix upstream data, confirm a business rule). Kept here,
not buried in a migration comment, specifically so any future session — or Ayaan asking
directly — has one place to check instead of re-discovering the same gaps. Update this
file whenever a new one turns up or an existing one gets resolved; don't let it go stale.

Every item below was confirmed against real, live data before being listed — not
guessed. See the referenced date/finding for how each was verified.

## Open requests

### 1. Add "Customer Service Zone" to the ERP API feed
**Ask:** NAV admin — add the `Customer Service Zone` column (ARCHIVE / B2B / B2C /
BIG BOX / EXHIBITION / GROUP CO. / JLI / MAKE2STOCK / SAMPLE / SUBSIDIARY) to
`https://webapi.jaipurrugs.com/api/ERP/rug-list`'s response.
**Why:** it's the first input to the real Follow-Up-Person routing table (see below) —
without it, Atlas can't correctly route a delay alert to the right production contact.
**Confirmed:** field exists in the fuller NAV Excel export (`NAV-002-Rug-ListAll.xlsx`,
column GA) with real populated values — confirmed absent from the live API feed by
listing every key in a real feed row directly (2026-09-06).

### 2. Add "Original Ex India" and "Rev_Ex India" to the ERP API feed
**Ask:** NAV admin — add both columns to the same API feed.
**Why:** genuinely different dates from Original/Rev Ex Factory, not duplicates — across
a real 149,464-row export, wherever both fields are populated they differ in **67%** of
rows, sometimes by months (one example: India date Jan 20, Factory date Apr 30). Atlas
currently has no visibility into whichever business step these represent.
**Also ask:** what exactly each date represents (likely "left the factory" vs. a
separate export/customs step, but not confirmed) — worth clarifying at the same time,
since Atlas will want to label/use it correctly once it's added.
**Confirmed:** compared every row of `Ex India.xlsx` against Original/Rev Ex Factory
directly (2026-09-05).

### 3. Why does the ERP API feed lag real NAV data?
**Ask:** whoever maintains `https://webapi.jaipurrugs.com/api/ERP/rug-list` — is there a
scheduled job feeding this feed from NAV, and when did it last run successfully?
**Why:** two real orders (`JR/SO/2627/07100`, `JR/SO/2627/07110`), confirmed punched and
visible in NAV's own rug list, are entirely absent from the API feed. The feed's newest
Sales Order at the time was `JR/SO/2627/06707` — several hundred orders behind. Fetched
the live feed twice, minutes apart, and got the *exact same* newest order both times —
strong evidence this is a stale snapshot, not a live query, and whatever refreshes it
isn't running (or isn't running often enough).
**Confirmed:** live, repeated fetches of the real feed (2026-09-05/06).

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

  **Not yet built into Atlas** — waiting on request #1 (Zone isn't in the API feed yet)
  and on real email addresses for each name above (asked Ayaan directly, 2026-09-06 —
  he'll provide once this table's format is confirmed understood, which it now is).

### 5. Unmapped ERP status text silently falls into "Other"
**Ask:** NAV/ERP team — any order status text that doesn't match Atlas's known
stage-mapping list quietly lands in a generic "Other" bucket instead of being flagged.
Not a one-time bug — will keep recurring as new/unusual status text appears in NAV.
**Also tracked as an Asana task** (see MIGRATIONS.md's Atlas section / Asana "AI
Projects" > Ayaan).

## Still open on Atlas's own side (not a department ask, but blocked on it)

- **Sales-backend-per-salesperson mapping** — the third delay-alert recipient
  ("Operations"/backend contact for each salesperson) has no mapping anywhere in this
  schema at all, and no equivalent roster was provided (unlike Follow-Up-Person above).
  Needs either a small admin-maintained roster or a self-service path, once decided.

## Resolved

*(move an item here, with the date and how it was resolved, once a department actually
delivers — don't just delete it, so the history of what was asked/fixed stays visible.)*
