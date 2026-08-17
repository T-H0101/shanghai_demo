#!/usr/bin/env bash
set -euo pipefail
export CI=true
export PATH="/tools:/tools/node/bin:$PATH"
chmod +x /tools/pnpm
cd /app
pnpm config set verify-deps-before-run false

link_optional() {
  local parent="$1"
  local name="$2"
  local src
  src="$(find /app/node_modules/.pnpm -path "*/node_modules/${name}" -type d 2>/dev/null | head -1 || true)"
  if [[ -z "${src}" ]]; then
    echo "[link] missing source for ${name}"
    return 0
  fi
  mkdir -p "${parent}"
  rm -rf "${parent}/${name}"
  ln -sfn "${src}" "${parent}/${name}"
  echo "[link] ${parent}/${name} -> ${src}"
  # also copy .node next to package root if present (lightningcss node/index.js uses ../xxx.node)
  local nodef
  nodef="$(find "${src}" -name '*.node' | head -1 || true)"
  if [[ -n "${nodef}" ]]; then
    local pkg_root
    pkg_root="$(dirname "${parent}")/$(basename "${parent}")"
  fi
}

# lightningcss: expect sibling lightningcss-linux-x64-gnu and/or .node file at package root
LC_DIR="$(find /app/node_modules/.pnpm -path '*/lightningcss@1.32.0/node_modules/lightningcss' -type d | head -1)"
LC_NATIVE="$(find /app/node_modules/.pnpm -path '*/lightningcss-linux-x64-gnu@1.32.0/node_modules/lightningcss-linux-x64-gnu' -type d | head -1)"
if [[ -n "${LC_DIR}" && -n "${LC_NATIVE}" ]]; then
  ln -sfn "${LC_NATIVE}" "$(dirname "${LC_DIR}")/lightningcss-linux-x64-gnu"
  NODE_FILE="$(find "${LC_NATIVE}" -name 'lightningcss.linux-x64-gnu.node' | head -1)"
  if [[ -n "${NODE_FILE}" ]]; then
    cp -f "${NODE_FILE}" "${LC_DIR}/lightningcss.linux-x64-gnu.node"
  fi
  echo "[link] lightningcss natives ok"
fi

OX_DIR="$(find /app/node_modules/.pnpm -path '*/@tailwindcss+oxide@4.3.0/node_modules/@tailwindcss/oxide' -type d | head -1)"
OX_NATIVE="$(find /app/node_modules/.pnpm -path '*/@tailwindcss+oxide-linux-x64-gnu@4.3.0/node_modules/@tailwindcss/oxide-linux-x64-gnu' -type d | head -1)"
if [[ -n "${OX_DIR}" && -n "${OX_NATIVE}" ]]; then
  ln -sfn "${OX_NATIVE}" "$(dirname "${OX_DIR}")/oxide-linux-x64-gnu"
  NODE_FILE="$(find "${OX_NATIVE}" -name 'tailwindcss-oxide.linux-x64-gnu.node' | head -1)"
  if [[ -n "${NODE_FILE}" ]]; then
    cp -f "${NODE_FILE}" "${OX_DIR}/tailwindcss-oxide.linux-x64-gnu.node"
  fi
  echo "[link] oxide natives ok"
fi

if [[ -f /vendor/swc-linux-x64-gnu.tgz ]] && [[ ! -d node_modules/@next/swc-linux-x64-gnu ]]; then
  mkdir -p /tmp/swc node_modules/@next
  tar -xzf /vendor/swc-linux-x64-gnu.tgz -C /tmp/swc
  mv /tmp/swc/package node_modules/@next/swc-linux-x64-gnu
fi

ls -la "$(dirname "${LC_DIR}")" | head -20 || true
pnpm build
