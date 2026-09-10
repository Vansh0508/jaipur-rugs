@echo off
setlocal enabledelayedexpansion

:: ============================================================================
:: Atlas - build locally, ship the finished image to the VPS
:: ============================================================================
:: Why this exists: deploying by pulling git on the VPS and running
:: "docker compose build" there makes the VPS itself compile the whole Next.js
:: app - that compile step is what was spiking CPU on Hostinger's shared plan
:: and throttling the box for hours (also dragging down planit/n8n on the same
:: server, not just Atlas). This script does that compiling here instead, on
:: this machine, and only ships the VPS a finished, ready-to-run image. The
:: VPS's job shrinks to "unpack it and restart the container" - no compiling.
::
:: Requires (one-time): Docker Desktop installed and running on this machine,
:: and the SSH access to the VPS you already use today (same "ssh
:: root@72.62.228.150" that already works from this machine).
::
:: If the Dockerfile or the production build-time values ever change, update
:: BOTH this repo's deploy\atlas\Dockerfile / apps\atlas\.env.production.local
:: AND the matching files on the VPS (/docker/atlas/Dockerfile, /docker/atlas/.env)
:: - the two are meant to stay identical, see deploy\atlas\README.md.
:: ============================================================================

set VPS_HOST=root@72.62.228.150
set REMOTE_STAGING_DIR=/root/atlas-deploy
set REMOTE_COMPOSE_DIR=/docker/atlas
set IMAGE_TAG=atlas-atlas:latest
set SCRIPT_DIR=%~dp0
set REPO_ROOT=%SCRIPT_DIR%..\..
set ENV_FILE=%REPO_ROOT%\apps\atlas\.env.production.local
set TAR_FILE=%SCRIPT_DIR%atlas-image.tar

echo.
echo === Step 1/5: Checking Docker is running ===
docker info >nul 2>&1
if errorlevel 1 (
  echo ERROR: Docker doesn't seem to be running. Start Docker Desktop and try again.
  exit /b 1
)

if not exist "%ENV_FILE%" (
  echo ERROR: Missing %ENV_FILE%
  echo This file holds the production NEXT_PUBLIC_* build values - see its own comments.
  exit /b 1
)

:: Turn apps\atlas\.env.production.local's KEY=VALUE lines into --build-arg flags.
:: tokens=1,* keeps everything after the FIRST "=" as the value, so a value that
:: itself contains "=" (e.g. a base64 key with padding) still comes through whole.
set BUILD_ARGS=
for /f "usebackq eol=# tokens=1,* delims==" %%A in ("%ENV_FILE%") do (
  if not "%%A"=="" set BUILD_ARGS=!BUILD_ARGS! --build-arg %%A=%%B
)

echo.
echo === Step 2/5: Building the image locally (the slow, CPU-heavy part) ===
echo === it happens here now, not on the VPS ===
docker build -f "%SCRIPT_DIR%Dockerfile" -t %IMAGE_TAG% %BUILD_ARGS% "%REPO_ROOT%"
if errorlevel 1 (
  echo ERROR: docker build failed - nothing was sent to the VPS. Fix the error above and re-run.
  exit /b 1
)

echo.
echo === Step 3/5: Saving the finished image to a file ===
if exist "%TAR_FILE%" del /f /q "%TAR_FILE%"
docker save %IMAGE_TAG% -o "%TAR_FILE%"
if errorlevel 1 (
  echo ERROR: docker save failed.
  exit /b 1
)

echo.
echo === Step 4/5: Sending the image to the VPS (-C compresses it in transit) ===
ssh %VPS_HOST% "mkdir -p %REMOTE_STAGING_DIR%"
if errorlevel 1 (
  echo ERROR: Could not reach the VPS over SSH.
  exit /b 1
)
scp -C "%TAR_FILE%" %VPS_HOST%:%REMOTE_STAGING_DIR%/atlas-image.tar
if errorlevel 1 (
  echo ERROR: Transfer to the VPS failed. Nothing was restarted - Atlas is still running the old version.
  exit /b 1
)

echo.
echo === Step 5/5: Loading the image on the VPS and restarting the container ===
:: "docker compose up -d" without --build: Compose only builds when the image is
:: missing. Since we just loaded an image under the exact tag it expects
:: (atlas-atlas:latest), it finds it already there and just restarts the
:: container with it - no build happens on the VPS.
ssh %VPS_HOST% "docker load -i %REMOTE_STAGING_DIR%/atlas-image.tar && cd %REMOTE_COMPOSE_DIR% && docker compose up -d && rm -f %REMOTE_STAGING_DIR%/atlas-image.tar"
if errorlevel 1 (
  echo ERROR: Loading/restarting on the VPS failed - check the output above.
  echo The image file may still be sitting in %REMOTE_STAGING_DIR% on the VPS; check and clear it manually.
  exit /b 1
)

del /f /q "%TAR_FILE%"

echo.
echo === Done. Atlas on the VPS is now running the image built on this machine. ===
echo Verify: https://atlas.jaipurrugsai.cloud
endlocal
