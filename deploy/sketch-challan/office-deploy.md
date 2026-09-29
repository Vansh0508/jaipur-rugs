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

## Server setup (one script)

`deploy/sketch-challan/setup-server.sh` does the "Accounts" and "NAV data from the database" steps below in one go:
checks the four nav_mirror tables, creates the read-only login `sketch_challan_reader` (read-only is tested), writes
`.env.local`, creates everyone's sign-in from `people.csv`, builds and restarts. It prints each employee code with its
new password once. Safe to run again.

1. From the dev PC, copy the two git-ignored files (staff names and employee codes):
   ```bash
   scp apps/sketch-challan/data/people.csv apps/sketch-challan/data/roster.env idmt@192.168.0.18:~/apps/jaipur-rugs/apps/sketch-challan/data/
   ```
2. On the server:
   ```bash
   cd ~/apps/jaipur-rugs && git pull && bash deploy/sketch-challan/setup-server.sh
   ```
3. Hand each person their code and password privately. Admins see everything including Maps; `rackmgmt` sees only Maps.

## Accounts (employee code + Supabase password, roles by hand)

People sign in with their **employee code** and a password kept in the server's own Supabase (http://192.168.0.18:8000).
Supabase logins must be emails, so the app signs in as `<code>@<SKETCH_CHALLAN_AUTH_EMAIL_DOMAIN>` (not a real mailbox).
Roles are kept by hand in `data/demo-accounts.json` (no passwords there); the Hub's role tables are not used.

1. `.env.local`:
   ```ini
   SKETCH_CHALLAN_AUTH_URL=http://192.168.0.18:8000
   SKETCH_CHALLAN_AUTH_ANON_KEY=<anon key: Studio -> Project Settings -> API>
   SKETCH_CHALLAN_AUTH_EMAIL_DOMAIN=sketch.jaipurrugs.local
   ```
2. A list `people.csv` (no header): `employee_code,name,role[,sketcherName]`, role = `admin` | `rack` | `manager` | `sketcher`;
   `sketcherName` exactly as in the roster. E.g. `admin,Admin,admin` and `rackmgmt,Rack Management,rack`.
3. Create the logins and the role file in one go (service role key from the Supabase docker `.env`, `SERVICE_ROLE_KEY=`):
   ```bash
   SERVICE_ROLE_KEY=<key> python3 scripts/create_accounts.py people.csv
   ```
   It creates each Supabase user with a random password (leaves existing ones alone), writes `data/demo-accounts.json`
   (chmod 600) and prints each code and password once: hand them out privately.
4. `pnpm build && pm2 restart sketch-challan`. Later edits to the JSON file apply on the next sign-in.

A code with a Supabase login but no line in the file is told "Your account isn't set up for Sketch Challan yet".

## NAV data from the database (instead of the Excel inbox)

`/home/idmt/scheduler.py` copies the NAV reports into the server's Supabase, schema `nav_mirror`, several times a day
(full replace each time). With `NAV_DB_URL` set, **Refresh Excel** (challans) and **Refresh maps Excel** (Maps) read
those tables instead of the Excel folders. "Action to be Taken" is not a NAV field: the app works it out like the
NAV-145 sheet's formula (`lib/nav/actionToBeTaken.ts`). Map-size rule sheets stay as files.

1. Table names and owner: `docker exec supabase-db psql -U postgres -c "select tablename, tableowner from pg_tables where schemaname = 'nav_mirror' order by 1;"`.
   If a name differs from the defaults in `lib/nav/mirror.ts`, set `NAV_TABLE_145`, `NAV_TABLE_160`, `NAV_TABLE_028` or `NAV_TABLE_028_LIBRARY`.
2. A read-only login (replace `postgres` in the last line with the table owner from step 1 if different):
   ```bash
   PW=$(openssl rand -hex 16); echo "Save this password: $PW"
   docker exec -i supabase-db psql -U postgres -v ON_ERROR_STOP=1 <<SQL
   create role sketch_challan_reader login password '$PW';
   grant usage on schema nav_mirror to sketch_challan_reader;
   grant select on all tables in schema nav_mirror to sketch_challan_reader;
   alter default privileges for role postgres in schema nav_mirror grant select on tables to sketch_challan_reader;
   SQL
   ```
   The last line keeps access after each copy recreates the tables.
3. `.env.local`: `NAV_DB_URL=postgresql://sketch_challan_reader.<POOLER_TENANT_ID>:<password>@127.0.0.1:6543/postgres`, then `pnpm build && pm2 restart sketch-challan`.
4. Check: Refresh Excel should say "NAV database: NAV-160 (…), NAV-145 (…)"; the day after, check again (the tables are recreated overnight).

## 3. Where the reports go (only without NAV_DB_URL) (the RPA bot)

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
