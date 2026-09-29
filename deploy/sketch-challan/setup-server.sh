#!/usr/bin/env bash
# Sketch Challan: one-time setup on the office server (192.168.0.18). Run from the repo root:
#     cd ~/apps/jaipur-rugs && git pull && bash deploy/sketch-challan/setup-server.sh
# Before running, copy from the dev PC into apps/sketch-challan/data/: people.csv and roster.env (both git-ignored,
# they hold staff names and employee codes).
#
# What it changes, and nothing else:
#   - the database: creates (or re-passwords) the login sketch_challan_reader, which can only READ schema nav_mirror
#   - Supabase Auth: one user per line of people.csv (<code>@sketch.jaipurrugs.local, random password)
#   - apps/sketch-challan/.env.local and data/demo-accounts.json; then rebuilds and restarts the PM2 app
# Safe to run again: it keeps an existing NAV_DB_URL and leaves existing sign-ins' passwords alone.
set -euo pipefail
cd "$(dirname "$0")/../.."
APP=apps/sketch-challan
ENV=$APP/.env.local
DOMAIN=sketch.jaipurrugs.local
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
export PM2_NODE_INTERPRETER="$HOME/.nvm/versions/node/v22.23.2/bin/node"
export PATH="$HOME/.nvm/versions/node/v22.23.2/bin:$PATH"

step() { printf '\n== %s\n' "$*"; }
psqlq() { docker exec -i supabase-db psql -U postgres -v ON_ERROR_STOP=1 -tA "$@"; }
envval() { grep -m1 "^$1=" "$ENV" 2>/dev/null | cut -d= -f2- | tr -d '"' || true; }
setenv() {  # add or replace KEY=VALUE in .env.local
  touch "$ENV"
  { grep -v "^$1=" "$ENV" || true; printf '%s=%s\n' "$1" "$2"; } > "$ENV.tmp"
  mv "$ENV.tmp" "$ENV"; chmod 600 "$ENV"
}

step "1/8 Files from the dev PC"
for f in people.csv roster.env; do
  [ -f "$APP/data/$f" ] || { echo "Missing $APP/data/$f. Copy it from the dev PC first (office-deploy.md, 'Server setup')."; exit 1; }
done
echo "people.csv: $(grep -c . "$APP/data/people.csv") people"

step "2/8 Packages"
# (git pull is done before running this script: pulling while it runs could change the script under bash.)
pnpm install --frozen-lockfile

step "3/8 Supabase settings (read from its docker .env, not shown)"
SB_DIR=$(docker inspect supabase-db --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}')
sbenv() { grep -m1 "^$1=" "$SB_DIR/.env" | cut -d= -f2- | tr -d '"'; }
TENANT=$(sbenv POOLER_TENANT_ID); ANON=$(sbenv ANON_KEY); SERVICE=$(sbenv SERVICE_ROLE_KEY)
if [ -z "$TENANT" ] || [ -z "$ANON" ] || [ -z "$SERVICE" ]; then
  echo "Could not read POOLER_TENANT_ID, ANON_KEY and SERVICE_ROLE_KEY from $SB_DIR/.env"; exit 1
fi
echo "found in $SB_DIR/.env"

step "4/8 NAV tables in nav_mirror"
T145=$(envval NAV_TABLE_145); T145=${T145:-"NAV-145 - Design Map Planning Report"}
T160=$(envval NAV_TABLE_160); T160=${T160:-"NAV-160 - Map Routing Details - Sketch Checking and Development"}
T028=$(envval NAV_TABLE_028); T028=${T028:-"NAV-028 - Map Serial Inventory"}
TLIB=$(envval NAV_TABLE_028_LIBRARY); TLIB=${TLIB:-"NAV-028 - Map Serial Inventory - Map Library"}
for t in "$T145" "$T160" "$T028" "$TLIB"; do
  if [ "$(psqlq -c "select count(*) from pg_tables where schemaname = 'nav_mirror' and tablename = '$t'")" != 1 ]; then
    echo "Not found: nav_mirror.\"$t\". The tables there are:"
    psqlq -c "select tablename from pg_tables where schemaname = 'nav_mirror' order by 1"
    echo "Add the right names to $ENV as NAV_TABLE_145, NAV_TABLE_160, NAV_TABLE_028 or NAV_TABLE_028_LIBRARY, then run again."
    exit 1
  fi
