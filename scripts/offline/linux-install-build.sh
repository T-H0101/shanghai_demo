#!/usr/bin/env bash
# 在 Linux 容器内执行: 使用 /tools 下的便携 Node + pnpm 安装并构建
set -euo pipefail
export CI=true
export PATH="/tools:/tools/node/bin:$PATH"
chmod +x /tools/pnpm /tools/node/bin/node /tools/node/bin/npm /tools/node/bin/npx 2>/dev/null || true
cd /app
echo "[linux-build] node=$(node -v)"
echo "[linux-build] pnpm=$(pnpm -v)"

REGISTRY="${NPM_REGISTRY:-https://registry.npmmirror.com}"
echo "[linux-build] registry=$REGISTRY"
pnpm config set registry "$REGISTRY"
pnpm config set minimumReleaseAge 0
pnpm config set verify-deps-before-run false

STORE_ARGS=()
if [[ -d /pnpm-store ]]; then
  STORE_ARGS=(--store-dir /pnpm-store)
  export PNPM_STORE_PATH=/pnpm-store
  echo "[linux-build] using store /pnpm-store"
fi

if [[ "${PNPM_OFFLINE:-0}" == "1" ]]; then
  echo "[linux-build] offline install"
  pnpm install --frozen-lockfile --offline --registry "$REGISTRY" --config.confirmModulesPurge=false "${STORE_ARGS[@]}"
else
  pnpm install --frozen-lockfile --registry "$REGISTRY" --config.confirmModulesPurge=false "${STORE_ARGS[@]}"
fi

# 离线注入 Next SWC (避免 build 时从公网拉 @next/swc-linux-x64-gnu)
if [[ -f /vendor/swc-linux-x64-gnu.tgz ]]; then
  echo "[linux-build] inject @next/swc-linux-x64-gnu from vendor"
  mkdir -p /tmp/swc-extract node_modules/@next
  rm -rf /tmp/swc-extract/package node_modules/@next/swc-linux-x64-gnu
  tar -xzf /vendor/swc-linux-x64-gnu.tgz -C /tmp/swc-extract
  mv /tmp/swc-extract/package node_modules/@next/swc-linux-x64-gnu
fi

if [[ "${SKIP_BUILD:-0}" != "1" ]]; then
  echo "[linux-build] pnpm build ..."
  pnpm build
fi
echo "[linux-build] done"
