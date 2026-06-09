#!/bin/bash
# ============================================================
# 中心库初始化脚本 - Docker 版本
# Sprint 2B.1 - 使用 Docker 容器内的 psql
# ============================================================
# 用法:
#   ./init-docker.sh                    # 使用默认连接
#   ./init-docker.sh --dry-run           # 仅验证连接
#   ./init-docker.sh --reset            # 重置数据库（删除所有表）
# ============================================================
#
# 特点:
# - 使用 Docker 容器内的 psql，不要求本机安装 PostgreSQL 客户端
# - 自动检查 Docker 容器状态
# - 支持 schema 和 seed 数据初始化
#
# ============================================================

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
  echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
  echo -e "${BLUE}[STEP]${NC} $1"
}

# 显示帮助
show_help() {
  echo "Usage: $0 [OPTIONS]"
  echo ""
  echo "Options:"
  echo "  -h, --help              显示帮助"
  echo "  --dry-run              仅验证连接，不执行 DDL"
  echo "  --reset               重置数据库（删除所有表后重建）"
  echo ""
  echo "示例:"
  echo "  $0                     # 初始化 schema 和 seed"
  echo "  $0 --dry-run           # 仅验证连接"
  echo "  $0 --reset            # 重置数据库"
  echo ""
  echo "前提条件:"
  echo "  - Docker Desktop 运行中"
  echo "  - postgres 容器已启动: pnpm db:up"
}

# 解析参数
DRY_RUN=false
RESET=false

while [[ $# -gt 0 ]]; do
  case $1 in
    -h|--help)
      show_help
      exit 0
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --reset)
      RESET=true
      shift
      ;;
    *)
      log_error "未知参数: $1"
      show_help
      exit 1
      ;;
  esac
done

# 获取脚本目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Docker 配置
CONTAINER_NAME="unified_disc_postgres"
DB_NAME="unified_disc_platform"
DB_USER="unified"

# 使用 Docker psql 的辅助函数
docker_psql() {
  docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" "$@"
}

# 检查 Docker 容器状态
check_container() {
  log_step "检查 Docker 容器状态..."

  if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    log_error "容器 $CONTAINER_NAME 未运行"
    log_info "请先启动 Docker PostgreSQL:"
    log_info "  pnpm db:up"
    log_info ""
    log_info "或手动执行:"
    log_info "  docker compose up -d postgres"
    exit 1
  fi

  local status
  status=$(docker inspect --format '{{.State.Status}}' "$CONTAINER_NAME" 2>/dev/null)

  if [[ "$status" != "running" ]]; then
    log_error "容器状态不是 running: $status"
    exit 1
  fi

  log_info "容器状态: $status"
}

# 测试连接
test_connection() {
  log_info "测试数据库连接..."

  if ! docker_psql -c "SELECT 1;" &> /dev/null; then
    log_error "无法连接到数据库"
    log_info "请检查:"
    log_info "  1. Docker Desktop 是否运行中"
    log_info "  2. 容器是否健康: docker compose ps"
    exit 1
  fi

  log_info "连接成功!"
}

# 创建扩展
create_extensions() {
  log_info "创建必要扩展..."
  docker_psql -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";" 2>/dev/null || true
}

# 执行 SQL 文件
execute_sql_file() {
  local sql_file="$1"
  local description="${2:-SQL 文件}"

  if [[ ! -f "$sql_file" ]]; then
    log_error "$description 不存在: $sql_file"
    return 1
  fi

  log_info "执行 $description..."
  docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -f "/docker-entrypoint-initdb.d/$(basename "$sql_file")" 2>/dev/null || \
  docker cp "$sql_file" "$CONTAINER_NAME:/docker-entrypoint-initdb.d/" && \
  docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -f "/docker-entrypoint-initdb.d/$(basename "$sql_file")"
}

