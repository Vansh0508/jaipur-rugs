# Sketch Challan handoff

Local-only notes for the next session. App: `apps/sketch-challan`. Repo: `C:\Users\daksh.j\jaipur-rugs` → `https://github.com/Vansh0508/jaipur-rugs.git`. Branch `main` @ `6a1e89a`. **Uncommitted.** Do not push unless asked.

## Run

```
npx --yes pnpm@10.15.1 --filter @jaipur-rugs/sketch-challan dev
```

Open `http://127.0.0.1:3012`. Demo mode on. Last type-check: `tsc --noEmit` exit 0.

## Done (demo UI)

- Four-role workspace collapsed to **manager / sketcher / admin**. Default manager.
- Local demo sign-in replaces the unrestricted role switcher. Logins (Sketching Manager, Admin, one per sketcher) live only in `data/demo-accounts.json` (git-ignored; the repo is public, so never put passwords in source or docs). Copy that file to the server by hand; with no file nobody can sign in. On the server, passwords are checked against its own Supabase (`SKETCH_CHALLAN_AUTH_URL` + `SKETCH_CHALLAN_AUTH_ANON_KEY`, self-hosted at 192.168.0.18:8000): the file then only maps each email to a role, with no passwords (user, 2026-09-29; the Hub's role tables are not used). See deploy/sketch-challan/office-deploy.md "Accounts". The login cookie is signed (`username.HMAC`; secret `SKETCH_CHALLAN_DEMO_SECRET` or the generated `data/demo-secret`). Demo mode is the server-only `SKETCH_CHALLAN_DEMO_MODE`, read at runtime. The manager is also the manager on the roster: he can take parts and maps himself (Start/Done, Picked up) and approves his own submitted parts as manager.
- Excel-like **MUI DataGrid**: copy TSV, hide/show filter bubbles, header sort, checkboxes, PO click → paper form.
- Header sort cues and subtle alternating light-grey rows are visible in the DataGrid.
- After allotment, manager detail edits stay in a draft until submitted for Admin approval; Admin approve applies the exact patch, reject requires a note. Demo requests remain in React state only.
- Task handover records previous/current Sketchers, a reason, optional excluded leave dates and calculated workday credit (Monday–Saturday; Sunday excluded). Credit starts when the Sketcher starts the task.
- Paper preview with in-form dropdowns/text; 2 manager remarks + 1 sketcher remark.
- Manager in-grid: category, priority, sketcher+part Assign.
- **Refresh Excel** = POST `/api/refresh-excel` → newest Excel in `data/excel-inbox/` (seeds demo file if empty). Merge keeps remarks/assignments. Response `{ file, rows }`.
- Categories = 16 office Excel names as written.
- Parser page-box fix (height-before-width). Fixture: `PDMAP2627/023693`, Length Adjustment, 9×13.

## Maps tab (added 2026-09-28)

- View only (user, 2026-09-29): where each map sits in the MAP Library. Nothing is assigned or picked up. Only **Admin** (Maps tab + Home card, presses **Refresh maps Excel**) and the **rack management** login (`role: "rack"`, e.g. username `rackmgmt` in `data/demo-accounts.json`) see it; rack management sees only this screen (`components/RackView.tsx`) and is refused on every challan route. The Sketching Manager and sketchers never receive maps data.
- Inbox: `data/maps-inbox/inventory/` (NAV-028, sheet `NAV-028`) and `data/maps-inbox/orders/` (orders dump, `MAP Item No_` column). Newest file in each wins; `MAPS_EXCEL_DIR` overrides. 80 MB cap.
- Rules: `Location Code = LOC-031`; hide `Destroy Map = Yes`, blank Rack, Box blank/`0`; Rack/Box as written. Each refresh replaces the list.
- Rows: NAV-145 orders whose Action to be Taken is Print or Available (with a Production Order No). Columns (user, 2026-09-29): Prod Order No, Quality, Design, Size, Shape, Ground Color, Border Color, Map Item No, Action to be Taken, then Rack No and Box No of every usable LOC-031 copy looked up in NAV-028 by Map Item No ("Not in library" when none), then Assigned to and Status. A map with no copy can't be assigned.
- Files: `lib/maps/*`, `components/MapsTab.tsx`, `components/RackView.tsx`, `app/api/maps-refresh`, `tests/maps.test.ts`. Store `data/maps-state.json`.
- Refresh parses the 36 MB NAV-028 in ~25 s and ~2 GB RAM. Fine for admin-only; stream it if the dump grows.
- Demo-only like challans: no Supabase tables/RLS/Edge Functions for maps yet. Non-demo mode returns 404 for both routes.

## Audit fixes (2026-09-28)

Full audit and status: `G:\map-locator\AUDIT.md`. Server-side `applyAction` now rejects non-form patch keys, wrong types, sketcher self-"completed", a second Start, unknown/duplicate assignees, and remark edits by a former holder. Refresh Excel is manager-only. Paper inputs save on blur. Grid Assign asks for confirmation. Copy for Excel reports success/failure (http fallback). API calls without a session get a JSON 401.

## Not done

- SQL 001–003 not applied; types not regenerated; Edge Functions unused by UI.
- SQL 001–003 and the update Edge Function now include the drafted approval path and assignment work dates; these remain un-applied and un-deployed. The live UI still needs real role binding and API wiring.
- Demo writes stay in React state.
- No Hub employee list, hold/extend, transfer, blocked/clarification, 3-1-0 reminders, `/api/force-logout` wired into a real login path for demo, `ecosystem.config`, office deploy.
- Drop the office Excel into `data/excel-inbox/` and press Refresh Excel. On the server the inboxes are dedicated local folders that the NAV reports are copied into (`SKETCH_CHALLAN_EXCEL_DIR`, `SKETCH_CHALLAN_MAP_RULES_DIR`, `MAPS_EXCEL_DIR`), never the shared Jvault folder (user decision 2026-09-28).
- Monorepo root has no `package.json` / `pnpm-workspace.yaml` / lockfile / `.git`; `next.config.js` pins `turbopack.root`. Run `npm run dev` inside the app.
- Later (server push): role bindings + real roles in UI, SQL 003 task/transfer checks, SQL drafts revised 2026-09-28 (Excel intake, no PDF tables; due reminders are now pg_cron in `db/sketch-challan/004`, replacing `scripts/maintenance.ts`). `xlsx` stays on 0.18.5 (user decision 2026-09-28).
- No commit/PR.

## Touch these files

| File | Why |
|---|---|
| `components/SketchChallanWorkspace.tsx` | roles, refresh, assign, preview |
| `components/ChallanTable.tsx` | DataGrid |
| `components/PaperChallan.tsx` | paper form |
| `lib/importExcel.ts` | parse + merge |
| `app/api/refresh-excel/route.ts` | backend dump |
| `lib/domain/types.ts` | categories + remarks |
| `lib/demoData.ts` | demo rows / sketcher names |
| `db/sketch-challan/` | schema not live |

## Continue from

1. Put the real refreshable dump on the backend path.
2. Apply migrations only after explicit OK.
3. Swap fake roles for Hub + RLS.
4. Then commit/push for the office server `git pull`.
