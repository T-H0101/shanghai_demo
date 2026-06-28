-- ============================================================
-- Sprint R.83.6 — ISO + 元数据 + 系统族 15 张 DDL
-- ============================================================

-- 1. unified_iso_locations ← tbl_iso_location (id)
CREATE TABLE IF NOT EXISTS unified_iso_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_iso_location',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_location_id BIGINT,
  iso_path VARCHAR(1000),
  iso_size_mb BIGINT,
  mounted_at TIMESTAMPTZ,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_iso_locations_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_iso_locations IS 'Unified mirror of source tbl_iso_location';
CREATE INDEX IF NOT EXISTS idx_unified_iso_locations_site ON unified_iso_locations (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_iso_locations_raw_gin ON unified_iso_locations USING GIN (raw_data jsonb_path_ops);

-- 2. unified_iso_task_syncs ← tbl_iso_task_sync (id)
CREATE TABLE IF NOT EXISTS unified_iso_task_syncs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_iso_task_sync',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_sync_id BIGINT,
  task_id BIGINT,
  iso_status VARCHAR(20),
  sync_started_at TIMESTAMPTZ,
  sync_finished_at TIMESTAMPTZ,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_iso_task_syncs_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_iso_task_syncs IS 'Unified mirror of source tbl_iso_task_sync';
CREATE INDEX IF NOT EXISTS idx_unified_iso_task_syncs_site ON unified_iso_task_syncs (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_iso_task_syncs_raw_gin ON unified_iso_task_syncs USING GIN (raw_data jsonb_path_ops);

-- 3. unified_meta_datas ← tbl_meta_data (id)
CREATE TABLE IF NOT EXISTS unified_meta_datas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_meta_data',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_meta_id BIGINT,
  meta_key VARCHAR(200),
  meta_value TEXT,
  description TEXT,
  updated_at TIMESTAMPTZ,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_meta_datas_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_meta_datas IS 'Unified mirror of source tbl_meta_data';
CREATE INDEX IF NOT EXISTS idx_unified_meta_datas_site ON unified_meta_datas (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_meta_datas_raw_gin ON unified_meta_datas USING GIN (raw_data jsonb_path_ops);

-- 4. unified_sys_configs ← tbl_sys (id) — uses "_configs" plural to avoid
--    collision with R.83.2 unified_sys_logs (which already maps tbl_sys_log).
CREATE TABLE IF NOT EXISTS unified_sys_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_sys',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_sys_id BIGINT,
  config_key VARCHAR(200),
  config_value TEXT,
  description TEXT,
  enabled BOOLEAN,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_sys_configs_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_sys_configs IS 'Unified mirror of source tbl_sys';
CREATE INDEX IF NOT EXISTS idx_unified_sys_configs_site ON unified_sys_configs (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_sys_configs_raw_gin ON unified_sys_configs USING GIN (raw_data jsonb_path_ops);

-- 5. unified_sys_envs ← tbl_sys_env (id)
CREATE TABLE IF NOT EXISTS unified_sys_envs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_sys_env',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_env_id BIGINT,
  env_name VARCHAR(100),
  env_value TEXT,
  is_secret BOOLEAN,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_sys_envs_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_sys_envs IS 'Unified mirror of source tbl_sys_env';
CREATE INDEX IF NOT EXISTS idx_unified_sys_envs_site ON unified_sys_envs (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_sys_envs_raw_gin ON unified_sys_envs USING GIN (raw_data jsonb_path_ops);

-- 6. unified_mount_dirs ← tbl_mount_dir (id)
CREATE TABLE IF NOT EXISTS unified_mount_dirs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_mount_dir',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_mount_id BIGINT,
  mount_path VARCHAR(1000),
  device_id BIGINT,
  mount_status VARCHAR(20),
  mounted_at TIMESTAMPTZ,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_mount_dirs_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_mount_dirs IS 'Unified mirror of source tbl_mount_dir';
CREATE INDEX IF NOT EXISTS idx_unified_mount_dirs_site ON unified_mount_dirs (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_mount_dirs_raw_gin ON unified_mount_dirs USING GIN (raw_data jsonb_path_ops);

-- 7. unified_buffer_dirs ← tbl_buffer_dir (id)
CREATE TABLE IF NOT EXISTS unified_buffer_dirs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_buffer_dir',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_buffer_id BIGINT,
  buffer_path VARCHAR(1000),
  buffer_size_mb BIGINT,
  buffer_used_mb BIGINT,
  buffer_status VARCHAR(20),
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_buffer_dirs_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_buffer_dirs IS 'Unified mirror of source tbl_buffer_dir';
CREATE INDEX IF NOT EXISTS idx_unified_buffer_dirs_site ON unified_buffer_dirs (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_buffer_dirs_raw_gin ON unified_buffer_dirs USING GIN (raw_data jsonb_path_ops);

-- 8. unified_cd_cabinets ← tbl_cd_cabinet (id)
CREATE TABLE IF NOT EXISTS unified_cd_cabinets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_cd_cabinet',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_cabinet_id BIGINT,
  cabinet_code VARCHAR(50),
  cabinet_name VARCHAR(200),
  location VARCHAR(200),
  total_slots INTEGER,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_cd_cabinets_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_cd_cabinets IS 'Unified mirror of source tbl_cd_cabinet';
CREATE INDEX IF NOT EXISTS idx_unified_cd_cabinets_site ON unified_cd_cabinets (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_cd_cabinets_raw_gin ON unified_cd_cabinets USING GIN (raw_data jsonb_path_ops);

-- 9. unified_film_operats ← tbl_film_operat (id) — irregular plural kept as "operats"
CREATE TABLE IF NOT EXISTS unified_film_operats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_film_operat',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_operat_id BIGINT,
  film_code VARCHAR(50),
  film_name VARCHAR(200),
  operation_type VARCHAR(50),
  operated_at TIMESTAMPTZ,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_film_operats_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_film_operats IS 'Unified mirror of source tbl_film_operat';
CREATE INDEX IF NOT EXISTS idx_unified_film_operats_site ON unified_film_operats (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_film_operats_raw_gin ON unified_film_operats USING GIN (raw_data jsonb_path_ops);

-- 10. unified_ft_files ← tbl_ft_file (id)
CREATE TABLE IF NOT EXISTS unified_ft_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_ft_file',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_file_id BIGINT,
  file_name VARCHAR(500),
  file_path VARCHAR(1000),
  file_size BIGINT,
  transfer_status VARCHAR(20),
  transferred_at TIMESTAMPTZ,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_ft_files_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_ft_files IS 'Unified mirror of source tbl_ft_file';
CREATE INDEX IF NOT EXISTS idx_unified_ft_files_site ON unified_ft_files (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_ft_files_raw_gin ON unified_ft_files USING GIN (raw_data jsonb_path_ops);

-- 11. unified_ft_systems ← tbl_ft_sys (id)
CREATE TABLE IF NOT EXISTS unified_ft_systems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_ft_sys',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_ft_sys_id BIGINT,
  system_code VARCHAR(50),
  system_name VARCHAR(200),
  version VARCHAR(50),
  enabled BOOLEAN,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_ft_systems_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_ft_systems IS 'Unified mirror of source tbl_ft_sys';
CREATE INDEX IF NOT EXISTS idx_unified_ft_systems_site ON unified_ft_systems (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_ft_systems_raw_gin ON unified_ft_systems USING GIN (raw_data jsonb_path_ops);

-- 12. unified_back_windows ← tbl_back_window (id)
CREATE TABLE IF NOT EXISTS unified_back_windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_back_window',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_window_id BIGINT,
  task_id BIGINT,
  window_type VARCHAR(50),
  window_start_at TIMESTAMPTZ,
  window_end_at TIMESTAMPTZ,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_back_windows_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_back_windows IS 'Unified mirror of source tbl_back_window';
CREATE INDEX IF NOT EXISTS idx_unified_back_windows_site ON unified_back_windows (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_back_windows_raw_gin ON unified_back_windows USING GIN (raw_data jsonb_path_ops);

-- 13. unified_zip_files ← tbl_zip_file (id)
CREATE TABLE IF NOT EXISTS unified_zip_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_zip_file',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_zip_id BIGINT,
  zip_name VARCHAR(500),
  zip_path VARCHAR(1000),
  zip_size BIGINT,
  zip_status VARCHAR(20),
  created_at TIMESTAMPTZ,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_zip_files_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_zip_files IS 'Unified mirror of source tbl_zip_file';
CREATE INDEX IF NOT EXISTS idx_unified_zip_files_site ON unified_zip_files (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_zip_files_raw_gin ON unified_zip_files USING GIN (raw_data jsonb_path_ops);

-- 14. unified_temp_slots ← tbl_temp_slots (id)
CREATE TABLE IF NOT EXISTS unified_temp_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_temp_slots',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_slot_id BIGINT,
  slot_code VARCHAR(50),
  slot_status VARCHAR(20),
  capacity_mb INTEGER,
  used_mb INTEGER,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_temp_slots_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_temp_slots IS 'Unified mirror of source tbl_temp_slots';
CREATE INDEX IF NOT EXISTS idx_unified_temp_slots_site ON unified_temp_slots (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_temp_slots_raw_gin ON unified_temp_slots USING GIN (raw_data jsonb_path_ops);

-- 15. unified_lib_groups ← tbl_lib_group (id)
CREATE TABLE IF NOT EXISTS unified_lib_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_lib_group',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_group_id BIGINT,
  group_code VARCHAR(50),
  group_name VARCHAR(200),
  description TEXT,
  sort_order INTEGER,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_lib_groups_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_lib_groups IS 'Unified mirror of source tbl_lib_group';
CREATE INDEX IF NOT EXISTS idx_unified_lib_groups_site ON unified_lib_groups (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_lib_groups_raw_gin ON unified_lib_groups USING GIN (raw_data jsonb_path_ops);