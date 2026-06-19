-- Sprint R.27: Auth system config table for lock threshold and other settings
-- REQ-2.2.3: 登录审计与异常管控

CREATE TABLE IF NOT EXISTS auth_system_config (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_by VARCHAR(100),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Default lock threshold
INSERT INTO auth_system_config(key, value, description)
VALUES ('login.lock_threshold', '5', '连续失败登录锁定阈值')
ON CONFLICT (key) DO NOTHING;

INSERT INTO auth_system_config(key, value, description)
VALUES ('login.lock_minutes', '30', '锁定持续时间（分钟）')
ON CONFLICT (key) DO NOTHING;

-- Index for fast config reads
CREATE INDEX IF NOT EXISTS idx_auth_system_config_key ON auth_system_config(key);
