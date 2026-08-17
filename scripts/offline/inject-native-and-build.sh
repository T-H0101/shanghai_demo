#!/usr/bin/env bash
set -euo pipefail
export CI=true
export PATH="/tools:/tools/node/bin:$PATH"
chmod +x /tools/pnpm
cd /app
pnpm config set verify-deps-before-run false

if [[ -f /vendor/lightningcss-linux-x64-gnu.tgz ]]; then
  echo "[inject] lightningcss-linux-x64-gnu"
  mkdir -p /tmp/lc
  rm -rf /tmp/lc/package
  tar -xzf /vendor/lightningcss-linux-x64-gnu.tgz -C /tmp/lc
  LC_ROOT="$(find /app/node_modules/.pnpm -path '*lightningcss@1.32.0/node_modules/lightningcss' -type d | head -1)"
  echo "[inject] LC_ROOT=${LC_ROOT}"
  if [[ -n "${LC_ROOT}" ]]; then
    PARENT="$(dirname "${LC_ROOT}")"
    rm -rf "${PARENT}/lightningcss-linux-x64-gnu"
    mkdir -p "${PARENT}/lightningcss-linux-x64-gnu"
    cp -a /tmp/lc/package/. "${PARENT}/lightningcss-linux-x64-gnu/"
    # lightningcss node/index.js looks for ../lightningcss.linux-x64-gnu.node
    if [[ -f "${PARENT}/lightningcss-linux-x64-gnu/lightningcss.linux-x64-gnu.node" ]]; then
      cp -f "${PARENT}/lightningcss-linux-x64-gnu/lightningcss.linux-x64-gnu.node" "${LC_ROOT}/"
    fi
    ls "${PARENT}/lightningcss-linux-x64-gnu" | head
  fi
fi

if [[ -f /vendor/swc-linux-x64-gnu.tgz ]] && [[ ! -d node_modules/@next/swc-linux-x64-gnu ]]; then
  echo "[inject] @next/swc-linux-x64-gnu"
  mkdir -p /tmp/swc node_modules/@next
  rm -rf /tmp/swc/package
  tar -xzf /vendor/swc-linux-x64-gnu.tgz -C /tmp/swc
  mv /tmp/swc/package node_modules/@next/swc-linux-x64-gnu
fi

pnpm build
