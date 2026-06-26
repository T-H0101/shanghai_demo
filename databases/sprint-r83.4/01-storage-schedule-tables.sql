-- ============================================================
-- Sprint R.83.4 — 存储卷族 + 调度族 + 设备业务族 15 张 DDL (第一段: 7 张)
-- 源: databases/disc_files.sql 严格按字段类型映射
-- 通用列: id / source_site_id / source_table / source_record_id / synced_at / raw_data
-- 必备: UNIQUE(source_site_id, source_record_id) + GIN(raw_data) + B-tree(source_site_id)
-- ============================================================

-- 1. unified_volume_groups ← tbl_volume_group (id)
CREATE TABLE IF NOT EXISTS unified_volume_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_volume_group',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_group_id BIGINT,
  group_name VARCHAR(100),
  description TEXT,
  enabled SMALLINT DEFAULT 1,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_volume_groups_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_volume_groups IS 'Unified mirror of source tbl_volume_group';
COMMENT ON COLUMN unified_volume_groups.src_group_id IS '自增卷组ID';
CREATE INDEX IF NOT EXISTS idx_unified_volume_groups_site ON unified_volume_groups (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_volume_groups_raw_gin ON unified_volume_groups USING GIN (raw_data jsonb_path_ops);

-- 2. unified_volume_dataclasses ← tbl_volume_dataclass (id)
CREATE TABLE IF NOT EXISTS unified_volume_dataclasses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_volume_dataclass',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_dataclass_id BIGINT,
  class_name VARCHAR(100),
  retention_days INTEGER,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_volume_dataclasses_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_volume_dataclasses IS 'Unified mirror of source tbl_volume_dataclass';
COMMENT ON COLUMN unified_volume_dataclasses.src_dataclass_id IS '自增数据类ID';
CREATE INDEX IF NOT EXISTS idx_unified_volume_dataclasses_site ON unified_volume_dataclasses (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_volume_dataclasses_raw_gin ON unified_volume_dataclasses USING GIN (raw_data jsonb_path_ops);

-- 3. unified_volume_depas ← tbl_volume_depa (id)
CREATE TABLE IF NOT EXISTS unified_volume_depas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_volume_depa',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_depa_id BIGINT,
  volume_id BIGINT,
  depa_id BIGINT,
  permission VARCHAR(50),
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_volume_depas_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_volume_depas IS 'Unified mirror of source tbl_volume_depa';
CREATE INDEX IF NOT EXISTS idx_unified_volume_depas_site ON unified_volume_depas (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_volume_depas_raw_gin ON unified_volume_depas USING GIN (raw_data jsonb_path_ops);

-- 4. unified_volume_users ← tbl_volume_user (id)
CREATE TABLE IF NOT EXISTS unified_volume_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_volume_user',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_user_id BIGINT,
  volume_id BIGINT,
  user_id BIGINT,
  permission VARCHAR(50),
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_volume_users_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_volume_users IS 'Unified mirror of source tbl_volume_user';
CREATE INDEX IF NOT EXISTS idx_unified_volume_users_site ON unified_volume_users (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_volume_users_raw_gin ON unified_volume_users USING GIN (raw_data jsonb_path_ops);

-- 5. unified_volume_workspaces ← tbl_volume_workspace (id)
CREATE TABLE IF NOT EXISTS unified_volume_workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_volume_workspace',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_workspace_id BIGINT,
  volume_id BIGINT,
  workspace_id BIGINT,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_volume_workspaces_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_volume_workspaces IS 'Unified mirror of source tbl_volume_workspace';
CREATE INDEX IF NOT EXISTS idx_unified_volume_workspaces_site ON unified_volume_workspaces (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_volume_workspaces_raw_gin ON unified_volume_workspaces USING GIN (raw_data jsonb_path_ops);

-- 6. unified_schedule_jobs ← tbl_schedule_job (id)
CREATE TABLE IF NOT EXISTS unified_schedule_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_schedule_job',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_job_id BIGINT,
  job_name VARCHAR(200),
  cron_expression VARCHAR(100),
  job_class VARCHAR(200),
  enabled SMALLINT DEFAULT 1,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_schedule_jobs_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_schedule_jobs IS 'Unified mirror of source tbl_schedule_job';
CREATE INDEX IF NOT EXISTS idx_unified_schedule_jobs_site ON unified_schedule_jobs (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_schedule_jobs_raw_gin ON unified_schedule_jobs USING GIN (raw_data jsonb_path_ops);

-- 7. unified_register_managements ← tbl_register_management (id)
CREATE TABLE IF NOT EXISTS unified_register_managements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_register_management',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_register_id BIGINT,
  register_type VARCHAR(50),
  register_name VARCHAR(200),
  registered_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  status VARCHAR(20),
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_register_managements_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_register_managements IS 'Unified mirror of source tbl_register_management';
CREATE INDEX IF NOT EXISTS idx_unified_register_managements_site ON unified_register_managements (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_register_managements_raw_gin ON unified_register_managements USING GIN (raw_data jsonb_path_ops);
