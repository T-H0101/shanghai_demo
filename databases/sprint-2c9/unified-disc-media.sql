CREATE TABLE IF NOT EXISTS unified_disc_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 来源追溯
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_disc',
  source_id VARCHAR(100) NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 关联
  source_task_id VARCHAR(100),
  task_no VARCHAR(100),

  -- 介质信息
  disc_num INTEGER,
  disc_label VARCHAR(200),
  slot_id INTEGER,
  device_id VARCHAR(100),
  device_name VARCHAR(200),

  -- 容量
  used_size BIGINT,
  extra_size BIGINT,

  -- 状态
  iso_status INTEGER,
  iso_path TEXT,
  burn_success INTEGER,
  burn_errors INTEGER,
  error_files INTEGER,
  stage INTEGER,
  disc_progress INTEGER,
  serial_num VARCHAR(100),

  -- 时间
  create_dt TIMESTAMPTZ,
  update_dt TIMESTAMPTZ,
  verify_dt TIMESTAMPTZ,

  -- 原始数据
  raw_data JSONB,

  -- 元数据
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (source_site_id, source_table, source_id)
);

CREATE INDEX IF NOT EXISTS idx_unified_disc_media_site ON unified_disc_media(source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_disc_media_task ON unified_disc_media(source_task_id);
CREATE INDEX IF NOT EXISTS idx_unified_disc_media_device ON unified_disc_media(device_id);

COMMENT ON TABLE unified_disc_media IS '统一介质/光盘表 - 从站点 tbl_disc 同步';
