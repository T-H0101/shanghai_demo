#!/usr/bin/env bash
# 离线服务器一键部署（需已安装 Docker；Node/pnpm 使用本包 tools/）
# Postgres 启动优先级: docker compose → docker-compose → docker run（无 Compose 插件时兜底）
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP="$ROOT/app"
TOOLS="$ROOT/tools"
IMAGES="$ROOT/images"

export PATH="$TOOLS:$TOOLS/node/bin:$PATH"
# 跳过 pnpm 交互确认（避免重装 node_modules 时卡住）
export CI=true

chmod +x "$TOOLS/pnpm" "$TOOLS/node/bin/"* 2>/dev/null || true

echo "[bootstrap] Node: $(node -v)"
echo "[bootstrap] pnpm: $(pnpm -v)"

if ! command -v docker >/dev/null 2>&1; then
  echo "[bootstrap] 错误: 未找到 docker" >&2
  exit 1
fi

if ! docker image inspect postgres:17 >/dev/null 2>&1; then
  if [[ -f "$IMAGES/postgres17.tar" ]]; then
    echo "[bootstrap] docker load postgres17.tar ..."
    docker load -i "$IMAGES/postgres17.tar"
  else
    echo "[bootstrap] 错误: 无 postgres:17 镜像且缺少 images/postgres17.tar" >&2
    exit 1
  fi
fi

load_app_env() {
  if [[ -f "$APP/.env.local" ]]; then
    set -a
    # shellcheck disable=SC1091
    . "$APP/.env.local"
    set +a
  fi
}

wait_postgres_ready() {
  local container="${POSTGRES_CONTAINER_NAME:-unified_disc_postgres}"
  local i
  echo "[bootstrap] 等待 Postgres 就绪 ($container) ..."
  for i in $(seq 1 60); do
    if docker exec "$container" pg_isready -U unified -d unified_disc_platform >/dev/null 2>&1; then
      echo "[bootstrap] Postgres 已就绪"
      return 0
    fi
    sleep 2
  done
  echo "[bootstrap] 错误: Postgres 在 120s 内未就绪" >&2
  docker logs "$container" 2>&1 | tail -n 40 || true
  exit 1
}

# docker run 兜底（无 Compose 时）
start_postgres_docker_run() {
  local container="${POSTGRES_CONTAINER_NAME:-unified_disc_postgres}"
  local port="${POSTGRES_PORT:-5432}"
  local volume="${POSTGRES_VOLUME_NAME:-unified_disc_postgres_data}"
  local password="${POSTGRES_PASSWORD:-}"

  if [[ -z "$password" ]]; then
    echo "[bootstrap] 错误: POSTGRES_PASSWORD 未设置（请先 env:init 并检查 .env.local）" >&2
    exit 1
  fi

  if docker ps --format '{{.Names}}' | grep -qx "$container"; then
    echo "[bootstrap] 容器已在运行: $container"
    return 0
  fi

  if docker ps -a --format '{{.Names}}' | grep -qx "$container"; then
    echo "[bootstrap] 启动已有容器: $container"
    docker start "$container"
    return 0
  fi

  echo "[bootstrap] docker run 启动 postgres:17 (无 Compose 兜底)"
  docker run -d \
    --name "$container" \
    --restart unless-stopped \
    -e POSTGRES_USER=unified \
    -e POSTGRES_PASSWORD="$password" \
    -e POSTGRES_DB=unified_disc_platform \
    -e POSTGRES_INITDB_ARGS="-E UTF8" \
    -p "${port}:5432" \
    -v "${volume}:/var/lib/postgresql/data" \
    postgres:17
}

start_postgres() {
  load_app_env

  if docker compose version >/dev/null 2>&1; then
    echo "[bootstrap] db:up (docker compose)"
    (cd "$APP" && docker compose --env-file .env.local up -d --wait --wait-timeout 60 postgres) \
      || (cd "$APP" && docker compose --env-file .env.local up -d postgres)
    wait_postgres_ready
    return 0
  fi

  if command -v docker-compose >/dev/null 2>&1; then
    echo "[bootstrap] db:up (docker-compose)"
    (cd "$APP" && docker-compose --env-file .env.local up -d postgres)
    wait_postgres_ready
    return 0
  fi

  echo "[bootstrap] 未检测到 Compose，使用 docker run 分支"
  start_postgres_docker_run
  wait_postgres_ready
}

cd "$APP"

if [[ -f "$APP/.env.local" ]]; then
  echo "[bootstrap] 已有 .env.local，跳过 env:init --force（避免改密码与已有 PG volume 不一致）"
else
  echo "[bootstrap] env:init --force"
  pnpm env:init --force
fi
echo "[bootstrap] >>> 请确认 $APP/.env.local ：PUBLIC_APP_URL、密钥、DB 三处密码一致 <<<"
pnpm env:check || true

echo "[bootstrap] db:up"
start_postgres

echo "[bootstrap] db:init"
# 直接调脚本，避免 Windows 式 pnpm 包装差异；Linux 下与 pnpm db:init 等价
load_app_env
bash "$APP/databases/sprint-2b0/init-docker.sh"

if [[ ! -f "$APP/.next/standalone/server.js" ]]; then
  echo "[bootstrap] 未找到 standalone，需要先在打包机完成 Linux build" >&2
  echo "[bootstrap] 或在本机有网时执行: pnpm install && pnpm build" >&2
  exit 1
fi

echo "[bootstrap] 启动总控。健康检查: curl -fsS http://127.0.0.1:3000/api/system/health"
exec pnpm start
