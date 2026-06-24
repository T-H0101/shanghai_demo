-- Sprint R.7 - sync consistency log
-- Stores source-vs-center consistency check results.

CREATE TABLE IF NOT EXISTS sync_consistency_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_code VARCHAR(50) NOT NULL,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status VARCHAR(20) NOT NULL CHECK (status IN ('matched', 'mismatched', 'failed', 'resolved')),
  table_count INTEGER NOT NULL DEFAULT 0,
  matched_table_count INTEGER NOT NULL DEFAULT 0,
  mismatched_table_count INTEGER NOT NULL DEFAULT 0,
  result_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scl_site_checked
  ON sync_consistency_log (site_code, checked_at DESC);

CREATE INDEX IF NOT EXISTS idx_scl_status_checked
  ON sync_consistency_log (status, checked_at DESC);
