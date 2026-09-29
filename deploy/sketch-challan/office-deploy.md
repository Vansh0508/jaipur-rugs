# Deploying Sketch Challan to the office server (192.168.0.18:3012)

**Status: written 2026-09-28, not yet deployed.** Same box and pattern as CAD Layout
(`deploy/cad-layout/office-deploy.md`) and Atlas: plain HTTP, PM2, the repo checked out at
`~/apps/jaipur-rugs`.

It runs in **demo mode**: logins from `data/demo-accounts.json`, all data in `data/*.json`. The
Supabase version (db/sketch-challan 001–004 plus the Edge Functions) is written but not wired yet;
see `db/sketch-challan/README.md` section 21.

| | |
|---|---|
| URL | `http://192.168.0.18:3012` (ports 3001, 3003, 3005 and 3006 are taken by other apps) |
| Process | PM2 `sketch-challan`, **one instance only**: the JSON store has an in-process lock |
| Memory | The Maps refresh needs ~2 GB while it reads NAV-028; `ecosystem.config.cjs` allows a 4 GB heap |
| Node | 22 for install and build; the pm2 daemon stays on v20 (see CAD Layout's notes) |

## 1. Get the code into git (from the dev PC)

`C:\Users\daksh.j\jaipur-rugs` is **not** a git repo, and it also holds other people's unpushed work
(Hub login recovery, shared types). Don't copy the whole folder into a checkout. Instead, on a fresh
clone of `main`, create a branch and copy in **only** these:

- `apps/sketch-challan/` (without `node_modules/`, `.next/`, `data/`, `.env.local`, `*.log`, `*.tsbuildinfo`, all git-ignored)
- `db/sketch-challan/`
- `supabase/functions/_shared/sketchChallan.ts` and `supabase/functions/sketch-challan-*/`
- `packages/db-management-client/src/sketch-challan.ts`, plus the line `export * from "./sketch-challan";` at the end of that package's `src/index.ts`
- `deploy/sketch-challan/` (this file)

Then run `pnpm install` at the repo root, so `pnpm-lock.yaml` picks up the new app. Commit the lockfile
with it, or the server's `--frozen-lockfile` install fails.

**The repo is public.** Before committing, check that no staff data or passwords are in the diff:
`git diff --cached | grep -i -E "password|mc-[0-9]{3}"` should find only sample values (MC-001…MC-006, sample matching codes).

## 2. Server setup (first time)

```bash
ssh idmt@192.168.0.18
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
cd ~/apps/jaipur-rugs && git pull
export PM2_NODE_INTERPRETER="$HOME/.nvm/versions/node/v22.23.2/bin/node"
export PATH="$HOME/.nvm/versions/node/v22.23.2/bin:$PATH"
pnpm install --frozen-lockfile
cd apps/sketch-challan
mkdir -p data/excel-inbox data/map-size-rules data/maps-inbox/inventory data/maps-inbox/orders
```

Create `apps/sketch-challan/.env.local`. It's git-ignored and read when the server starts:

```ini
SKETCH_CHALLAN_DEMO_MODE=true
# Optional: where the RPA drops the reports (defaults are the data/ folders above)
# SKETCH_CHALLAN_EXCEL_DIR=/home/idmt/nav-reports/challans
# SKETCH_CHALLAN_MAP_RULES_DIR=/home/idmt/nav-reports/map-size-rules
# MAPS_EXCEL_DIR=/home/idmt/nav-reports/maps
NEXT_PUBLIC_COOKIE_SECURE=false
# Sketcher roster: staff data, never in git. Copy the line from the dev PC's .env.local; rebuild after changing it.
NEXT_PUBLIC_SKETCH_CHALLAN_ROSTER="..."
```

Copy the files that must never go through git, from the dev PC:

```bash
scp "apps/sketch-challan/data/demo-accounts.json" idmt@192.168.0.18:~/apps/jaipur-rugs/apps/sketch-challan/data/
scp "apps/sketch-challan/data/map-size-rules/"*.xlsx idmt@192.168.0.18:~/apps/jaipur-rugs/apps/sketch-challan/data/map-size-rules/
```

`data/demo-secret` is generated on first use. Don't copy the PC's own copy, so the server signs its own
cookies.

## 3. Where the reports go (the RPA bot)

| Report | Folder | Used by |
|---|---|---|
| NAV-160 Map Routing Details | `data/excel-inbox/` | Refresh Excel (Sketching Manager) |
| NAV-145 Design Map Planning | `data/excel-inbox/` | Refresh Excel (Print/Available rows) **and** Maps orders; one copy serves both |
| NAV-028 Map Serial Inventory | `data/maps-inbox/inventory/` | Maps refresh (Admin); **never** the excel inbox, although the importer now skips it if it lands there |
| Map-size rule workbooks | `data/map-size-rules/` | Refresh Excel (map width/length) |

Every report in `excel-inbox` is read, oldest first, so the newest wins on a shared production order.
Overwrite a report in place with the same file name rather than piling up dated copies.

## 4. Build and start

```bash
pnpm build                       # PM2 does not build
pm2 start ecosystem.config.cjs   # process: sketch-challan, port 3012
pm2 save
```

## 5. Verify

```bash
pm2 list | grep sketch-challan                                            # online
curl -sS -o /dev/null -w '%{http_code}\n' http://localhost:3012/login     # 200
curl -sS -o /dev/null -w '%{http_code}\n' http://localhost:3012/          # 307 -> /login
ls -l /proc/$(pm2 pid sketch-challan)/exe                                 # the v22 node
```

From a LAN browser (`http://192.168.0.18:3012`):
1. Sign in as the Sketching Manager and confirm the login **sticks**.
2. Press Refresh Excel (about 25 s): it should report NAV-160 and NAV-145 row counts.
3. As Admin, press Refresh maps Excel (about 50 s).

## 6. Back up the data (demo mode keeps everything in two files)

`data/demo-state.json` (challans, assignments, history) and `data/maps-state.json` are the whole state.
Back them up daily:

```bash
mkdir -p ~/backups/sketch-challan
( crontab -l 2>/dev/null; echo '30 22 * * * cp ~/apps/jaipur-rugs/apps/sketch-challan/data/*-state.json ~/backups/sketch-challan/ && cd ~/backups/sketch-challan && for f in *-state.json; do cp "$f" "$(date +\%F)-$f"; done' ) | crontab -
```

## Updating later

```bash
cd ~/apps/jaipur-rugs && git pull && pnpm install --frozen-lockfile
cd apps/sketch-challan && pnpm build && pm2 restart sketch-challan
```

`git pull` and `pnpm build` never touch `data/` or `.env.local`.
