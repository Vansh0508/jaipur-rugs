# Linux Server SSH & PM2 Deployment Guide

This guide explains how to push and deploy the **Next.js BOM Management** application directly to your Linux server via SSH using the automated deployment tools.

---

## 🚀 Quick Deployment (One Command)

From your Windows terminal (PowerShell) inside the project folder:

```powershell
.\scripts\deploy.ps1
```

The script will prompt you for:
1. **SSH Username** (e.g. `ubuntu` or `root`)
2. **Server IP / Hostname** (e.g. `192.168.1.50` or `bom.mycompany.com`)
3. **Destination Path** on Linux (default: `/var/www/bom-app` or `/home/ubuntu/bom-app`)

### Or pass parameters directly:

```powershell
.\scripts\deploy.ps1 -ServerUser "ubuntu" -ServerHost "192.168.1.50" -RemotePath "/var/www/bom-app"
```

If you use an SSH private key file (`.pem` / `id_rsa`):
```powershell
.\scripts\deploy.ps1 -ServerUser "ubuntu" -ServerHost "192.168.1.50" -RemotePath "/var/www/bom-app" -SshKey "C:\Users\username\.ssh\my-key.pem"
```

---

## ⚙️ What the Deployment Script Does Automatically

1. **Creates a lightweight `.tar.gz` archive** of the source code (~180 KB), automatically excluding heavy/temporary directories (`node_modules`, `.next`, `.git`, `.tsbuildinfo`).
2. **Streams the archive and `.env.local` to the Linux server** via native `scp.exe` in under 2 seconds.
3. **Connects via SSH** and executes:
   - Extraction into the target folder (e.g. `/var/www/bom-app`).
   - `npm install` (installs all dependencies).
   - `npm run build` (creates production Next.js build).
   - Starts or reloads the app with zero-downtime using **PM2** (`ecosystem.config.cjs`).
   - Saves PM2 state to auto-restart on server reboots (`pm2 save`).
4. **Cleans up** temporary `.tar.gz` archives both locally and on the server.

---

## 🛠️ Linux Server Prerequisites

Ensure your Linux server has **Node.js 20+** installed:

```bash
# Check version
node -v
npm -v

# If Node.js is not installed, install Node.js 20 LTS (Ubuntu/Debian):
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs build-essential
```

Ensure PM2 is configured to start on boot:
```bash
sudo npm install -g pm2
pm2 startup
# Run the command outputted by pm2 startup, then:
pm2 save
```

---

## 📋 Helpful PM2 Management Commands (On Linux Server)

Once deployed, you can manage the application on your server via SSH:

| Command | Action |
| --- | --- |
| `pm2 list` | View status, CPU, and memory usage |
| `pm2 logs bom-management` | Stream live application logs in real-time |
| `pm2 restart bom-management` | Restart the application |
| `pm2 reload bom-management` | Zero-downtime reload |
| `pm2 stop bom-management` | Stop the application |

---

## 🌐 (Optional) Nginx Reverse Proxy Configuration

To expose your application on port 80/443 (HTTP/HTTPS) or behind a domain name:

```nginx
server {
    listen 80;
    server_name bom.yourcompany.com;

    location / {
        proxy_pass http://127.0.0.1:3005;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
