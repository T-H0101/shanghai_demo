-- ============================================================
-- Sprint 4.5 — control_command 控制队列
-- 总控下发 / 站点轮询 / 站点回写结果 (Sprint 4.2-C 方案 2)
-- ============================================================
-- 目的:
--   - 不直接改 unified_tasks 状态, 不假实现控制
--   - 写入即 "已下发", 站点轮询后回写状态
--   - 未来 Auth/ADFS 解锁后, requested_by 自动填 user
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS control_command (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  command_no text UNIQUE NOT NULL,
  source_site_id text NOT NULL,
  command_type text NOT NULL
    CHECK (command_type IN (
      'task_pause',
      'task_resume',
      'task_reset',
      'task_priority_restore',
      'inspect_start',
      'recovery_start'
    )),
  target_type text NOT NULL
    CHECK (target_type IN ('task', 'device', 'volume', 'media')),
  target_id text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'pulled', 'running', 'success', 'failed', 'cancelled')),
  requested_by text,
  requested_ip text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  pulled_at timestamptz,
  completed_at timestamptz,
  result jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 索引 (按 Sprint 4.5 任务规格)
CREATE INDEX IF NOT EXISTS idx_control_site_status
  ON control_command(source_site_id, status, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_control_type_status
  ON control_command(command_type, status, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_control_target
  ON control_command(target_type, target_id);

CREATE INDEX IF NOT EXISTS idx_control_requested_at
  ON control_command(requested_at DESC);

-- 触发器: updated_at 自动更新
CREATE OR REPLACE FUNCTION trg_control_command_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS control_command_updated_at ON control_command;
CREATE TRIGGER control_command_updated_at
  BEFORE UPDATE ON control_command
  FOR EACH ROW EXECUTE FUNCTION trg_control_command_updated_at();

-- ============================================================
-- 初始化说明
-- ============================================================
-- 1. pnpm db:up
-- 2. docker exec -i unified_disc_postgres psql -U unified -d unified_disc_platform < databases/sprint-4.5/control-command.sql
-- 3. 验证: \d control_command
-- ============================================================
