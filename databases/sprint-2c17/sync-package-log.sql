-- ============================================================
-- Sprint 2C.17 - Site package sync runtime logs
-- ============================================================
-- These tables record central-platform package processing state.
-- They are not source-site business log tables.
-- ============================================================

CREATE TABLE IF NOT EXISTS sync_package_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_code VARCHAR(50) NOT NULL,
  batch_id VARCHAR(100) NOT NULL,
  snapshot_at TIMESTAMPTZ,
  mode VARCHAR(30) NOT NULL,
  version VARCHAR(20),
  package_checksum VARCHAR(128),
  status VARCHAR(30) NOT NULL,
  table_count INTEGER DEFAULT 0,
  total_record_count INTEGER DEFAULT 0,
  success_table_count INTEGER DEFAULT 0,
  failed_table_count INTEGER DEFAULT 0,
  error_message TEXT,
  raw_metadata JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT sync_package_log_site_batch_unique UNIQUE (site_code, batch_id)
);

CREATE TABLE IF NOT EXISTS sync_table_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_log_id UUID REFERENCES sync_package_log(id) ON DELETE CASCADE,
  site_code VARCHAR(50) NOT NULL,
  batch_id VARCHAR(100) NOT NULL,
  table_name VARCHAR(100) NOT NULL,
  sync_mode VARCHAR(30) NOT NULL,
  table_checksum VARCHAR(128),
  expected_record_count INTEGER,
  processed_record_count INTEGER DEFAULT 0,
  inserted_count INTEGER DEFAULT 0,
  updated_count INTEGER DEFAULT 0,
  skipped_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  status VARCHAR(30) NOT NULL,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT sync_table_log_site_batch_table_unique UNIQUE (site_code, batch_id, table_name)
);

CREATE INDEX IF NOT EXISTS idx_sync_package_log_site_batch ON sync_package_log(site_code, batch_id);
CREATE INDEX IF NOT EXISTS idx_sync_package_log_status ON sync_package_log(status);
CREATE INDEX IF NOT EXISTS idx_sync_package_log_created_desc ON sync_package_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sync_table_log_site_table ON sync_table_log(site_code, table_name);
CREATE INDEX IF NOT EXISTS idx_sync_table_log_status ON sync_table_log(status);
CREATE INDEX IF NOT EXISTS idx_sync_table_log_created_desc ON sync_table_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_table_log_package ON sync_table_log(package_log_id);

COMMENT ON TABLE sync_package_log IS '总控站点数据包同步运行日志，记录包级处理状态';
COMMENT ON TABLE sync_table_log IS '总控站点数据包同步运行日志，记录包内单表处理状态';
