BEGIN;

CREATE TABLE IF NOT EXISTS site_agent_runtime (
  site_code VARCHAR(50) PRIMARY KEY,
  agent_id VARCHAR(100) NOT NULL,
  agent_version VARCHAR(50) NOT NULL,
  started_at TIMESTAMPTZ,
  reported_at TIMESTAMPTZ NOT NULL,
  database_reachable BOOLEAN NOT NULL,
  last_sync_at TIMESTAMPTZ,
  last_control_at TIMESTAMPTZ,
  spool_depth INT NOT NULL DEFAULT 0 CHECK (spool_depth >= 0),
  capabilities JSONB NOT NULL DEFAULT '{}',
  runtime_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_site_agent_runtime_reported
  ON site_agent_runtime(reported_at DESC);

CREATE TABLE IF NOT EXISTS site_agent_nonce (
  site_code VARCHAR(50) NOT NULL,
  nonce VARCHAR(200) NOT NULL,
  used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (site_code, nonce)
);

CREATE INDEX IF NOT EXISTS idx_site_agent_nonce_expires
  ON site_agent_nonce(expires_at);

COMMIT;