done
OWNER=$(psqlq -c "select tableowner from pg_tables where schemaname = 'nav_mirror' and tablename = '$T145'")
echo "all four found; the copy job creates them as: $OWNER"

step "5/8 Read-only database login (sketch_challan_reader)"
if [ -n "$(envval NAV_DB_URL)" ]; then
  echo "NAV_DB_URL is already set: keeping it"
else
  PW=$(openssl rand -hex 16)
  if [ "$(psqlq -c "select count(*) from pg_roles where rolname = 'sketch_challan_reader'")" = 0 ]; then
    psqlq -c "create role sketch_challan_reader login password '$PW';" >/dev/null
  else
    psqlq -c "alter role sketch_challan_reader password '$PW';" >/dev/null
  fi
  psqlq >/dev/null <<SQL
grant usage on schema nav_mirror to sketch_challan_reader;
grant select on all tables in schema nav_mirror to sketch_challan_reader;
alter default privileges for role "$OWNER" in schema nav_mirror grant select on tables to sketch_challan_reader;
SQL
  setenv NAV_DB_URL "postgresql://sketch_challan_reader.$TENANT:$PW@127.0.0.1:6543/postgres"
  echo "created; saved in $ENV"
fi
URL=$(envval NAV_DB_URL)
ROWS=$(docker run --rm --network host postgres:16-alpine psql "$URL" -tA -c "select count(*) from nav_mirror.\"$T028\"")
echo "reads NAV-028: $ROWS rows"
if docker run --rm --network host postgres:16-alpine psql "$URL" -c "create table nav_mirror._sketch_challan_write_test(x int)" >/dev/null 2>&1; then
  psqlq -c "drop table nav_mirror._sketch_challan_write_test" >/dev/null
  echo "STOP: this login can write to nav_mirror. It must be read-only."; exit 1
fi
echo "writing is refused, as intended"

step "6/8 App settings ($ENV)"
setenv SKETCH_CHALLAN_DEMO_MODE true
setenv NEXT_PUBLIC_COOKIE_SECURE false
setenv SKETCH_CHALLAN_AUTH_URL http://127.0.0.1:8000
setenv SKETCH_CHALLAN_AUTH_ANON_KEY "$ANON"
setenv SKETCH_CHALLAN_AUTH_EMAIL_DOMAIN "$DOMAIN"
setenv NEXT_PUBLIC_SKETCH_CHALLAN_ROSTER "$(grep -m1 '^NEXT_PUBLIC_SKETCH_CHALLAN_ROSTER=' "$APP/data/roster.env" | cut -d= -f2-)"
echo "done"

step "7/8 Sign-in accounts"
if [ -f "$APP/data/demo-accounts.json" ] && grep -q '"password"' "$APP/data/demo-accounts.json"; then
  mv "$APP/data/demo-accounts.json" "$APP/data/demo-accounts.before-supabase.json"
  echo "old logins file (with passwords) moved to data/demo-accounts.before-supabase.json"
fi
( cd "$APP" && SERVICE_ROLE_KEY="$SERVICE" SUPABASE_URL=http://127.0.0.1:8000 python3 scripts/create_accounts.py data/people.csv )

step "8/8 Build and restart"
( cd "$APP" && pnpm build )
( cd "$APP" && { pm2 restart sketch-challan 2>/dev/null || { pm2 start ecosystem.config.cjs && pm2 save; }; } )
sleep 5
curl -s -o /dev/null -w "login page: HTTP %{http_code} (200 = up)\n" http://localhost:3012/login

printf '\nDone. Open http://192.168.0.18:3012, sign in with an employee code, press Refresh Excel:\n'
printf 'it should say "NAV database: NAV-160 (...), NAV-145 (...)". Hand out the passwords above privately.\n'
