-- ============================================================
-- Sprint 4.8 - audit_log 总控审计日志表
-- ============================================================
-- 目的:
--   - 记录所有控制链路真实 DB 操作 (before/after 快照)
--   - 不替代 sync_table_log / control_command, 是独立审计层
--   - dev 环境 (SITE_WORKER_DRY_RUN=true) 也写, dry_run=true 标识
--
-- 数据来源:
--   - lib/control/executor.ts (Sprint 4.8 worker)
--   - 未来 ADFS 接入后, requestedBy 自动填 user
--
-- 保留期: 永久 (与 control_command 一致, 不自动删)
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  command_no TEXT NOT NULL,                  -- 关联 control_command.command_no
  action TEXT NOT NULL,                       -- 'task_pause' | 'task_resume' | 'task_reset' | 'inspect_start' | 'recovery_start'
  target_table TEXT NOT NULL,                 -- 'tbl_task' | 'tbl_disc' | ...
  target_id TEXT NOT NULL,                    -- 业务主键
  before_json JSONB,                          -- 修改前快照
  after_json JSONB,                           -- 修改后快照
  actor TEXT,                                 -- 触发人 (session.user / IP)
  actor_ip TEXT,
  site_code TEXT NOT NULL,                    -- 站点侧
  dry_run BOOLEAN DEFAULT FALSE,              -- dev 阶段 true
  result TEXT NOT NULL,                       -- 'success' | 'failed'
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引 (按 Sprint 4.8 设计文档 §5.1)
CREATE INDEX IF NOT EXISTS idx_audit_command_no ON audit_log(command_no);
CREATE INDEX IF NOT EXISTS idx_audit_site_created ON audit_log(site_code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_target ON audit_log(target_table, target_id);

COMMENT ON TABLE audit_log IS '总控审计日志: 所有控制链路真实 DB 操作 (暂停/恢复/重置/巡检/回迁) 的 before/after 快照';
COMMENT ON COLUMN audit_log.dry_run IS 'true = dev 阶段未真改站点 DB, 仅记录意图';

-- ============================================================
-- 初始化说明
-- ============================================================
-- 1. pnpm db:up
-- 2. docker exec -i unified_disc_postgres psql -U unified -d unified_disc_platform < databases/sprint-4.8/audit-log.sql
-- 3. 验证: \d audit_log
-- ============================================================
