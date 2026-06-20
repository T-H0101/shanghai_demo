-- Sprint R.39: Add sync_full and sync_incremental command types
-- REQ-2.3.2, REQ-1.2.1

-- Drop old CHECK constraint and add new one with sync types
ALTER TABLE control_command DROP CONSTRAINT IF EXISTS control_command_command_type_check;
ALTER TABLE control_command ADD CONSTRAINT control_command_command_type_check
  CHECK (command_type IN (
    'task_pause',
    'task_resume',
    'task_reset',
    'task_priority_restore',
    'inspect_start',
    'recovery_start',
    'sync_full',
    'sync_incremental'
  ));

-- Also add 'site' to target_type for sync commands
ALTER TABLE control_command DROP CONSTRAINT IF EXISTS control_command_target_type_check;
ALTER TABLE control_command ADD CONSTRAINT control_command_target_type_check
  CHECK (target_type IN ('task', 'device', 'volume', 'media', 'site'));

-- Add 'unsupported' and 'dry_run_success' to status if not already present
ALTER TABLE control_command DROP CONSTRAINT IF EXISTS control_command_status_check;
ALTER TABLE control_command ADD CONSTRAINT control_command_status_check
  CHECK (status IN ('pending', 'pulled', 'running', 'success', 'failed', 'cancelled', 'unsupported', 'dry_run_success'));

-- Sync request tracking table
CREATE TABLE IF NOT EXISTS sync_request_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_no TEXT UNIQUE NOT NULL,
  source_site_id TEXT NOT NULL,
  sync_type TEXT NOT NULL CHECK (sync_type IN ('full', 'incremental')),
  command_id UUID REFERENCES control_command(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'command_sent', 'agent_polled', 'sync_running', 'completed', 'failed', 'timeout')),
  requested_by TEXT,
  requested_ip TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  agent_polled_at TIMESTAMPTZ,
  sync_started_at TIMESTAMPTZ,
  sync_completed_at TIMESTAMPTZ,
  package_log_id UUID,
  error_message TEXT,
  timing_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_request_site_status
  ON sync_request_log(source_site_id, status, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_sync_request_command
  ON sync_request_log(command_id);

-- Auto-update trigger
CREATE OR REPLACE FUNCTION trg_sync_request_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_request_updated_at ON sync_request_log;
CREATE TRIGGER sync_request_updated_at
  BEFORE UPDATE ON sync_request_log
  FOR EACH ROW EXECUTE FUNCTION trg_sync_request_updated_at();
