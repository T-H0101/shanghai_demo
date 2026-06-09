-- ============================================================
-- Sprint 2F.1 - Task P0 runtime fields patch
-- ============================================================
-- unified_tasks 增加任务运行时字段
-- 仅在字段不存在时新增, 不覆盖现有
-- ============================================================

ALTER TABLE unified_tasks
  ADD COLUMN IF NOT EXISTS task_mode SMALLINT,
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS runtime_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS package_count INTEGER,
  ADD COLUMN IF NOT EXISTS success_count INTEGER,
  ADD COLUMN IF NOT EXISTS error_count INTEGER,
  ADD COLUMN IF NOT EXISTS progress INTEGER,
  ADD COLUMN IF NOT EXISTS current_phase TEXT;

COMMENT ON COLUMN unified_tasks.task_mode IS '源 tbl_task.task_mode (刻录模式)';
COMMENT ON COLUMN unified_tasks.error_message IS '源 tbl_task.ret_msg (错误信息)';
COMMENT ON COLUMN unified_tasks.runtime_seconds IS '计算: update_dt - create_dt (秒)';
COMMENT ON COLUMN unified_tasks.package_count IS '派生: SELECT count(*) FROM tbl_disc WHERE task_id = ?';
COMMENT ON COLUMN unified_tasks.success_count IS '派生: SUM(burn_success) FROM tbl_disc WHERE task_id = ?';
COMMENT ON COLUMN unified_tasks.error_count IS '派生: SUM(error_files) FROM tbl_disc WHERE task_id = ?';
COMMENT ON COLUMN unified_tasks.progress IS '源 tbl_disc.disc_progress 平均 (0-100), completed 任务 100';
COMMENT ON COLUMN unified_tasks.current_phase IS '源 tbl_disc.stage (或未来 tbl_interface_task.job_stage)';
