<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Sketch Challan

Binding rules: repo-root `AGENTS.md`, then this file. Read `HANDOFF.md` before changing behaviour.

Package: `@jaipur-rugs/sketch-challan`. Run from monorepo root:

```
npx --yes pnpm@10.15.1 --filter @jaipur-rugs/sketch-challan dev
npx --yes pnpm@10.15.1 --filter @jaipur-rugs/sketch-challan type-check
npx --yes pnpm@10.15.1 --filter @jaipur-rugs/sketch-challan test
```

Local demo: `http://127.0.0.1:3012` (scripts pin `-H 127.0.0.1 -p 3012`). Bind localhost only. Not Vercel. Not Google.

## Product

- Roles: Sketching Manager, Sketcher, Admin. **No Uploader.**
- Intake: live NAV Excel reports, refreshed ~4×/day by NAV. Manager **Refresh Excel** POSTs `/api/refresh-excel`, which reads **every** report in `data/excel-inbox/` (or `SKETCH_CHALLAN_EXCEL_DIR`), oldest first (newer wins a shared PO); `~$` lock files and files without a PO column are skipped; empty inbox seeds `demo-sketch-challans.xlsx`. Only the first sheet is parsed (NAV-145 has a ~570 MB unused inventory sheet); 150 MB file limit. NAV-160 Map Routing Details: PO = `MAP Production Order No_`. NAV-145 Design Map Planning: PO = `Production Order No_`, Map No = `MAP Item No_`, only rows with `Action to be Taken` = Print/Available. Merge on PO: each row records `excelFields`; a refresh overwrites only those, never wipes manager-entered fields, keeps tasks/remarks/priority/status/substitute design, and logs `Live Excel changed …` on allotted challans. No file picker. No folder watch. No NAV/API until asked.
- Main list: MUI X DataGrid in `components/ChallanTable.tsx`. TSV copy, header-click sort, checkbox multi-select, Show/Hide column bubbles (start hidden). Row click → paper preview. `disableRowSelectionOnClick`. Copy copies selected rows if any, else all visible.
- Table headers show sort affordances; every other row has a subtle light-grey background.
- Preview: `components/PaperChallan.tsx` matches Map Sketch Issue/Receive Challan. Native `<input>`/`<select>` on the form. Production Order locked. No second Edit panel. No `window.prompt`.
- Manager grid dropdowns: Sketch Category, Priority, Assigned to (sketcher + part + Assign). Stop click/mousedown so they do not open preview.
- Once any task is assigned, manager detail edits become a request. Only the Admin role can approve and apply the exact proposed values, or reject with a reason. The demo role picker is not production authorization.
- Task handovers retain each Sketcher's assignment history and workday credit. Credit starts at task Start, excludes Sundays and manager-recorded leave/non-work dates, and stops at handover or completion. The next Sketcher starts with zero credit until Start.
- Manager/Admin tabs: New challan · Allotted · Sketch approval · Approved · Admin approvals · Sketchers · Maps (shown as a left-pane nav once off Home) (`challanStage` in `lib/domain/assignments.ts`). Sketchers tab = card directory (`components/SketcherDirectory.tsx`) with per-sketcher history; cards are allowed there only.
- Allotment locks the challan for the manager: no grid edits, no extra parts, no handover. Admin does handovers/extra parts. Manager requests may be reason-only.
- Sketcher Done → task `submitted` → manager Approve (`completed`) or Send back with a note (`assigned`, credit resumes).
- Sketchers only receive their own rows/tasks (filtered server-side in `app/page.tsx`).
- Credit panel shows only when a challan has more than one sketcher. Manager/Admin always see the Challan history panel.
- Grid: universal search, pill rows single-line, drag-to-scroll with scrollbars hidden.
- Sketcher: own rows, one remark, Start/Done.
- Maps: see HANDOFF.md "Maps tab". View only; Admin and the rack management login (`role: "rack"`) only; admin refreshes the maps inbox.
- Admin: full table, preview, no Refresh.
- Never bento. Never card grids as the primary list. Exception (user-requested 2026-09-24): the Manager/Admin home is a card grid of sections (`components/HomeCards.tsx`, shared `StatCard`), each opening its DataGrid list; the Sketchers tab uses the same cards.
- Opened challan: paper form + actions on the left, handover/credit + Challan history in a sticky right column (stacks below `xl`).

## UI

- ui-kit: `Button`, `TextField`, `Select`, `Modal`, `DateField`, `Checkbox`. Hero UI only for unwrapped primitives (`Chip`).
- Exceptions: paper form + DataGrid native selects; DataGrid instead of ui-kit `Table`.
- Shell: Atlas `bg-app` + `bg-surface`. Theme tokens only.
- MUI DataGrid v8 `rowSelectionModel` is `{ type, ids: Set }`, not an array.

## Data / security

- Demo sidebar roles are fake. Do not describe demo as production RLS.
- Frontend Supabase is SELECT-only. Writes go through Edge Functions + RPC (`packages/db-management-client`, `supabase/functions/sketch-challan-*`).
- SQL `db/sketch-challan/001`–`003` is **not applied**. Do not treat files as live.
- Categories: 16 Excel spellings in `lib/domain/types.ts` (`Wirth Adjustment` kept). Do not coerce `Length Adjustment`.
- Map size: NAV `Size` is the order size. Map Width/Length come from DND rule workbooks in `data/map-size-rules/` (or `SKETCH_CHALLAN_MAP_RULES_DIR`), read on every refresh (`lib/mapSizeRules.ts`). Knotted + Indo Nepali: map = order − inches. Tufted: map = order + inches. No rule → order size + note.
- No PDF intake. `/api/parse-pdf` and `lib/pdf` were removed; data comes only from Excel.
- Demo login locally via `.env.local` `SKETCH_CHALLAN_DEMO_MODE=true` (server-only, read at runtime; never `NEXT_PUBLIC_`, which Next freezes into the build). Anything else = real login (fail closed). Demo cookies are signed (`lib/demoAuth.ts`, secret in `SKETCH_CHALLAN_DEMO_SECRET` or generated `data/demo-secret`).
- Demo mode uses a local cookie login. Logins live only in git-ignored `data/demo-accounts.json` (the repo is public: never write passwords into source or docs). The roster (names + machine numbers) is staff data, so it lives only in `.env.local` as `NEXT_PUBLIC_SKETCH_CHALLAN_ROSTER="Name:MC-no,..."` (baked in at build; unset = sample names Alpha…Foxtrot for dev/tests). Never write real staff names into source, tests or docs. The Sketching Manager is also on the roster, so he may take parts himself. Demo logins are local-only and must be replaced by Hub/Supabase accounts before deployment.
- Server inboxes are dedicated local folders the NAV reports are copied into (`SKETCH_CHALLAN_EXCEL_DIR`, `SKETCH_CHALLAN_MAP_RULES_DIR`, `MAPS_EXCEL_DIR`), never the shared Jvault folder.
- `data/` is runtime state and must never be traced into a build: keep the `/*turbopackIgnore: true*/` hints on every `data/` path and fs call (`next build` warns "Dynamic filesystem access" if one is missing).

Keep files under 500 lines. Do not commit secrets. Do not commit unless asked.
