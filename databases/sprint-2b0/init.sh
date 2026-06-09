#!/bin/bash
# ============================================================
# 中心库初始化脚本
# Sprint 2B.0 - PostgreSQL 连接与中心库初始化
# ============================================================
# 用法:
#   ./init.sh              # 交互式输入
#   ./init.sh <connection_string>  # 直接指定连接字符串
# ============================================================

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

# 检查 psql 是否可用
check_psql() {
  if ! command -v psql &> /dev/null; then
    log_error "psql 未安装。请先安装 PostgreSQL 客户端."
    exit 1
  fi
}

# 显示帮助
show_help() {
  echo "Usage: $0 [OPTIONS]"
  echo ""
  echo "Options:"
  echo "  -h, --help              显示帮助"
  echo "  -d, --database URL      PostgreSQL 连接字符串"
  echo "  -f, --file FILE        SQL 文件路径 (默认: unified_schema.sql)"
  echo "  --dry-run              仅验证连接，不执行 DDL"
  echo ""
  echo "示例:"
  echo "  $0 -d 'postgresql://user:pass@localhost:5432/optical_disc_central'"
  echo "  $0 --dry-run"
  echo ""
  echo "环境变量:"
  echo "  DATABASE_URL            PostgreSQL 连接字符串"
}

# 解析参数
CONN_STRING=""
SQL_FILE="unified_schema.sql"
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case $1 in
    -h|--help)
      show_help
      exit 0
      ;;
    -d|--database)
      CONN_STRING="$2"
      shift 2
      ;;
    -f|--file)
      SQL_FILE="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    *)
      log_error "未知参数: $1"
      show_help
      exit 1
      ;;
  esac
done

# 获取连接字符串
if [[ -z "$CONN_STRING" ]]; then
  if [[ -z "$DATABASE_URL" ]]; then
    log_warn "请输入 PostgreSQL 连接字符串:"
    log_info "格式: postgresql://user:password@host:port/database"
    read -r CONN_STRING
  else
    CONN_STRING="$DATABASE_URL"
  fi
fi

if [[ -z "$CONN_STRING" ]]; then
  log_error "未提供连接字符串"
  exit 1
fi

# 获取脚本目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

check_psql

# 测试连接
log_info "测试数据库连接..."
if ! psql "$CONN_STRING" -c "SELECT 1;" &> /dev/null; then
  log_error "无法连接到数据库"
  exit 1
fi
log_info "连接成功!"

# 获取数据库名称
DB_NAME=$(echo "$CONN_STRING" | sed -E 's/.*\/([^?]+).*/\1/')
log_info "数据库: $DB_NAME"

if $DRY_RUN; then
  log_info "Dry run 模式 - 仅验证连接"
  exit 0
fi

# 创建扩展 (如果需要)
log_info "创建必要扩展..."
psql "$CONN_STRING" -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";" 2>/dev/null || true

# 执行 DDL
log_info "执行 DDL 脚本..."
SQL_PATH="$SCRIPT_DIR/$SQL_FILE"

if [[ ! -f "$SQL_PATH" ]]; then
  log_error "SQL 文件不存在: $SQL_PATH"
  exit 1
fi

psql "$CONN_STRING" -f "$SQL_PATH"

# 验证表创建
log_info "验证表创建..."
psql "$CONN_STRING" -c "\dt" | grep -E "unified_|sites|sync_" || true

# 执行 seed 数据（如果存在）
SEED_SQL="$SCRIPT_DIR/../sprint-2b1/seed.sql"
if [[ -f "$SEED_SQL" ]]; then
  log_info "执行 seed 数据..."
  psql "$CONN_STRING" -f "$SEED_SQL"
else
  log_info "未找到 seed.sql，跳过数据插入"
fi

log_info "========================================"
log_info "中心库初始化完成!"
log_info "========================================"
log_info ""
log_info "下一步:"
log_info "  1. 验证数据库连接: curl http://localhost:3000/api/system/db-health"
log_info "  2. 如需停止数据库: pnpm db:down"