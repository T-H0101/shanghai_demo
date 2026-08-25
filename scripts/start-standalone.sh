#!/usr/bin/env bash
# 生产 standalone 启动：自动定位项目根目录 .env.local 并注入进程环境
#
# 用法（推荐，会加载 .env.local）:
#   bash scripts/start-standalone.sh
#   pnpm start
#
# 不要直接:
#   node .next/standalone/server.js
# 那样不会加载 .env.local，且会被系统 HOSTNAME=localhost 绑到本机。
#
# build 后首次或更新后建议先:
#   pnpm build
#   bash scripts/start-standalone.sh --prepare-only

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$REPO_ROOT/.env.local"
STANDALONE_DIR="$REPO_ROOT/.next/standalone"
SERVER_JS="$STANDALONE_DIR/server.js"

PREPARE_ONLY=false
for arg in "$@"; do
  if [[ "$arg" == "--prepare-only" ]]; then
    PREPARE_ONLY=true
  fi
done

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[start-standalone] 未找到 .env.local: $ENV_FILE" >&2
  echo "[start-standalone] 请先在项目根执行: pnpm env:init" >&2
  exit 1
fi

if [[ ! -f "$SERVER_JS" ]]; then
  echo "[start-standalone] 未找到 standalone 产物: $SERVER_JS" >&2
  echo "[start-standalone] 请先执行: pnpm build" >&2
  exit 1
fi

# 去掉 Windows CRLF，避免 SYNC_PACKAGE_SECRET / DATABASE_URL 末尾带 ^M
set -a
# shellcheck disable=SC1090
source <(sed 's/\r$//' "$ENV_FILE")
set +a

# Next.js standalone 用 HOSTNAME 表示「监听地址」。
# Linux bash 会预置 HOSTNAME=本机名（常为 localhost），若写 ${HOSTNAME:-0.0.0.0}
# 会永远绑到 loopback，外机/站点推送都访问不了。
# 只认 .env.local 的 BIND_HOST 或 HOST；都未设则强制 0.0.0.0。
if [[ -n "${BIND_HOST:-}" ]]; then
  export HOSTNAME="$BIND_HOST"
elif [[ -n "${HOST:-}" ]]; then
  export HOSTNAME="$HOST"
else
  export HOSTNAME="0.0.0.0"
fi
export PORT="${PORT:-3000}"
export NODE_ENV="${NODE_ENV:-production}"

prepare_assets() {
  if [[ ! -d "$REPO_ROOT/.next/static" ]]; then
    echo "[start-standalone] 警告: 缺少 $REPO_ROOT/.next/static，请先 pnpm build" >&2
    return 1
  fi
  mkdir -p "$STANDALONE_DIR/.next"
  rm -rf "$STANDALONE_DIR/.next/static"
  cp -r "$REPO_ROOT/.next/static" "$STANDALONE_DIR/.next/static"
  if [[ -d "$REPO_ROOT/public" ]]; then
    rm -rf "$STANDALONE_DIR/public"
    cp -r "$REPO_ROOT/public" "$STANDALONE_DIR/public"
  fi
  echo "[start-standalone] 已同步 static / public 到 standalone 目录"
}

if [[ ! -d "$STANDALONE_DIR/.next/static" ]] || [[ ! -d "$STANDALONE_DIR/public" ]]; then
  prepare_assets
fi

if [[ "$PREPARE_ONLY" == true ]]; then
  echo "[start-standalone] --prepare-only 完成"
  exit 0
fi

missing=()
[[ -z "${DATABASE_URL:-}" ]] && missing+=("DATABASE_URL")
[[ -z "${SYNC_PACKAGE_SECRET:-}" ]] && missing+=("SYNC_PACKAGE_SECRET")
if ((${#missing[@]} > 0)); then
  echo "[start-standalone] .env.local 缺少必填项: ${missing[*]}" >&2
  exit 1
fi

echo "[start-standalone] repo=$REPO_ROOT"
echo "[start-standalone] env=$ENV_FILE"
echo "[start-standalone] listen=http://${HOSTNAME}:${PORT}"
if [[ "$HOSTNAME" == "localhost" || "$HOSTNAME" == "127.0.0.1" ]]; then
  echo "[start-standalone] 警告: 仅监听本机。站点推送需在 .env.local 设 BIND_HOST=0.0.0.0 或去掉误配的 HOST" >&2
fi
pub="${PUBLIC_APP_URL:-${NEXT_PUBLIC_APP_URL:-}}"
if [[ -z "$pub" ]]; then
  echo "[start-standalone] 警告: 未设 PUBLIC_APP_URL。HOSTNAME=0.0.0.0 时登录/OIDC/站点回跳不能用监听地址。请设为浏览器可打开的 https://IP或域名:对外端口" >&2
elif [[ "$pub" == *"0.0.0.0"* ]]; then
  echo "[start-standalone] 警告: PUBLIC_APP_URL 含 0.0.0.0，浏览器无法打开。请改为对外真实地址，例如 https://10.186.1.229:30000" >&2
else
  echo "[start-standalone] PUBLIC_APP_URL=$pub (对外 Origin)"
fi
echo "[start-standalone] SYNC_PACKAGE_SECRET len=${#SYNC_PACKAGE_SECRET}"
echo "[start-standalone] 提示: 请用本脚本启动；直接 node .next/standalone/server.js 不会加载 .env.local"

cd "$STANDALONE_DIR"
exec node server.js
