-- ============================================================
-- Sprint R.83.5 — 数据接收 + 告警 + 媒体族 15 张 DDL
-- ============================================================

-- 1. unified_data_receive_lists ← tbl_data_receive_list (id)
CREATE TABLE IF NOT EXISTS unified_data_receive_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_data_receive_list',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_list_id BIGINT,
  list_name VARCHAR(200),
  description TEXT,
  total_count INTEGER,
  status VARCHAR(20),
  received_at TIMESTAMPTZ,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_data_receive_lists_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_data_receive_lists IS 'Unified mirror of source tbl_data_receive_list';
COMMENT ON COLUMN unified_data_receive_lists.src_list_id IS '自增接收清单ID';
CREATE INDEX IF NOT EXISTS idx_unified_data_receive_lists_site ON unified_data_receive_lists (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_data_receive_lists_raw_gin ON unified_data_receive_lists USING GIN (raw_data jsonb_path_ops);

-- 2. unified_data_receive_logs ← tbl_data_receive_log (id)
CREATE TABLE IF NOT EXISTS unified_data_receive_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_data_receive_log',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_log_id BIGINT,
  list_id BIGINT,
  log_level VARCHAR(20),
  message TEXT,
  logged_at TIMESTAMPTZ,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_data_receive_logs_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_data_receive_logs IS 'Unified mirror of source tbl_data_receive_log';
CREATE INDEX IF NOT EXISTS idx_unified_data_receive_logs_site ON unified_data_receive_logs (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_data_receive_logs_raw_gin ON unified_data_receive_logs USING GIN (raw_data jsonb_path_ops);

-- 3. unified_data_receive_tasks ← tbl_data_receive_tasks (id)
CREATE TABLE IF NOT EXISTS unified_data_receive_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_data_receive_tasks',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_task_id BIGINT,
  list_id BIGINT,
  task_type VARCHAR(50),
  status VARCHAR(20),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_data_receive_tasks_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_data_receive_tasks IS 'Unified mirror of source tbl_data_receive_tasks';
CREATE INDEX IF NOT EXISTS idx_unified_data_receive_tasks_site ON unified_data_receive_tasks (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_data_receive_tasks_raw_gin ON unified_data_receive_tasks USING GIN (raw_data jsonb_path_ops);

-- 4. unified_data_classifications ← tbl_data_classification (id)
CREATE TABLE IF NOT EXISTS unified_data_classifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_data_classification',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_classification_id BIGINT,
  classification_code VARCHAR(50),
  classification_name VARCHAR(100),
  level SMALLINT,
  description TEXT,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_data_classifications_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_data_classifications IS 'Unified mirror of source tbl_data_classification';
CREATE INDEX IF NOT EXISTS idx_unified_data_classifications_site ON unified_data_classifications (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_data_classifications_raw_gin ON unified_data_classifications USING GIN (raw_data jsonb_path_ops);

-- 5. unified_early_warnings ← tbl_early_warning (id)
CREATE TABLE IF NOT EXISTS unified_early_warnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_early_warning',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_warning_id BIGINT,
  warning_type VARCHAR(50),
  warning_level VARCHAR(20),
  message TEXT,
  triggered_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_early_warnings_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_early_warnings IS 'Unified mirror of source tbl_early_warning';
CREATE INDEX IF NOT EXISTS idx_unified_early_warnings_site ON unified_early_warnings (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_early_warnings_raw_gin ON unified_early_warnings USING GIN (raw_data jsonb_path_ops);

-- 6. unified_early_warning_feedbacks ← tbl_early_warning_feedback (id)
CREATE TABLE IF NOT EXISTS unified_early_warning_feedbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_early_warning_feedback',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_feedback_id BIGINT,
  warning_id BIGINT,
  feedback_type VARCHAR(50),
  feedback_text TEXT,
  feedback_at TIMESTAMPTZ,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_early_warning_feedbacks_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_early_warning_feedbacks IS 'Unified mirror of source tbl_early_warning_feedback';
CREATE INDEX IF NOT EXISTS idx_unified_early_warning_feedbacks_site ON unified_early_warning_feedbacks (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_early_warning_feedbacks_raw_gin ON unified_early_warning_feedbacks USING GIN (raw_data jsonb_path_ops);

-- 7. unified_disc_prints ← tbl_disc_print (id)
CREATE TABLE IF NOT EXISTS unified_disc_prints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_disc_print',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_print_id BIGINT,
  task_id BIGINT,
  print_status VARCHAR(20),
  printed_count INTEGER,
  printed_at TIMESTAMPTZ,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_disc_prints_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_disc_prints IS 'Unified mirror of source tbl_disc_print';
CREATE INDEX IF NOT EXISTS idx_unified_disc_prints_site ON unified_disc_prints (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_disc_prints_raw_gin ON unified_disc_prints USING GIN (raw_data jsonb_path_ops);

-- 8. unified_disc_inspects ← tbl_disc_inspect (id)
CREATE TABLE IF NOT EXISTS unified_disc_inspects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_disc_inspect',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_inspect_id BIGINT,
  task_id BIGINT,
  inspect_status VARCHAR(20),
  inspect_result TEXT,
  inspected_at TIMESTAMPTZ,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_disc_inspects_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_disc_inspects IS 'Unified mirror of source tbl_disc_inspect';
CREATE INDEX IF NOT EXISTS idx_unified_disc_inspects_site ON unified_disc_inspects (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_disc_inspects_raw_gin ON unified_disc_inspects USING GIN (raw_data jsonb_path_ops);

-- 9. unified_disc_types ← tbl_disc_type (id)
CREATE TABLE IF NOT EXISTS unified_disc_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_disc_type',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_type_id BIGINT,
  type_code VARCHAR(50),
  type_name VARCHAR(100),
  capacity_mb INTEGER,
  description TEXT,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_disc_types_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_disc_types IS 'Unified mirror of source tbl_disc_type';
CREATE INDEX IF NOT EXISTS idx_unified_disc_types_site ON unified_disc_types (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_disc_types_raw_gin ON unified_disc_types USING GIN (raw_data jsonb_path_ops);

-- 10. unified_evidence_details ← tbl_evidence_details (id)
CREATE TABLE IF NOT EXISTS unified_evidence_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_evidence_details',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_detail_id BIGINT,
  evidence_type VARCHAR(50),
  detail_content TEXT,
  detail_at TIMESTAMPTZ,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_evidence_details_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_evidence_details IS 'Unified mirror of source tbl_evidence_details';
CREATE INDEX IF NOT EXISTS idx_unified_evidence_details_site ON unified_evidence_details (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_evidence_details_raw_gin ON unified_evidence_details USING GIN (raw_data jsonb_path_ops);

-- 11. unified_evidence_record_drps ← tbl_evidence_record_drp (id)
CREATE TABLE IF NOT EXISTS unified_evidence_record_drps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_evidence_record_drp',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_record_id BIGINT,
  detail_id BIGINT,
  record_type VARCHAR(50),
  drp_status VARCHAR(20),
  recorded_at TIMESTAMPTZ,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_evidence_record_drps_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_evidence_record_drps IS 'Unified mirror of source tbl_evidence_record_drp';
CREATE INDEX IF NOT EXISTS idx_unified_evidence_record_drps_site ON unified_evidence_record_drps (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_evidence_record_drps_raw_gin ON unified_evidence_record_drps USING GIN (raw_data jsonb_path_ops);

-- 12. unified_verify_details ← tbl_verify_details (id)
CREATE TABLE IF NOT EXISTS unified_verify_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_verify_details',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_verify_id BIGINT,
  detail_content TEXT,
  verify_result SMALLINT,
  verified_at TIMESTAMPTZ,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_verify_details_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_verify_details IS 'Unified mirror of source tbl_verify_details';
CREATE INDEX IF NOT EXISTS idx_unified_verify_details_site ON unified_verify_details (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_verify_details_raw_gin ON unified_verify_details USING GIN (raw_data jsonb_path_ops);

-- 13. unified_verify_record_drps ← tbl_verify_record_drp (id)
CREATE TABLE IF NOT EXISTS unified_verify_record_drps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_verify_record_drp',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_record_id BIGINT,
  verify_id BIGINT,
  drp_result SMALLINT,
  recorded_at TIMESTAMPTZ,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_verify_record_drps_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_verify_record_drps IS 'Unified mirror of source tbl_verify_record_drp';
CREATE INDEX IF NOT EXISTS idx_unified_verify_record_drps_site ON unified_verify_record_drps (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_verify_record_drps_raw_gin ON unified_verify_record_drps USING GIN (raw_data jsonb_path_ops);

-- 14. unified_download_records ← tbl_download_record (id)
CREATE TABLE IF NOT EXISTS unified_download_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_download_record',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_record_id BIGINT,
  user_id BIGINT,
  file_name VARCHAR(500),
  file_size BIGINT,
  downloaded_at TIMESTAMPTZ,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_download_records_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_download_records IS 'Unified mirror of source tbl_download_record';
CREATE INDEX IF NOT EXISTS idx_unified_download_records_site ON unified_download_records (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_download_records_raw_gin ON unified_download_records USING GIN (raw_data jsonb_path_ops);

-- 15. unified_upload_records ← tbl_upload_record (id)
CREATE TABLE IF NOT EXISTS unified_upload_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_upload_record',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_record_id BIGINT,
  user_id BIGINT,
  file_name VARCHAR(500),
  file_size BIGINT,
  uploaded_at TIMESTAMPTZ,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_upload_records_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_upload_records IS 'Unified mirror of source tbl_upload_record';
CREATE INDEX IF NOT EXISTS idx_unified_upload_records_site ON unified_upload_records (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_upload_records_raw_gin ON unified_upload_records USING GIN (raw_data jsonb_path_ops);
