-- ============================================================
-- Sprint R.83.7 — 导入导出 + 监控 + 系统辅助族 15 张 DDL
-- ============================================================

-- 1. unified_csv_details ← tbl_csv_details (id) — single (list is meaningful)
CREATE TABLE IF NOT EXISTS unified_csv_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_csv_details',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_csv_id BIGINT,
  csv_name VARCHAR(500),
  csv_path VARCHAR(1000),
  csv_size BIGINT,
  csv_status VARCHAR(20),
  imported_at TIMESTAMPTZ,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_csv_details_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_csv_details IS 'Unified mirror of source tbl_csv_details';
CREATE INDEX IF NOT EXISTS idx_unified_csv_details_site ON unified_csv_details (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_csv_details_raw_gin ON unified_csv_details USING GIN (raw_data jsonb_path_ops);

-- 2. unified_import_folder_datas ← tbl_import_folder_data (id)
CREATE TABLE IF NOT EXISTS unified_import_folder_datas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_import_folder_data',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_data_id BIGINT,
  folder_id BIGINT,
  file_name VARCHAR(500),
  file_path VARCHAR(1000),
  file_size BIGINT,
  imported_at TIMESTAMPTZ,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_import_folder_datas_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_import_folder_datas IS 'Unified mirror of source tbl_import_folder_data';
CREATE INDEX IF NOT EXISTS idx_unified_import_folder_datas_site ON unified_import_folder_datas (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_import_folder_datas_raw_gin ON unified_import_folder_datas USING GIN (raw_data jsonb_path_ops);

-- 3. unified_import_folder_logs ← tbl_import_folder_log (id)
CREATE TABLE IF NOT EXISTS unified_import_folder_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_import_folder_log',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_log_id BIGINT,
  folder_id BIGINT,
  log_status VARCHAR(20),
  log_message TEXT,
  logged_at TIMESTAMPTZ,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_import_folder_logs_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_import_folder_logs IS 'Unified mirror of source tbl_import_folder_log';
CREATE INDEX IF NOT EXISTS idx_unified_import_folder_logs_site ON unified_import_folder_logs (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_import_folder_logs_raw_gin ON unified_import_folder_logs USING GIN (raw_data jsonb_path_ops);

-- 4. unified_import_folder_titles ← tbl_import_folder_title (id)
CREATE TABLE IF NOT EXISTS unified_import_folder_titles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_import_folder_title',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_title_id BIGINT,
  folder_id BIGINT,
  title_name VARCHAR(500),
  title_value VARCHAR(1000),
  sort_order INTEGER,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_import_folder_titles_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_import_folder_titles IS 'Unified mirror of source tbl_import_folder_title';
CREATE INDEX IF NOT EXISTS idx_unified_import_folder_titles_site ON unified_import_folder_titles (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_import_folder_titles_raw_gin ON unified_import_folder_titles USING GIN (raw_data jsonb_path_ops);

-- 5. unified_upload_details ← tbl_upload_details (id) — single (details is meaningful)
CREATE TABLE IF NOT EXISTS unified_upload_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_upload_details',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_upload_id BIGINT,
  upload_id BIGINT,
  file_name VARCHAR(500),
  file_path VARCHAR(1000),
  file_size BIGINT,
  uploaded_at TIMESTAMPTZ,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_upload_details_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_upload_details IS 'Unified mirror of source tbl_upload_details';
CREATE INDEX IF NOT EXISTS idx_unified_upload_details_site ON unified_upload_details (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_upload_details_raw_gin ON unified_upload_details USING GIN (raw_data jsonb_path_ops);

-- 6. unified_download_details ← tbl_download_details (id) — single
CREATE TABLE IF NOT EXISTS unified_download_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_download_details',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_download_id BIGINT,
  download_id BIGINT,
  file_name VARCHAR(500),
  file_path VARCHAR(1000),
  file_size BIGINT,
  downloaded_at TIMESTAMPTZ,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_download_details_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_download_details IS 'Unified mirror of source tbl_download_details';
CREATE INDEX IF NOT EXISTS idx_unified_download_details_site ON unified_download_details (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_download_details_raw_gin ON unified_download_details USING GIN (raw_data jsonb_path_ops);

-- 7. unified_export_infos ← tbl_export_info (id)
CREATE TABLE IF NOT EXISTS unified_export_infos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_export_info',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_export_id BIGINT,
  export_name VARCHAR(500),
  export_path VARCHAR(1000),
  export_format VARCHAR(20),
  exported_at TIMESTAMPTZ,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_export_infos_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_export_infos IS 'Unified mirror of source tbl_export_info';
CREATE INDEX IF NOT EXISTS idx_unified_export_infos_site ON unified_export_infos (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_export_infos_raw_gin ON unified_export_infos USING GIN (raw_data jsonb_path_ops);

-- 8. unified_error_rates ← tbl_error_rate (id)
CREATE TABLE IF NOT EXISTS unified_error_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_error_rate',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_rate_id BIGINT,
  rate_name VARCHAR(200),
  error_count INTEGER,
  total_count INTEGER,
  rate_value NUMERIC(10, 4),
  measured_at TIMESTAMPTZ,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_error_rates_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_error_rates IS 'Unified mirror of source tbl_error_rate';
CREATE INDEX IF NOT EXISTS idx_unified_error_rates_site ON unified_error_rates (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_error_rates_raw_gin ON unified_error_rates USING GIN (raw_data jsonb_path_ops);

-- 9. unified_escapes ← tbl_escape (id)
CREATE TABLE IF NOT EXISTS unified_escapes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_escape',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_escape_id BIGINT,
  escape_code VARCHAR(50),
  escape_name VARCHAR(200),
  escape_status VARCHAR(20),
  triggered_at TIMESTAMPTZ,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_escapes_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_escapes IS 'Unified mirror of source tbl_escape';
CREATE INDEX IF NOT EXISTS idx_unified_escapes_site ON unified_escapes (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_escapes_raw_gin ON unified_escapes USING GIN (raw_data jsonb_path_ops);

-- 10. unified_remote_backups ← tbl_remote_backup (id)
CREATE TABLE IF NOT EXISTS unified_remote_backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_remote_backup',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_backup_id BIGINT,
  backup_name VARCHAR(500),
  backup_path VARCHAR(1000),
  backup_size BIGINT,
  backup_status VARCHAR(20),
  backed_up_at TIMESTAMPTZ,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_remote_backups_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_remote_backups IS 'Unified mirror of source tbl_remote_backup';
CREATE INDEX IF NOT EXISTS idx_unified_remote_backups_site ON unified_remote_backups (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_remote_backups_raw_gin ON unified_remote_backups USING GIN (raw_data jsonb_path_ops);

-- 11. unified_monitor_paths ← tbl_monitor_path (id)
CREATE TABLE IF NOT EXISTS unified_monitor_paths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_monitor_path',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_path_id BIGINT,
  monitor_path VARCHAR(1000),
  path_status VARCHAR(20),
  interval_seconds INTEGER,
  last_checked_at TIMESTAMPTZ,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_monitor_paths_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_monitor_paths IS 'Unified mirror of source tbl_monitor_path';
CREATE INDEX IF NOT EXISTS idx_unified_monitor_paths_site ON unified_monitor_paths (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_monitor_paths_raw_gin ON unified_monitor_paths USING GIN (raw_data jsonb_path_ops);

-- 12. unified_platform_monitors ← tbl_platform_monitor (id)
CREATE TABLE IF NOT EXISTS unified_platform_monitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_platform_monitor',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_monitor_id BIGINT,
  platform_id BIGINT,
  monitor_metric VARCHAR(200),
  metric_value NUMERIC(20, 4),
  monitored_at TIMESTAMPTZ,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_platform_monitors_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_platform_monitors IS 'Unified mirror of source tbl_platform_monitor';
CREATE INDEX IF NOT EXISTS idx_unified_platform_monitors_site ON unified_platform_monitors (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_platform_monitors_raw_gin ON unified_platform_monitors USING GIN (raw_data jsonb_path_ops);

-- 13. unified_site_monitors ← tbl_site_monitor (id)
CREATE TABLE IF NOT EXISTS unified_site_monitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_site_monitor',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_site_monitor_id BIGINT,
  site_id BIGINT,
  monitor_metric VARCHAR(200),
  metric_value NUMERIC(20, 4),
  monitored_at TIMESTAMPTZ,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_site_monitors_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_site_monitors IS 'Unified mirror of source tbl_site_monitor';
CREATE INDEX IF NOT EXISTS idx_unified_site_monitors_site ON unified_site_monitors (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_site_monitors_raw_gin ON unified_site_monitors USING GIN (raw_data jsonb_path_ops);

-- 14. unified_project_monitor_files ← tbl_project_monitor_files (id) — plural already in source
CREATE TABLE IF NOT EXISTS unified_project_monitor_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_project_monitor_files',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_file_id BIGINT,
  project_id BIGINT,
  file_name VARCHAR(500),
  file_path VARCHAR(1000),
  monitor_status VARCHAR(20),
  monitored_at TIMESTAMPTZ,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_project_monitor_files_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_project_monitor_files IS 'Unified mirror of source tbl_project_monitor_files';
CREATE INDEX IF NOT EXISTS idx_unified_project_monitor_files_site ON unified_project_monitor_files (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_project_monitor_files_raw_gin ON unified_project_monitor_files USING GIN (raw_data jsonb_path_ops);

-- 15. unified_task_folders ← tbl_task_folder (id)
CREATE TABLE IF NOT EXISTS unified_task_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_task_folder',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_folder_id BIGINT,
  task_id BIGINT,
  folder_path VARCHAR(1000),
  folder_name VARCHAR(500),
  folder_status VARCHAR(20),
  created_at TIMESTAMPTZ,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_task_folders_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_task_folders IS 'Unified mirror of source tbl_task_folder';
CREATE INDEX IF NOT EXISTS idx_unified_task_folders_site ON unified_task_folders (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_task_folders_raw_gin ON unified_task_folders USING GIN (raw_data jsonb_path_ops);