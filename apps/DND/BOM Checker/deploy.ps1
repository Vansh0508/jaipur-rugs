Write-Host "Deploying bom-management to 192.168.0.82 (Port 3005)..." -ForegroundColor Cyan

$src  = "C:\Users\vansh.g\Desktop\DND Development\BOM Management"
$temp = "$env:LOCALAPPDATA\Temp\bom-deploy"
$zip  = "$env:LOCALAPPDATA\Temp\bom-webapp.zip"

Write-Host "[1/3] Packaging files..." -ForegroundColor Yellow
if (Test-Path $temp) { Remove-Item $temp -Recurse -Force }
if (Test-Path $zip)  { Remove-Item $zip }
robocopy $src $temp /E /XD "node_modules" ".next" ".git" /XF ".env*.backup" /NFL /NDL /NJH /NC /NP | Out-Null

# Copy local .env.local into package so the app has required DB and API credentials
if (Test-Path "$src\.env.local") {
    Copy-Item "$src\.env.local" "$temp\.env.local" -Force
}

Compress-Archive -Path $temp -DestinationPath $zip
Write-Host "Packaged." -ForegroundColor Green

Write-Host "[2/3] Uploading... (enter password when asked)" -ForegroundColor Yellow
scp $zip jaipurrugs@192.168.0.82:/home/jaipurrugs/bom-webapp.zip
if ($LASTEXITCODE -ne 0) {
    Write-Host "UPLOAD FAILED (exit code $LASTEXITCODE). Deploy aborted - server still has the old code." -ForegroundColor Red
    exit 1
}

Write-Host "[3/3] Building on server... (enter password when asked)" -ForegroundColor Yellow
ssh jaipurrugs@192.168.0.82 "chmod -R u+rwX ~/deploy-tmp 2>/dev/null; rm -rf ~/deploy-tmp && mkdir -p ~/deploy-tmp && unzip -o /home/jaipurrugs/bom-webapp.zip -d ~/deploy-tmp; chmod -R u+rwX ~/deploy-tmp; set -e; if [ -f /home/jaipurrugs/bom-management/.env.local ]; then cp /home/jaipurrugs/bom-management/.env.local ~/env-backup.local; fi; if [ -f /home/jaipurrugs/bom-management/.env.production ]; then cp /home/jaipurrugs/bom-management/.env.production ~/env-backup.production; fi; rm -rf /home/jaipurrugs/bom-management && mkdir -p /home/jaipurrugs/bom-management && cp -rp ~/deploy-tmp/bom-deploy/. /home/jaipurrugs/bom-management/ && if [ -f ~/env-backup.local ]; then cp ~/env-backup.local /home/jaipurrugs/bom-management/.env.local; fi && if [ -f ~/env-backup.production ]; then cp ~/env-backup.production /home/jaipurrugs/bom-management/.env.production; fi && rm -rf ~/deploy-tmp /home/jaipurrugs/bom-webapp.zip ~/env-backup.local ~/env-backup.production && cd /home/jaipurrugs/bom-management && npm install && npm run build && (pm2 restart bom-management 2>/dev/null || pm2 start npm --name 'bom-management' -- start -- -p 3005) && pm2 save"
if ($LASTEXITCODE -ne 0) {
    Write-Host "BUILD/DEPLOY FAILED ON SERVER (exit code $LASTEXITCODE). Scroll up to see the real error. The app is still running the PREVIOUS version." -ForegroundColor Red
    exit 1
}

Write-Host "Done! App live at http://192.168.0.82:3005" -ForegroundColor Green
