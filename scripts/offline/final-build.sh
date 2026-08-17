#!/usr/bin/env bash
set -euo pipefail
export CI=true
export PATH="/tools:/tools/node/bin:$PATH"
chmod +x /tools/pnpm
cd /app
pnpm config set verify-deps-before-run false

if [[ ! -d node_modules/@next/swc-linux-x64-gnu ]] && [[ -f /vendor/swc-linux-x64-gnu.tgz ]]; then
  mkdir -p /tmp/swc node_modules/@next
  tar -xzf /vendor/swc-linux-x64-gnu.tgz -C /tmp/swc
  mv /tmp/swc/package node_modules/@next/swc-linux-x64-gnu
fi

# sanity: lightningcss native
node -e 'const m=require("/app/node_modules/.pnpm/lightningcss@1.32.0/node_modules/lightningcss"); console.log("lightningcss keys", Object.keys(m).slice(0,5))'

pnpm build
