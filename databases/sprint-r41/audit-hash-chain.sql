-- Sprint R.41: Audit hash chain for tamper detection
-- REQ-6.2.3

CREATE TABLE IF NOT EXISTS audit_hash_chain (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_log_id UUID NOT NULL REFERENCES audit_log(id) ON DELETE CASCADE,
  record_hash TEXT NOT NULL,
  prev_hash TEXT NOT NULL,
  chain_index BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_audit_hash_chain_audit_id
  ON audit_hash_chain(audit_log_id);

CREATE INDEX IF NOT EXISTS idx_audit_hash_chain_index
  ON audit_hash_chain(chain_index);

-- Config table for retention period
INSERT INTO auth_system_config(key, value, description)
VALUES ('audit.retention_days', '730', '审计日志保留天数 (默认 ≥2 年)')
ON CONFLICT (key) DO NOTHING;

-- Export signing key env ref (never store actual key)
INSERT INTO auth_system_config(key, value, description)
VALUES ('export.signing_key_ref', '', '导出签名密钥环境变量名 (留空表示未配置)')
ON CONFLICT (key) DO NOTHING;

INSERT INTO auth_system_config(key, value, description)
VALUES ('export.signing_algorithm', 'HMAC-SHA256', '导出签名算法')
ON CONFLICT (key) DO NOTHING;
