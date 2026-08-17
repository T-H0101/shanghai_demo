-- ============================================================
-- Sprint R.96 - 业务任务创建/结束时间
-- ============================================================
-- 源 tbl_task.create_dt / update_dt → unified_tasks.task_create_at / task_end_at
-- 与中心库 created_at / updated_at / synced_at（同步入库时间）区分
-- ============================================================

ALTER TABLE unified_tasks
  ADD COLUMN IF NOT EXISTS task_create_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS task_end_at TIMESTAMPTZ;

COMMENT ON COLUMN unified_tasks.task_create_at IS '业务任务创建时间，源 tbl_task.create_dt';
COMMENT ON COLUMN unified_tasks.task_end_at IS '业务任务结束/更新时间，源 tbl_task.update_dt';

CREATE INDEX IF NOT EXISTS idx_unified_tasks_task_create_at
  ON unified_tasks (source_site_id, task_create_at DESC NULLS LAST);

-- 已有行：从 raw_data 回填（下次 tbl_task 同步也会写入）
UPDATE unified_tasks
SET
  task_create_at = COALESCE(
    task_create_at,
    NULLIF(raw_data->>'create_dt', '')::timestamptz
  ),
  task_end_at = COALESCE(
    task_end_at,
    NULLIF(raw_data->>'update_dt', '')::timestamptz
  )
WHERE (task_create_at IS NULL OR task_end_at IS NULL)
  AND raw_data IS NOT NULL
  AND (
    NULLIF(raw_data->>'create_dt', '') IS NOT NULL
    OR NULLIF(raw_data->>'update_dt', '') IS NOT NULL
  );
