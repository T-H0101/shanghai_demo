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

-- ============================================================
-- 第二段: 8 张 (含任务文件 / 检查文件 _2 _pl / 日志 / 巡检族 4 张)
-- ============================================================

-- 8. unified_check_task_files ← tbl_check_task_file (id)
CREATE TABLE IF NOT EXISTS unified_check_task_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_check_task_file',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_task_file_id BIGINT,
  task_id BIGINT,
  file_name VARCHAR(500),
  file_path VARCHAR(1000),
  file_size BIGINT,
  uploaded_at TIMESTAMPTZ,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_check_task_files_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_check_task_files IS 'Unified mirror of source tbl_check_task_file';
COMMENT ON COLUMN unified_check_task_files.src_task_file_id IS '自增任务文件ID';
CREATE INDEX IF NOT EXISTS idx_unified_check_task_files_site ON unified_check_task_files (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_check_task_files_raw_gin ON unified_check_task_files USING GIN (raw_data jsonb_path_ops);

-- 9. unified_check_files_2 ← tbl_check_file (id, 单数)
-- 命名冲突: unified_check_files 已被 R.83.1 占用
CREATE TABLE IF NOT EXISTS unified_check_files_2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_check_file',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_check_file_id BIGINT,
  check_id BIGINT,
  file_name VARCHAR(500),
  file_path VARCHAR(1000),
  file_size BIGINT,
  uploaded_at TIMESTAMPTZ,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_check_files_2_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_check_files_2 IS 'Unified mirror of source tbl_check_file (singular); suffix _2 to avoid conflict with R.83.1 unified_check_files';
COMMENT ON COLUMN unified_check_files_2.src_check_file_id IS '自增检查文件ID(单数)';
CREATE INDEX IF NOT EXISTS idx_unified_check_files_2_site ON unified_check_files_2 (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_check_files_2_raw_gin ON unified_check_files_2 USING GIN (raw_data jsonb_path_ops);

-- 10. unified_check_files_pl ← tbl_check_files (id, 复数)
CREATE TABLE IF NOT EXISTS unified_check_files_pl (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_check_files',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_check_file_id BIGINT,
  check_id BIGINT,
  file_name VARCHAR(500),
  file_path VARCHAR(1000),
  file_size BIGINT,
  uploaded_at TIMESTAMPTZ,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_check_files_pl_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_check_files_pl IS 'Unified mirror of source tbl_check_files (plural); suffix _pl to avoid conflict with R.83.1 unified_check_files';
COMMENT ON COLUMN unified_check_files_pl.src_check_file_id IS '自增检查文件ID(复数)';
CREATE INDEX IF NOT EXISTS idx_unified_check_files_pl_site ON unified_check_files_pl (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_check_files_pl_raw_gin ON unified_check_files_pl USING GIN (raw_data jsonb_path_ops);

-- 11. unified_check_logs ← tbl_check_log (id)
CREATE TABLE IF NOT EXISTS unified_check_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_check_log',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_log_id BIGINT,
  task_id BIGINT,
  log_level VARCHAR(20),
  message TEXT,
  logged_at TIMESTAMPTZ,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_check_logs_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_check_logs IS 'Unified mirror of source tbl_check_log';
COMMENT ON COLUMN unified_check_logs.src_log_id IS '自增检查日志ID';
CREATE INDEX IF NOT EXISTS idx_unified_check_logs_site ON unified_check_logs (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_check_logs_raw_gin ON unified_check_logs USING GIN (raw_data jsonb_path_ops);

-- 12. unified_check_patrol_strategies ← tbl_check_patrol_strategy (id)
CREATE TABLE IF NOT EXISTS unified_check_patrol_strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_check_patrol_strategy',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_strategy_id BIGINT,
  strategy_name VARCHAR(200),
  cron_expression VARCHAR(100),
  task_template_id BIGINT,
  enabled SMALLINT DEFAULT 1,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_check_patrol_strategies_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_check_patrol_strategies IS 'Unified mirror of source tbl_check_patrol_strategy';
COMMENT ON COLUMN unified_check_patrol_strategies.src_strategy_id IS '自增巡检策略ID';
CREATE INDEX IF NOT EXISTS idx_unified_check_patrol_strategies_site ON unified_check_patrol_strategies (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_check_patrol_strategies_raw_gin ON unified_check_patrol_strategies USING GIN (raw_data jsonb_path_ops);

-- 13. unified_check_patrol_tasks ← tbl_check_patrol_task (id)
CREATE TABLE IF NOT EXISTS unified_check_patrol_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_check_patrol_task',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_patrol_task_id BIGINT,
  strategy_id BIGINT,
  task_name VARCHAR(200),
  status VARCHAR(20),
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_check_patrol_tasks_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_check_patrol_tasks IS 'Unified mirror of source tbl_check_patrol_task';
COMMENT ON COLUMN unified_check_patrol_tasks.src_patrol_task_id IS '自增巡检任务ID';
CREATE INDEX IF NOT EXISTS idx_unified_check_patrol_tasks_site ON unified_check_patrol_tasks (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_check_patrol_tasks_raw_gin ON unified_check_patrol_tasks USING GIN (raw_data jsonb_path_ops);

-- 14. unified_check_patrol_task_items ← tbl_check_patrol_task_item (id)
CREATE TABLE IF NOT EXISTS unified_check_patrol_task_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_check_patrol_task_item',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_patrol_task_item_id BIGINT,
  patrol_task_id BIGINT,
  sector_id BIGINT,
  result VARCHAR(20),
  remark TEXT,
  checked_at TIMESTAMPTZ,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_check_patrol_task_items_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_check_patrol_task_items IS 'Unified mirror of source tbl_check_patrol_task_item';
COMMENT ON COLUMN unified_check_patrol_task_items.src_patrol_task_item_id IS '自增巡检任务项ID';
CREATE INDEX IF NOT EXISTS idx_unified_check_patrol_task_items_site ON unified_check_patrol_task_items (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_check_patrol_task_items_raw_gin ON unified_check_patrol_task_items USING GIN (raw_data jsonb_path_ops);

-- 15. unified_check_patrol_logs ← tbl_check_patrol_log (id)
CREATE TABLE IF NOT EXISTS unified_check_patrol_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_check_patrol_log',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_patrol_log_id BIGINT,
  patrol_task_id BIGINT,
  log_level VARCHAR(20),
  message TEXT,
  logged_at TIMESTAMPTZ,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_check_patrol_logs_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_check_patrol_logs IS 'Unified mirror of source tbl_check_patrol_log';
COMMENT ON COLUMN unified_check_patrol_logs.src_patrol_log_id IS '自增巡检日志ID';
CREATE INDEX IF NOT EXISTS idx_unified_check_patrol_logs_site ON unified_check_patrol_logs (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_check_patrol_logs_raw_gin ON unified_check_patrol_logs USING GIN (raw_data jsonb_path_ops);
