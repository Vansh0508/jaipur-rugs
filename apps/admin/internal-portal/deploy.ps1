# Deploys internal-portal to the office server (192.168.0.18), the same box Atlas and
# CAD Layout already run on (see deploy/atlas/office-deploy.md, deploy/cad-layout/office-deploy.md).
#
# UNLIKE BOM Checker's deploy.ps1 (which zips your local disk and ships it straight to the
# server), this is a git-based deploy: internal-portal is a real pnpm-workspace member
# (workspace:* deps on @jaipur-rugs/auth, @jaipur-rugs/ui-kit, etc.), so it can only build
# correctly inside a full checkout of this monorepo with the workspace's own pnpm-lock.yaml
# — not from a zip of this folder alone. The server already has that checkout at
# ~/apps/jaipur-rugs; this script just pulls it up to date and rebuilds.
#
# THIS MEANS: your change must be committed AND pushed to `main` before running this,
# or `git pull` on the server won't see it. This script warns you if it isn't, but doesn't
# push for you.
#
# Usage:
#   .\deploy.ps1              # pull latest, build, restart (no dependency reinstall)
#   .\deploy.ps1 -Install     # also run `pnpm install` first — use when package.json or
#                             # pnpm-lock.yaml changed since the last deploy

param(
    [switch]$Install
)

$ErrorActionPreference = "Stop"

$RemoteUser = "idmt"
$RemoteHost = "192.168.0.18"
$RemoteRepo = "~/apps/jaipur-rugs"
$RemoteApp  = "$RemoteRepo/apps/admin/internal-portal"
$Port       = 3003   # from ecosystem.config.cjs — already running on the server at this port.

Write-Host "Deploying internal-portal to $RemoteUser@$RemoteHost (Port $Port)..." -ForegroundColor Cyan

# --- [0] Sanity check: is there anything local that hasn't reached origin/main yet? ---
Write-Host "[0/3] Checking local git state..." -ForegroundColor Yellow
$dirty = git status --porcelain -- "." 2>$null
if ($dirty) {
    Write-Host "WARNING: uncommitted changes under this app folder. git pull on the server will NOT see these:" -ForegroundColor Red
    Write-Host $dirty
}
git fetch origin main --quiet 2>$null
$ahead = git rev-list --count origin/main..HEAD 2>$null
if ($ahead -and $ahead -ne "0") {
    Write-Host "WARNING: local main is $ahead commit(s) ahead of origin/main. Push before deploying, or the server still won't see them." -ForegroundColor Red
}

# --- [1] Push .env.local up — gitignored, so `git pull` never brings it to the server ---
if (Test-Path ".env.local") {
    Write-Host "[1/3] Uploading .env.local... (enter password when asked)" -ForegroundColor Yellow
    scp ".env.local" "${RemoteUser}@${RemoteHost}:${RemoteApp}/.env.local"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ENV UPLOAD FAILED (exit code $LASTEXITCODE). Deploy aborted." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "[1/3] No local .env.local next to this script — skipping upload. Make sure the server already has one at $RemoteApp/.env.local (NEXT_PUBLIC_COOKIE_SECURE=false is required there — see .env.example)." -ForegroundColor Yellow
}

# --- [2] Pull latest code, (optionally) install, build, and (re)start on the server ---
# Node version dance (same as CAD Layout on this same box, see its ecosystem.config.cjs):
# the pm2 daemon here runs Node v20 and only that version's bin dir has `pm2` on it, but the
# workspace requires Node >= 22 to install/build (@supabase/supabase-js engine-strict). So we
# prepend v22's bin first (wins for `node`/`pnpm`) and keep v20's bin right after it (supplies
# `pm2`), rather than replacing PATH outright.
$installStep = ""
if ($Install) {
    $installStep = "pnpm install --frozen-lockfile && "
}

$remoteCmd = @"
set -e
export PATH="`$HOME/.nvm/versions/node/v20.20.2/bin:`$PATH"
cd $RemoteRepo
git pull
export PM2_NODE_INTERPRETER="`$HOME/.nvm/versions/node/v22.23.2/bin/node"
export PATH="`$HOME/.nvm/versions/node/v22.23.2/bin:`$PATH"
cd apps/admin/internal-portal
$installStep pnpm run build
(pm2 restart internal-portal || pm2 start ecosystem.config.cjs)
pm2 save
"@

Write-Host "[2/3] Pulling latest code and building on server... (enter password when asked)" -ForegroundColor Yellow
ssh "${RemoteUser}@${RemoteHost}" $remoteCmd
if ($LASTEXITCODE -ne 0) {
    Write-Host "BUILD/DEPLOY FAILED ON SERVER (exit code $LASTEXITCODE). Scroll up for the real error. The app is still running the PREVIOUS version." -ForegroundColor Red
    exit 1
}

Write-Host "[3/3] Done! App live at http://${RemoteHost}:${Port}" -ForegroundColor Green
Write-Host "Verify: curl -s -o /dev/null -w '%{http_code}\n' http://${RemoteHost}:${Port}/login  (expect 200)" -ForegroundColor Gray