# 重置数据库（删除所有表）
reset_database() {
  log_warn "重置数据库 - 删除所有表..."

  local tables=$(docker_psql -t -c "SELECT string_agg(tablename, ', ') FROM pg_tables WHERE schemaname = 'public';" 2>/dev/null || echo "")

  if [[ -n "$tables" ]]; then
    log_info "删除表: $tables"
    docker_psql -c "DROP TABLE IF EXISTS $tables CASCADE;" 2>/dev/null || true
    docker_psql -c "DROP EXTENSION IF EXISTS \"uuid-ossp\" CASCADE;" 2>/dev/null || true
  fi

  log_info "数据库已重置"
}

# 验证表创建
verify_tables() {
  log_info "验证表创建..."
  echo "----------------------------------------"
  docker_psql -c "\dt" | grep -E "unified_|sites|sync_" || true
  echo "----------------------------------------"
}

# ============================================================
# 主流程
# ============================================================

echo ""
log_info "=========================================="
log_info "中心库初始化脚本 - Docker 版本"
log_info "=========================================="
echo ""

# 1. 检查容器
check_container

# 2. 测试连接
test_connection

# 3. Dry run 模式
if $DRY_RUN; then
  log_info "Dry run 模式 - 仅验证连接"
  exit 0
fi

# 4. 重置数据库（如需要）
if $RESET; then
  reset_database
fi

# 5. 创建扩展
create_extensions

# 6. 执行 schema
SCHEMA_FILE="$SCRIPT_DIR/unified_schema.sql"
if [[ -f "$SCHEMA_FILE" ]]; then
  log_step "执行 unified_schema.sql..."

  # 先检查表是否存在
  table_count=$(docker_psql -t -c "SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public';" 2>/dev/null | tr -d ' ' || echo "0")

  if [[ "$table_count" -gt 0 ]]; then
    log_warn "数据库已包含 $table_count 张表，跳过 schema 创建"
    log_info "使用 --reset 参数可重新初始化"
  else
    docker cp "$SCHEMA_FILE" "$CONTAINER_NAME:/tmp/unified_schema.sql"
    docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -f /tmp/unified_schema.sql
  fi
else
  log_error "Schema 文件不存在: $SCHEMA_FILE"
  exit 1
fi

# 7. 验证表创建
verify_tables

# 8. 执行 seed 数据
SEED_FILE="$SCRIPT_DIR/../sprint-2b1/seed.sql"
if [[ -f "$SEED_FILE" ]]; then
  log_step "执行 seed 数据..."

  seed_count=$(docker_psql -t -c "SELECT COUNT(*) FROM sites;" 2>/dev/null | tr -d ' ' || echo "0")

  if [[ "$seed_count" -gt 0 ]]; then
    log_warn "数据库已包含 $seed_count 条 sites 记录，seed 数据使用 ON CONFLICT DO NOTHING，不会重复插入"
  fi

  # 直接执行 seed.sql（使用 COPY 或直接执行）
  docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" < "$SEED_FILE"
else
  log_info "未找到 seed.sql，跳过数据插入"
fi

# 9. 显示统计
echo ""
log_info "=========================================="
log_info "初始化完成!"
log_info "=========================================="
echo ""
log_info "数据统计:"
echo "----------------------------------------"
docker_psql -c "
SELECT 'sites' as tbl, COUNT(*) as cnt FROM sites
UNION ALL SELECT 'sync_sites', COUNT(*) FROM sync_sites
UNION ALL SELECT 'unified_tasks', COUNT(*) FROM unified_tasks
UNION ALL SELECT 'unified_devices', COUNT(*) FROM unified_devices
UNION ALL SELECT 'unified_volumes', COUNT(*) FROM unified_volumes
UNION ALL SELECT 'unified_alerts', COUNT(*) FROM unified_alerts;
" 2>/dev/null || true
echo "----------------------------------------"
echo ""
log_info "下一步:"
log_info "  1. 验证 API: curl http://localhost:3000/api/system/db-health"
log_info "  2. 查看统计: curl http://localhost:3000/api/system/db-summary"
log_info "  3. 停止数据库: pnpm db:down"