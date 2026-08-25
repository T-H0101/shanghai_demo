-- ============================================================
-- Sprint R.100 — 物理位置回迁明细 tbl_restore_file → unified_restore_files
-- 支撑：task_type=1 + task_mode=2 任务详情路径 / 状态 / 错误展示
-- ============================================================

CREATE TABLE IF NOT EXISTS unified_restore_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_restore_file',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_restore_file_id BIGINT,
  task_id BIGINT,
  lib_ip VARCHAR(50),
  lib_port VARCHAR(20),
  mag_rfid VARCHAR(100),
  slot_order INTEGER,
  disc_side INTEGER,
  file_full_path TEXT,
  hash VARCHAR(128),
  size BIGINT,
  restore_root_path TEXT,
  restore_status SMALLINT,
  restore_comment TEXT,
  create_dt TIMESTAMPTZ,
  cmt VARCHAR(500),
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_restore_files_site_record_uniq UNIQUE (source_site_id, source_record_id)
);

COMMENT ON TABLE unified_restore_files IS
  'Unified mirror of source tbl_restore_file (physical restore details for task_type=1 task_mode=2)';

CREATE INDEX IF NOT EXISTS idx_unified_restore_files_site
  ON unified_restore_files (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_restore_files_task
  ON unified_restore_files (source_site_id, task_id);
CREATE INDEX IF NOT EXISTS idx_unified_restore_files_raw_gin
  ON unified_restore_files USING GIN (raw_data jsonb_path_ops);
