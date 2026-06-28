-- ============================================================
-- Sprint R.83.9 — 收尾 8 张 DDL (备份辅助 + 磁盘/文件校验 + 硬盘 + 接收单明细 + 槽位分区 + 下载等待族)
-- ============================================================

-- 1. unified_backup_dbs ← tbl_backup_db (id)
CREATE TABLE IF NOT EXISTS unified_backup_dbs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_backup_db',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_id BIGINT,
  create_dt TIMESTAMPTZ,
  backup_path VARCHAR(255),
  status SMALLINT,
  progress SMALLINT,
  task_id BIGINT,
  cmt VARCHAR(200),
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_backup_dbs_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_backup_dbs IS 'Unified mirror of source tbl_backup_db';
CREATE INDEX IF NOT EXISTS idx_unified_backup_dbs_site ON unified_backup_dbs (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_backup_dbs_raw_gin ON unified_backup_dbs USING GIN (raw_data jsonb_path_ops);

-- 2. unified_disk_checks ← tbl_disk_check (id)
CREATE TABLE IF NOT EXISTS unified_disk_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_disk_check',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_id BIGINT,
  task_id BIGINT,
  hd_sn VARCHAR(100),
  volume_id INTEGER,
  check_mode INTEGER,
  cmt VARCHAR(500),
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_disk_checks_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_disk_checks IS 'Unified mirror of source tbl_disk_check';
CREATE INDEX IF NOT EXISTS idx_unified_disk_checks_site ON unified_disk_checks (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_disk_checks_raw_gin ON unified_disk_checks USING GIN (raw_data jsonb_path_ops);

-- 3. unified_diskfile_checks ← tbl_diskfile_check (id)
CREATE TABLE IF NOT EXISTS unified_diskfile_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_diskfile_check',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_id BIGINT,
  task_id INTEGER,
  volume_id INTEGER,
  file_path VARCHAR(1024),
  cmt VARCHAR(500),
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_diskfile_checks_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_diskfile_checks IS 'Unified mirror of source tbl_diskfile_check';
CREATE INDEX IF NOT EXISTS idx_unified_diskfile_checks_site ON unified_diskfile_checks (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_diskfile_checks_raw_gin ON unified_diskfile_checks USING GIN (raw_data jsonb_path_ops);

-- 4. unified_hd_powers ← tbl_hd_power (id)
CREATE TABLE IF NOT EXISTS unified_hd_powers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_hd_power',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_id BIGINT,
  task_id BIGINT,
  lib_id INTEGER,
  mag_id INTEGER,
  slot_order INTEGER,
  serial_num VARCHAR(50),
  duration INTEGER,
  up_dt TIMESTAMPTZ,
  down_dt TIMESTAMPTZ,
  status SMALLINT,
  smart TEXT,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_hd_powers_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_hd_powers IS 'Unified mirror of source tbl_hd_power';
CREATE INDEX IF NOT EXISTS idx_unified_hd_powers_site ON unified_hd_powers (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_hd_powers_raw_gin ON unified_hd_powers USING GIN (raw_data jsonb_path_ops);

-- 5. unified_receipt_file_details ← tbl_receipt_file_detail (id)
CREATE TABLE IF NOT EXISTS unified_receipt_file_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_receipt_file_detail',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_id BIGINT,
  receipt_file_id BIGINT,
  file_name VARCHAR(765),
  path VARCHAR(765),
  file_size BIGINT,
  hash VARCHAR(65),
  create_date TIMESTAMPTZ,
  status SMALLINT,
  is_folder SMALLINT,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_receipt_file_details_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_receipt_file_details IS 'Unified mirror of source tbl_receipt_file_detail';
CREATE INDEX IF NOT EXISTS idx_unified_receipt_file_details_site ON unified_receipt_file_details (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_receipt_file_details_raw_gin ON unified_receipt_file_details USING GIN (raw_data jsonb_path_ops);

-- 6. unified_slots_parts ← tbl_slots_part (part_id)
CREATE TABLE IF NOT EXISTS unified_slots_parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_slots_part',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_part_id BIGINT,
  serial_num VARCHAR(50),
  part_name VARCHAR(100),
  file_sys VARCHAR(50),
  max_cap BIGINT,
  rest_cap BIGINT,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_slots_parts_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_slots_parts IS 'Unified mirror of source tbl_slots_part';
CREATE INDEX IF NOT EXISTS idx_unified_slots_parts_site ON unified_slots_parts (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_slots_parts_raw_gin ON unified_slots_parts USING GIN (raw_data jsonb_path_ops);

-- 7. unified_wait_download_files ← tbl_wait_download_file (id)
CREATE TABLE IF NOT EXISTS unified_wait_download_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_wait_download_file',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_id BIGINT,
  file_name VARCHAR(765),
  file_size BIGINT,
  file_path VARCHAR(765),
  create_time TIMESTAMPTZ,
  user_id INTEGER,
  data_type INTEGER,
  org_depa_id INTEGER,
  download_count INTEGER,
  details_count INTEGER,
  system_type SMALLINT,
  remark VARCHAR(500),
  cmt VARCHAR(500),
  file_status SMALLINT,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_wait_download_files_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_wait_download_files IS 'Unified mirror of source tbl_wait_download_file';
CREATE INDEX IF NOT EXISTS idx_unified_wait_download_files_site ON unified_wait_download_files (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_wait_download_files_raw_gin ON unified_wait_download_files USING GIN (raw_data jsonb_path_ops);

-- 8. unified_wait_download_file_tasks ← tbl_wait_download_file_task (composite PK: wait_download_id, task_id)
CREATE TABLE IF NOT EXISTS unified_wait_download_file_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_wait_download_file_task',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  wait_download_id BIGINT,
  task_id BIGINT,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_wait_download_file_tasks_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_wait_download_file_tasks IS 'Unified mirror of source tbl_wait_download_file_task';
CREATE INDEX IF NOT EXISTS idx_unified_wait_download_file_tasks_site ON unified_wait_download_file_tasks (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_wait_download_file_tasks_raw_gin ON unified_wait_download_file_tasks USING GIN (raw_data jsonb_path_ops);