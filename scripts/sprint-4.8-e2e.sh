#!/usr/bin/env bash
# ============================================================
# Sprint 4.8.1.6 - Site Worker e2e 测试
# ============================================================
# 流程:
#   1. 创建 control_command (POST /api/control/commands)
#   2. 启 worker (pnpm worker:site) 后台
#   3. 等 5s
#   4. 查 control_command 状态 (GET /api/control/commands)
#   5. 查 audit_log 是否有新行
#   6. 验证 source_restore.tbl_task 数据未变 (DRY_RUN)
#   7. kill worker
#
# 安全:
#   - DB 密码从 .env.local 解析 (DATABASE_URL), 不硬编码
#   - .env.local 已被 .gitignore 保护
# ============================================================
set -euo pipefail

SITE_CODE="${SITE_WORKER_SITE_CODE:-SH01}"
BASE="${BASE_URL:-http://localhost:3000}"
WORKER_LOG="/tmp/worker-e2e.log"

# 从 .env.local 读 DB_PASSWORD 字段 (独立字段, 不解析 DATABASE_URL)
ENV_LOCAL="$(cd "$(dirname "$0")/.." && pwd)/.env.local"
if [ ! -f "$ENV_LOCAL" ]; then
  echo "FAIL: .env.local not found at $ENV_LOCAL"
  exit 1
fi
PGPASSWORD="$(grep -E '^DB_PASSWORD=' "$ENV_LOCAL" | head -1 | cut -d= -f2- | sed 's/^["'"'"']//;s/["'"'"']$//' | sed 's/\\\$/$/g')"
if [ -z "$PGPASSWORD" ]; then
  echo "FAIL: .env.local 缺少 DB_PASSWORD 字段"
  exit 1
fi

echo "=== Sprint 4.8.1.6 Site Worker e2e ==="
echo "site: $SITE_CODE"
echo "base: $BASE"
echo "PGPASSWORD: <从 .env.local DB_PASSWORD 读, 长度 ${#PGPASSWORD}>"

# 1. 启 worker (后台)
echo "[1] 启动 worker (DRY_RUN=true)..."
SITE_WORKER_SITE_CODE="$SITE_CODE" \
  SITE_WORKER_DRY_RUN=true \
  pnpm worker:site > "$WORKER_LOG" 2>&1 &
WORKER_PID=$!
sleep 4
if ! kill -0 $WORKER_PID 2>/dev/null; then
  echo "FAIL: worker 启动失败"
  cat "$WORKER_LOG"
  exit 1
fi
echo "  worker PID: $WORKER_PID"

# 2. 创建 3 个不同类型命令
echo "[2] 创建 3 个控制命令 (task_pause / inspect_start / recovery_start)..."
for cmd in task_pause inspect_start recovery_start; do
  RESP=$(curl -s -X POST "$BASE/api/control/commands" \
    -H "Content-Type: application/json" \
    -d "{\"sourceSiteId\":\"$SITE_CODE\",\"commandType\":\"$cmd\",\"targetType\":\"task\",\"targetId\":\"1\",\"payload\":{\"e2e\":true}}")
  echo "  $cmd: $RESP" | head -c 200
  echo ""
done

# 3. 等 worker 处理
echo "[3] 等待 5s (worker 5s 轮询间隔)..."
sleep 5

# 4. 查状态
echo "[4] 查 control_command 状态..."
curl -s "$BASE/api/control/commands?siteCode=$SITE_CODE&limit=5" | head -c 500
echo ""

# 5. 查 audit_log (密码从 .env.local 解析)
echo "[5] 查 audit_log (应 >=3 行)..."
docker exec -i unified_disc_postgres env "PGPASSWORD=$PGPASSWORD" psql \
  -U unified -d unified_disc_platform \
  -c "SELECT COUNT(*) AS audit_rows, MAX(created_at) AS last_audit FROM audit_log WHERE site_code='$SITE_CODE';" 2>&1 | tail -3

# 6. 验证 source_restore 未变
echo "[6] 验证 source_restore.tbl_task 数据未变 (DRY_RUN)..."
docker exec -i unified_disc_postgres env "PGPASSWORD=$PGPASSWORD" psql \
  -U unified -d source_restore \
  -c "SELECT id, task_name, status, burn_status FROM tbl_task WHERE id=1;" 2>&1 | tail -5

# 7. kill worker
echo "[7] 关闭 worker (PID $WORKER_PID)..."
kill -TERM $WORKER_PID 2>/dev/null || true
sleep 2
kill -9 $WORKER_PID 2>/dev/null || true

# 清理: PGPASSWORD 不留痕
unset PGPASSWORD

echo ""
echo "=== worker log tail ==="
tail -20 "$WORKER_LOG"
echo ""
echo "=== Sprint 4.8.1.6 e2e 完成 ==="
