# Sketch Challan handoff

Notes for the next session. App: `apps/sketch-challan` in `https://github.com/Vansh0508/jaipur-rugs.git`, branch
`main`. **Live** on the office server: `http://192.168.0.18:3012` (PM2 `sketch-challan`, `~/apps/jaipur-rugs`).
Rules: `AGENTS.md` (this folder) binds; read it first. Updated 2026-09-29.

## Where the code lives

- Push from a clean clone of GitHub `main` (`C:\Users\daksh.j\jaipur-rugs-push` on the dev PC). The other copy,
  `C:\Users\daksh.j\jaipur-rugs`, is not a git repo and holds other people's unpushed work: keep the two in sync, but
  never push from it. Match each file's line endings to `main` when committing.
- Staff names and employee codes never go in git (the repo is public): they live only in the git-ignored
  `.env.local` (roster), `data/people.csv`, `data/roster.env` and `data/demo-accounts.json`.

## Run / check

```
npx next dev -p 3012            # in apps/sketch-challan; open http://localhost:3012
npx tsc --noEmit && npx vitest run --dir tests && npx next build
```

## Server

- Deploy/update: `deploy/sketch-challan/office-deploy.md`; one-time setup `deploy/sketch-challan/setup-server.sh`.
- Update: `cd ~/apps/jaipur-rugs && git pull && cd apps/sketch-challan && pnpm build && pm2 restart sketch-challan`.
  If `git pull` stops on `next-env.d.ts`, `git stash push -- '*next-env.d.ts'` first. Browsers: Ctrl+F5.
- Plain http: browser APIs that need https (`crypto.randomUUID`, clipboard) are missing. Use `lib/newId.ts` for ids.
- Data files (whole state): `data/demo-state.json` (challans, history) and `data/maps-state.json` (maps + ticks).
  To wipe a day of testing, move `demo-state.json` aside, restart, Refresh Excel.

## Sign-in and roles

- Employee code + password. The password is checked against the server's own Supabase (self-hosted,
  `192.168.0.18:8000`; login `<code>@sketch.jaipurrugs.local`); `data/demo-accounts.json` maps each code to a role.
- Accounts: write `data/people.csv` (`code,name,role[,sketcherName]`), then
  `python3 scripts/create_accounts.py data/people.csv [--name-passwords]` and rebuild. It creates missing Supabase
  users, (with the flag) sets everyone's password to `firstname@dnd`, writes the role file and rebuilds the roster.
  The temporary `firstname@dnd` passwords are still in use (2026-09-29): change them, admins first (Studio →
  Authentication → Users).
- Roles: `manager` (Sketching Manager; also takes parts), `sketcher`, `admin`, `rack` (New challan + Approved
  read-only, Maps with ticking). Current people: 8 sketchers + the manager, 2 admins, 2 rack logins. Four roster
  sketchers have no account yet (no employee codes).

## Challans (what the app does)

- Intake: NAV-160 and NAV-145. **Refresh Excel** (manager or admin) reads the `nav_mirror` tables in the server's
  Supabase when `NAV_DB_URL` is set (`lib/nav/mirror.ts`, read-only login `sketch_challan_reader`), else the Excel
  inbox. NAV-145 rows: only Action to be Taken = Print/Available; that column is computed like the sheet's formula
  (`lib/nav/actionToBeTaken.ts`, checked 133/133 against the sheet). Map sizes from the DND rule workbooks.
- Map No = the serial in nav_mirror `NAV-028 - Map Serial Output` whose Production Order No is the challan's
  (e.g. PDMAP2627/023590 -> 595228; `mapSerialsByOrder` in `lib/nav/mirror.ts`). NAV posts it days after the challan,
  so Map No is blank until then and fills in at the next Refresh Excel. NAV database mode only.
- Navigation: Home cards Sketch Challan / Admin approvals / Sketchers / My work / Maps; stages are tabs inside
  Sketch Challan.
- Flow: New → allot (manager) → sketcher Start / Done → Sketch approval (manager Approve / Send back, also from the
  table row) → Approved. After allotment, detail changes go to Admin approval (Approve / Reject, also from the row).
- Handover: manager or admin, applied at once, reason optional; workday credit kept per sketcher.
- Hold / Resume: manager or admin; resume moves the due date out by the days held; a held challan can't be worked.
- Status column everywhere: New · Allotted · In progress · On hold · Done (waiting for approval) · Approved.
- Challan date: the day it goes out (today in New; fixed at allotment; never before today).
- Whole-inch map sizes: built, **off** (`SKETCH_CHALLAN_ROUND_MAP_SIZE=true` + restart + Refresh Excel turns it on;
  waiting for the Sketching Manager to ask).

## Maps

- Admin and rack management only. Side tabs **In rack** / **Not available** / **Chosen**. Rack management ticks the
  rack/box copy it pulls for an order; it moves to Chosen and leaves every other order of that map
  (`lib/maps/choose.ts`, `app/api/maps-action`); Admin unticks a mistake. Ticks survive refreshes.
- Rows: NAV-145 Print/Available orders with a Production Order No. Columns: Prod Order No and Map No (bold, coloured),
  Design, Size, Shape, Ground, Border, Rack No, Box No; same map grouped with "needed · in rack". Action to be Taken,
  Quality and rug Item No are hidden (admins can show them).
- Copies: NAV-028 `Location Code = LOC-031`; hide Destroy Map = Yes, blank rack, box blank/0; rack/box as written;
  each copy is identified by its Serial No (not shown). **Refresh maps Excel** (admin) reads the NAV database when
  `NAV_DB_URL` is set, else `data/maps-inbox/`.

## Not done / next

- Four sketchers on the old roster have no account yet (no employee codes): add them when the codes arrive (append
  to `data/people.csv`, rerun the account script, rebuild).
- Change the temporary passwords.
- Later: an RPA bot fills Approved challans into NAV nightly (input format to agree; the app has Download Excel).
- The Supabase write path for challans (`db/sketch-challan/001`–`004`, `supabase/functions/sketch-challan-*`) is
  drafted, **not applied**. Data stays in the JSON files. Apply migrations only after an explicit OK.
- Open data questions for the business: 2 Make-to-Stock NAV-145 rows without a Production Order; Sumak has no
  map-size rule; NAV-160 Map No is always empty; MAP1155424 "Print" although the library has copies.
