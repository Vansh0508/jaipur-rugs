#!/usr/bin/env bash
# ==============================================================================
# Linux / WSL / Git-Bash Deployment Script for Next.js BOM Management
# ==============================================================================
set -euo pipefail

SERVER_USER="${1:-jaipurrugs}"
SERVER_HOST="${2:-192.168.0.82}"
REMOTE_PATH="${3:-/home/jaipurrugs/bom-app}"
SSH_PORT="${4:-22}"

if [ -z "$SERVER_USER" ]; then
    read -rp "Enter SSH Username [default: jaipurrugs]: " SERVER_USER
    SERVER_USER="${SERVER_USER:-jaipurrugs}"
fi

if [ -z "$SERVER_HOST" ]; then
    read -rp "Enter Server IP / Hostname [default: 192.168.0.82]: " SERVER_HOST
    SERVER_HOST="${SERVER_HOST:-192.168.0.82}"
fi

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
ARCHIVE_NAME="deploy_bom_${TIMESTAMP}.tar.gz"

echo "=== [1/4] Creating deployment archive ==="
tar --exclude='node_modules' \
    --exclude='.next' \
    --exclude='.git' \
    --exclude='*.tsbuildinfo' \
    --exclude='deploy*.tar.gz' \
    -czf "${ARCHIVE_NAME}" .

echo "=== [2/4] Uploading archive to ${SERVER_USER}@${SERVER_HOST}:/tmp/${ARCHIVE_NAME} ==="
scp -P "${SSH_PORT}" "${ARCHIVE_NAME}" "${SERVER_USER}@${SERVER_HOST}:/tmp/${ARCHIVE_NAME}"

if [ -f ".env.local" ]; then
    echo "Uploading .env.local..."
    scp -P "${SSH_PORT}" ".env.local" "${SERVER_USER}@${SERVER_HOST}:/tmp/.env.local"
fi

echo "=== [3/4] Running remote build and PM2 restart ==="
ssh -p "${SSH_PORT}" "${SERVER_USER}@${SERVER_HOST}" bash -s <<EOF
set -e
mkdir -p "${REMOTE_PATH}"
tar -xzf /tmp/${ARCHIVE_NAME} -C "${REMOTE_PATH}"
rm -f /tmp/${ARCHIVE_NAME}

if [ -f /tmp/.env.local ]; then
    mv -f /tmp/.env.local "${REMOTE_PATH}/.env.local"
fi

cd "${REMOTE_PATH}"
echo "Installing dependencies..."
npm install

echo "Building Next.js app..."
npm run build

if ! command -v pm2 &> /dev/null; then
    echo "Installing PM2..."
    sudo npm install -g pm2 || npm install -g pm2
fi

echo "Restarting application with PM2..."
pm2 reload ecosystem.config.cjs --update-env || pm2 start ecosystem.config.cjs
pm2 save
pm2 list
EOF

echo "=== [4/4] Cleaning up local archive ==="
rm -f "${ARCHIVE_NAME}"

echo "Deployment complete! Application is running on http://${SERVER_HOST}:3005"
