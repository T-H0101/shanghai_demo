-- ============================================================
-- ingest_batch_log - 站点推送批次日志表
-- Sprint 2B.6 - Ingest API 基础设施
-- ============================================================
CREATE TABLE IF NOT EXISTS ingest_batch_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id VARCHAR(100) NOT NULL,
  site_code VARCHAR(20) NOT NULL,
  source_table VARCHAR(50) NOT NULL,
  snapshot_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending/running/success/failed/skipped
  rows_received INTEGER DEFAULT 0,
  rows_upserted INTEGER DEFAULT 0,
  error_message TEXT,
  duplicated BOOLEAN DEFAULT FALSE,
  payload_hash VARCHAR(64),  -- 用于判断同 batchId 重复推送时内容是否一致
  batch_source VARCHAR(20) DEFAULT 'provided',  -- provided/generated
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (batch_id, site_code, source_table)
);

CREATE INDEX IF NOT EXISTS idx_ingest_batch_log_site_table ON ingest_batch_log(site_code, source_table);
CREATE INDEX IF NOT EXISTS idx_ingest_batch_log_status ON ingest_batch_log(status);
CREATE INDEX IF NOT EXISTS idx_ingest_batch_log_received_at ON ingest_batch_log(received_at);
