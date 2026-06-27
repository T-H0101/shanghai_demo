-- ============================================================
-- Sprint R.83.8 — 任务详情 + 槽位管理族 15 张 DDL
-- ============================================================

-- 1. unified_task_items ← tbl_task_items (id)
CREATE TABLE IF NOT EXISTS unified_task_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_task_items',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_task_item_id BIGINT,
  task_id BIGINT,
  root_path VARCHAR(1000),
  original_path VARCHAR(1000),
  item_name VARCHAR(500),
  volume_id INTEGER,
  lib_parent_folder VARCHAR(500),
  is_folder SMALLINT,
  slot_id INTEGER,
  status INTEGER,
  project_id INTEGER,
  cmt VARCHAR(200),
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_task_items_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_task_items IS 'Unified mirror of source tbl_task_items';
CREATE INDEX IF NOT EXISTS idx_unified_task_items_site ON unified_task_items (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_task_items_raw_gin ON unified_task_items USING GIN (raw_data jsonb_path_ops);

-- 2. unified_task_prints ← tbl_task_print (id)
CREATE TABLE IF NOT EXISTS unified_task_prints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_task_print',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_print_id BIGINT,
  task_id BIGINT,
  title VARCHAR(200),
  subtitle VARCHAR(200),
  disc_tip VARCHAR(200),
  data_compare SMALLINT,
  print_qrcode SMALLINT,
  print_style INTEGER,
  print_label VARCHAR(1000),
  print_publisher VARCHAR(20),
  print_copies INTEGER,
  out_stacker SMALLINT,
  in_stacker SMALLINT,
  print_session VARCHAR(20),
  cmt VARCHAR(200),
  print_date VARCHAR(200),
  print_img VARCHAR(1000),
  publisher_type SMALLINT,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_task_prints_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_task_prints IS 'Unified mirror of source tbl_task_print';
CREATE INDEX IF NOT EXISTS idx_unified_task_prints_site ON unified_task_prints (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_task_prints_raw_gin ON unified_task_prints USING GIN (raw_data jsonb_path_ops);

-- 3. unified_task_certif_statuses ← tbl_task_certif_status (id)
CREATE TABLE IF NOT EXISTS unified_task_certif_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_task_certif_status',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_status_id BIGINT,
  task_id BIGINT,
  task_item_id BIGINT,
  task_type INTEGER,
  task_mode SMALLINT,
  status SMALLINT,
  create_time TIMESTAMPTZ,
  update_time TIMESTAMPTZ,
  cmt VARCHAR(255),
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_task_certif_statuses_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_task_certif_statuses IS 'Unified mirror of source tbl_task_certif_status';
CREATE INDEX IF NOT EXISTS idx_unified_task_certif_statuses_site ON unified_task_certif_statuses (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_task_certif_statuses_raw_gin ON unified_task_certif_statuses USING GIN (raw_data jsonb_path_ops);

-- 4. unified_slot_file_1000000 ← tbl_slot_file_1000000 (id) — volume default 1000000
CREATE TABLE IF NOT EXISTS unified_slot_file_1000000 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_slot_file_1000000',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_file_id BIGINT,
  uuid VARCHAR(64),
  folder_id BIGINT,
  file_name VARCHAR(500),
  file_disc_name VARCHAR(500),
  file_size BIGINT,
  hash VARCHAR(65),
  task_id BIGINT,
  items_id BIGINT,
  create_date TIMESTAMPTZ,
  status SMALLINT,
  slot_id INTEGER,
  content_type VARCHAR(65),
  storage_class SMALLINT,
  thumbs SMALLINT,
  meta_data VARCHAR(1000),
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_slot_file_1000000_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_slot_file_1000000 IS 'Unified mirror of source tbl_slot_file_1000000';
CREATE INDEX IF NOT EXISTS idx_unified_slot_file_1000000_site ON unified_slot_file_1000000 (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_slot_file_1000000_raw_gin ON unified_slot_file_1000000 USING GIN (raw_data jsonb_path_ops);

-- 5. unified_slot_file_12 ← tbl_slot_file_12 (id)
CREATE TABLE IF NOT EXISTS unified_slot_file_12 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_slot_file_12',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_file_id BIGINT,
  uuid VARCHAR(64),
  folder_id BIGINT,
  file_name VARCHAR(500),
  file_disc_name VARCHAR(500),
  file_size BIGINT,
  hash VARCHAR(65),
  task_id BIGINT,
  items_id BIGINT,
  create_date TIMESTAMPTZ,
  status SMALLINT,
  slot_id INTEGER,
  content_type VARCHAR(65),
  storage_class SMALLINT,
  thumbs SMALLINT,
  meta_data VARCHAR(1000),
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_slot_file_12_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_slot_file_12 IS 'Unified mirror of source tbl_slot_file_12';
CREATE INDEX IF NOT EXISTS idx_unified_slot_file_12_site ON unified_slot_file_12 (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_slot_file_12_raw_gin ON unified_slot_file_12 USING GIN (raw_data jsonb_path_ops);

-- 6. unified_slot_file_13 ← tbl_slot_file_13 (id)
CREATE TABLE IF NOT EXISTS unified_slot_file_13 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_slot_file_13',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_file_id BIGINT,
  uuid VARCHAR(64),
  folder_id BIGINT,
  file_name VARCHAR(500),
  file_disc_name VARCHAR(500),
  file_size BIGINT,
  hash VARCHAR(65),
  task_id BIGINT,
  items_id BIGINT,
  create_date TIMESTAMPTZ,
  status SMALLINT,
  slot_id INTEGER,
  content_type VARCHAR(65),
  storage_class SMALLINT,
  thumbs SMALLINT,
  meta_data VARCHAR(1000),
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_slot_file_13_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_slot_file_13 IS 'Unified mirror of source tbl_slot_file_13';
CREATE INDEX IF NOT EXISTS idx_unified_slot_file_13_site ON unified_slot_file_13 (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_slot_file_13_raw_gin ON unified_slot_file_13 USING GIN (raw_data jsonb_path_ops);

-- 7. unified_slot_file_15 ← tbl_slot_file_15 (id)
CREATE TABLE IF NOT EXISTS unified_slot_file_15 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_slot_file_15',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_file_id BIGINT,
  uuid VARCHAR(64),
  folder_id BIGINT,
  file_name VARCHAR(500),
  file_disc_name VARCHAR(500),
  file_size BIGINT,
  hash VARCHAR(65),
  task_id BIGINT,
  items_id BIGINT,
  create_date TIMESTAMPTZ,
  status SMALLINT,
  slot_id INTEGER,
  content_type VARCHAR(65),
  storage_class SMALLINT,
  thumbs SMALLINT,
  meta_data VARCHAR(1000),
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_slot_file_15_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_slot_file_15 IS 'Unified mirror of source tbl_slot_file_15';
CREATE INDEX IF NOT EXISTS idx_unified_slot_file_15_site ON unified_slot_file_15 (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_slot_file_15_raw_gin ON unified_slot_file_15 USING GIN (raw_data jsonb_path_ops);

-- 8. unified_slot_file_30 ← tbl_slot_file_30 (id)
CREATE TABLE IF NOT EXISTS unified_slot_file_30 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_slot_file_30',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_file_id BIGINT,
  uuid VARCHAR(64),
  folder_id BIGINT,
  file_name VARCHAR(500),
  file_disc_name VARCHAR(500),
  file_size BIGINT,
  hash VARCHAR(65),
  task_id BIGINT,
  items_id BIGINT,
  create_date TIMESTAMPTZ,
  status SMALLINT,
  slot_id INTEGER,
  content_type VARCHAR(65),
  storage_class SMALLINT,
  thumbs SMALLINT,
  meta_data VARCHAR(1000),
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_slot_file_30_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_slot_file_30 IS 'Unified mirror of source tbl_slot_file_30';
CREATE INDEX IF NOT EXISTS idx_unified_slot_file_30_site ON unified_slot_file_30 (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_slot_file_30_raw_gin ON unified_slot_file_30 USING GIN (raw_data jsonb_path_ops);

-- 9. unified_slot_file_31 ← tbl_slot_file_31 (id)
CREATE TABLE IF NOT EXISTS unified_slot_file_31 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_slot_file_31',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_file_id BIGINT,
  uuid VARCHAR(64),
  folder_id BIGINT,
  file_name VARCHAR(500),
  file_disc_name VARCHAR(500),
  file_size BIGINT,
  hash VARCHAR(65),
  task_id BIGINT,
  items_id BIGINT,
  create_date TIMESTAMPTZ,
  status SMALLINT,
  slot_id INTEGER,
  content_type VARCHAR(65),
  storage_class SMALLINT,
  thumbs SMALLINT,
  meta_data VARCHAR(1000),
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_slot_file_31_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_slot_file_31 IS 'Unified mirror of source tbl_slot_file_31';
CREATE INDEX IF NOT EXISTS idx_unified_slot_file_31_site ON unified_slot_file_31 (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_slot_file_31_raw_gin ON unified_slot_file_31 USING GIN (raw_data jsonb_path_ops);

-- 10. unified_slot_folder_1000000 ← tbl_slot_folder_1000000 (id)
CREATE TABLE IF NOT EXISTS unified_slot_folder_1000000 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_slot_folder_1000000',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_folder_id BIGINT,
  folder_name VARCHAR(1000),
  folder_path VARCHAR(1000),
  disc_path VARCHAR(1000),
  s_level INTEGER,
  parent BIGINT,
  sum_files BIGINT,
  files INTEGER,
  subs INTEGER,
  slot_id INTEGER,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_slot_folder_1000000_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_slot_folder_1000000 IS 'Unified mirror of source tbl_slot_folder_1000000';
CREATE INDEX IF NOT EXISTS idx_unified_slot_folder_1000000_site ON unified_slot_folder_1000000 (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_slot_folder_1000000_raw_gin ON unified_slot_folder_1000000 USING GIN (raw_data jsonb_path_ops);

-- 11. unified_slot_folder_12 ← tbl_slot_folder_12 (id)
CREATE TABLE IF NOT EXISTS unified_slot_folder_12 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_slot_folder_12',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_folder_id BIGINT,
  folder_name VARCHAR(1000),
  folder_path VARCHAR(1000),
  disc_path VARCHAR(1000),
  s_level INTEGER,
  parent BIGINT,
  sum_files BIGINT,
  files INTEGER,
  subs INTEGER,
  slot_id INTEGER,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_slot_folder_12_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_slot_folder_12 IS 'Unified mirror of source tbl_slot_folder_12';
CREATE INDEX IF NOT EXISTS idx_unified_slot_folder_12_site ON unified_slot_folder_12 (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_slot_folder_12_raw_gin ON unified_slot_folder_12 USING GIN (raw_data jsonb_path_ops);

-- 12. unified_slot_folder_13 ← tbl_slot_folder_13 (id)
CREATE TABLE IF NOT EXISTS unified_slot_folder_13 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_slot_folder_13',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_folder_id BIGINT,
  folder_name VARCHAR(1000),
  folder_path VARCHAR(1000),
  disc_path VARCHAR(1000),
  s_level INTEGER,
  parent BIGINT,
  sum_files BIGINT,
  files INTEGER,
  subs INTEGER,
  slot_id INTEGER,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_slot_folder_13_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_slot_folder_13 IS 'Unified mirror of source tbl_slot_folder_13';
CREATE INDEX IF NOT EXISTS idx_unified_slot_folder_13_site ON unified_slot_folder_13 (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_slot_folder_13_raw_gin ON unified_slot_folder_13 USING GIN (raw_data jsonb_path_ops);

-- 13. unified_slot_folder_15 ← tbl_slot_folder_15 (id)
CREATE TABLE IF NOT EXISTS unified_slot_folder_15 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_slot_folder_15',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_folder_id BIGINT,
  folder_name VARCHAR(1000),
  folder_path VARCHAR(1000),
  disc_path VARCHAR(1000),
  s_level INTEGER,
  parent BIGINT,
  sum_files BIGINT,
  files INTEGER,
  subs INTEGER,
  slot_id INTEGER,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_slot_folder_15_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_slot_folder_15 IS 'Unified mirror of source tbl_slot_folder_15';
CREATE INDEX IF NOT EXISTS idx_unified_slot_folder_15_site ON unified_slot_folder_15 (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_slot_folder_15_raw_gin ON unified_slot_folder_15 USING GIN (raw_data jsonb_path_ops);

-- 14. unified_slot_folder_30 ← tbl_slot_folder_30 (id)
CREATE TABLE IF NOT EXISTS unified_slot_folder_30 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_slot_folder_30',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_folder_id BIGINT,
  folder_name VARCHAR(1000),
  folder_path VARCHAR(1000),
  disc_path VARCHAR(1000),
  s_level INTEGER,
  parent BIGINT,
  sum_files BIGINT,
  files INTEGER,
  subs INTEGER,
  slot_id INTEGER,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_slot_folder_30_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_slot_folder_30 IS 'Unified mirror of source tbl_slot_folder_30';
CREATE INDEX IF NOT EXISTS idx_unified_slot_folder_30_site ON unified_slot_folder_30 (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_slot_folder_30_raw_gin ON unified_slot_folder_30 USING GIN (raw_data jsonb_path_ops);

-- 15. unified_slot_folder_31 ← tbl_slot_folder_31 (id)
CREATE TABLE IF NOT EXISTS unified_slot_folder_31 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_slot_folder_31',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_folder_id BIGINT,
  folder_name VARCHAR(1000),
  folder_path VARCHAR(1000),
  disc_path VARCHAR(1000),
  s_level INTEGER,
  parent BIGINT,
  sum_files BIGINT,
  files INTEGER,
  subs INTEGER,
  slot_id INTEGER,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_slot_folder_31_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_slot_folder_31 IS 'Unified mirror of source tbl_slot_folder_31';
CREATE INDEX IF NOT EXISTS idx_unified_slot_folder_31_site ON unified_slot_folder_31 (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_slot_folder_31_raw_gin ON unified_slot_folder_31 USING GIN (raw_data jsonb_path_ops);