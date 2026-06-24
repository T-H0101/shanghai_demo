-- ============================================================
-- Sprint R.83.3 — tbl_check_* 检查巡检族 15 张业务表 DDL (第一段: 7 张)
-- ============================================================
-- 源: databases/disc_files.sql 严格按字段类型映射
-- 通用列: id / source_site_id / source_table / source_record_id / synced_at / raw_data
-- 必备: UNIQUE(source_site_id, source_record_id) + GIN(raw_data) + B-tree(source_site_id)
-- ============================================================

-- 1. unified_check_categories ← tbl_check_category (id)
CREATE TABLE IF NOT EXISTS unified_check_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_check_category',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_category_id BIGINT,
  category_code VARCHAR(50),
  category_name VARCHAR(100),
  parent_id BIGINT,
  sort_order INTEGER,
  enabled SMALLINT DEFAULT 1,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_check_categories_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_check_categories IS 'Unified mirror of source tbl_check_category';
COMMENT ON COLUMN unified_check_categories.src_category_id IS '自增检查分类ID';
CREATE INDEX IF NOT EXISTS idx_unified_check_categories_site ON unified_check_categories (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_check_categories_raw_gin ON unified_check_categories USING GIN (raw_data jsonb_path_ops);

-- 2. unified_check_sub_categories ← tbl_check_sub_category (id)
CREATE TABLE IF NOT EXISTS unified_check_sub_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_check_sub_category',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_sub_category_id BIGINT,
  category_id BIGINT,
  sub_category_code VARCHAR(50),
  sub_category_name VARCHAR(100),
  sort_order INTEGER,
  enabled SMALLINT DEFAULT 1,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_check_sub_categories_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_check_sub_categories IS 'Unified mirror of source tbl_check_sub_category';
COMMENT ON COLUMN unified_check_sub_categories.src_sub_category_id IS '自增子分类ID';
CREATE INDEX IF NOT EXISTS idx_unified_check_sub_categories_site ON unified_check_sub_categories (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_check_sub_categories_raw_gin ON unified_check_sub_categories USING GIN (raw_data jsonb_path_ops);

-- 3. unified_check_items ← tbl_check_item (id)
CREATE TABLE IF NOT EXISTS unified_check_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_check_item',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_item_id BIGINT,
  sub_category_id BIGINT,
  item_code VARCHAR(100),
  item_name VARCHAR(200),
  check_method VARCHAR(100),
  pass_criteria TEXT,
  sort_order INTEGER,
  enabled SMALLINT DEFAULT 1,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_check_items_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_check_items IS 'Unified mirror of source tbl_check_item';
COMMENT ON COLUMN unified_check_items.src_item_id IS '自增检查项ID';
CREATE INDEX IF NOT EXISTS idx_unified_check_items_site ON unified_check_items (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_check_items_raw_gin ON unified_check_items USING GIN (raw_data jsonb_path_ops);

-- 4. unified_check_sectors ← tbl_check_sector (id)
CREATE TABLE IF NOT EXISTS unified_check_sectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_check_sector',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_sector_id BIGINT,
  sector_code VARCHAR(50),
  sector_name VARCHAR(100),
  description TEXT,
  sort_order INTEGER,
  enabled SMALLINT DEFAULT 1,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_check_sectors_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_check_sectors IS 'Unified mirror of source tbl_check_sector';
COMMENT ON COLUMN unified_check_sectors.src_sector_id IS '自增扇区ID';
CREATE INDEX IF NOT EXISTS idx_unified_check_sectors_site ON unified_check_sectors (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_check_sectors_raw_gin ON unified_check_sectors USING GIN (raw_data jsonb_path_ops);

-- 5. unified_check_templates ← tbl_check_template (id)
CREATE TABLE IF NOT EXISTS unified_check_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_check_template',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_template_id BIGINT,
  template_code VARCHAR(50),
  template_name VARCHAR(100),
  category_id BIGINT,
  description TEXT,
  enabled SMALLINT DEFAULT 1,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_check_templates_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_check_templates IS 'Unified mirror of source tbl_check_template';
COMMENT ON COLUMN unified_check_templates.src_template_id IS '自增模板ID';
CREATE INDEX IF NOT EXISTS idx_unified_check_templates_site ON unified_check_templates (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_check_templates_raw_gin ON unified_check_templates USING GIN (raw_data jsonb_path_ops);

-- 6. unified_check_tasks ← tbl_check_task (id)
CREATE TABLE IF NOT EXISTS unified_check_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_check_task',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_task_id BIGINT,
  task_name VARCHAR(200),
  template_id BIGINT,
  sector_id BIGINT,
  status VARCHAR(20),
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_check_tasks_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_check_tasks IS 'Unified mirror of source tbl_check_task';
COMMENT ON COLUMN unified_check_tasks.src_task_id IS '自增检查任务ID';
CREATE INDEX IF NOT EXISTS idx_unified_check_tasks_site ON unified_check_tasks (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_check_tasks_raw_gin ON unified_check_tasks USING GIN (raw_data jsonb_path_ops);

-- 7. unified_check_task_items ← tbl_check_task_item (id)
CREATE TABLE IF NOT EXISTS unified_check_task_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_check_task_item',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_task_item_id BIGINT,
  task_id BIGINT,
  item_id BIGINT,
  result VARCHAR(20),
  remark TEXT,
  checked_at TIMESTAMPTZ,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_check_task_items_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_check_task_items IS 'Unified mirror of source tbl_check_task_item';
COMMENT ON COLUMN unified_check_task_items.src_task_item_id IS '自增任务项ID';
CREATE INDEX IF NOT EXISTS idx_unified_check_task_items_site ON unified_check_task_items (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_check_task_items_raw_gin ON unified_check_task_items USING GIN (raw_data jsonb_path_ops);
