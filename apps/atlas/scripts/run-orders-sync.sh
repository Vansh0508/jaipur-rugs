#!/bin/bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 22 >/dev/null 2>&1
cd /home/idmt/apps/jaipur-rugs/apps/atlas
node --env-file=.env.local scripts/orders-sync.mjs
